// Actual-version rollback evidence helper. Only the PS orchestrator creates owned fixtures.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, writeFileSync } = require('node:fs');
const { join, relative, resolve, sep, basename } = require('node:path');
const { tmpdir } = require('node:os');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const ROOT = resolve(__dirname, '..');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const json = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''));
const save = (path, value) => writeFileSync(path, JSON.stringify(value, null, 2) + '\n');
function plain(path) {
  let cursor = resolve(path);
  while (true) {
    if (existsSync(cursor)) assert.equal(lstatSync(cursor).isSymbolicLink(), false, `Linked path refused: ${cursor}`);
    const parent = resolve(cursor, '..'); if (parent === cursor) break; cursor = parent;
  }
  return resolve(path);
}
function inventory(root, full = false) {
  const files = {};
  function walk(dir) {
    assert.ok(existsSync(join(root, dir)), `Missing runtime tree ${dir}`);
    for (const item of readdirSync(join(root, dir), { withFileTypes: true })) {
      assert.equal(item.isSymbolicLink(), false, `Linked runtime entry ${item.name}`);
      const path = dir ? `${dir}/${item.name}` : item.name;
      if (item.isDirectory()) walk(path); else if (item.isFile()) files[path] = sha(readFileSync(join(root, path)));
    }
  }
  if(full){walk('');return Object.fromEntries(Object.entries(files).sort(([a],[b])=>a.localeCompare(b,'en')));}
  for (const tree of ['packages/daemon/dist', 'packages/tray/dist', 'packages/tray/dist-preload', 'packages/web/dist']) walk(tree);
  for (const path of ['scripts/task-entry.cjs', 'scripts/start-review.ps1', 'scripts/stop-review.ps1', 'scripts/review-profile.ps1', 'scripts/install-review.ps1', 'scripts/uninstall-review.ps1', 'packages/daemon/package.json', 'packages/tray/package.json', 'packages/tray/src/pet.html', 'packages/tray/src/gallery.html', 'packages/tray/src/gallery.css']) {
    files[path] = sha(readFileSync(join(root, path)));
  }
  return Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b, 'en')));
}
function git(executable, checkout, args) {
  const child = spawnSync(executable, ['-C', checkout, ...args], { encoding: 'utf8', windowsHide: true });
  assert.equal(child.status, 0, `Git read failed: ${child.stderr || child.error || child.stdout}`);
  return child.stdout.trim();
}
function inspect(bundlePath, provenancePath, gitExecutable) {
  const bundle = plain(realpathSync(bundlePath));
  assert.equal(existsSync(join(bundle, 'review-data')), false, 'Bundle must be unused; no embedded profile');
  const provenance = json(provenancePath);
  assert.match(provenance.sourceCommit || '', /^[a-f0-9]{40}$/, 'Provenance requires exact sourceCommit');
  assert.ok(provenance.checkoutRoot && provenance.runtimeRawSha256, 'Provenance requires checkoutRoot and complete runtimeRawSha256');
  const checkout = plain(realpathSync(provenance.checkoutRoot));
  assert.equal(git(gitExecutable, checkout, ['rev-parse', 'HEAD']), provenance.sourceCommit, 'Checkout is not provenance commit');
  // Source/config changes would make a matching dist tree insufficient evidence of this commit.
  const dirty = git(gitExecutable, checkout, ['status', '--porcelain', '--untracked-files=normal', '--', 'package.json', 'package-lock.json', 'tsconfig.base.json', 'packages/daemon/src', 'packages/daemon/package.json', 'packages/daemon/tsconfig.json', 'packages/web/src', 'packages/web/public', 'packages/web/package.json', 'packages/web/vite.config.ts', 'packages/web/tsconfig.json', 'packages/web/index.html', 'packages/tray/src', 'packages/tray/package.json', 'packages/tray/tsconfig.json', 'packages/tray/tsconfig.preload.json', 'scripts/task-entry.cjs', 'scripts/start-review.ps1', 'scripts/stop-review.ps1', 'scripts/review-profile.ps1', 'scripts/install-review.ps1', 'scripts/uninstall-review.ps1', 'scripts/build-review-bundle.mts']);
  assert.equal(dirty, '', 'Freeze/commit source and build configuration before binding an actual checkout');
  const runtime = inventory(bundle);
  assert.deepEqual(runtime, provenance.runtimeRawSha256, 'Bundle runtime does not match complete provenance inventory');
  const fullInventoryPath=plain(realpathSync(provenance.fullBundleInventoryPath));
  const fullInventoryBytes=readFileSync(fullInventoryPath);
  assert.equal(sha(fullInventoryBytes),provenance.fullBundleInventorySha256,'Full bundle inventory changed');
  const full=JSON.parse(gunzipSync(fullInventoryBytes));
  assert.deepEqual(inventory(bundle,true),full,'Full package, dependencies, assets or notices differ from provenance');
  for (const [path, hash] of Object.entries(runtime)) assert.equal(sha(readFileSync(join(checkout, path))), hash, `Bundle differs from matching checkout build: ${path}`);
  // Earlier baseline commits predate these isolation contracts. Do not boot them
  // unchanged merely because a modern launcher passes environment variables.
  const daemonEntry = readFileSync(join(bundle, 'packages/daemon/dist/index.js'), 'utf8');
  const trayEntry = readFileSync(join(bundle, 'packages/tray/dist/main.js'), 'utf8');
  assert.ok(daemonEntry.includes('QUOTAPULSE_READERS') && /readersEnabled\s*\?\s*ALL_ADAPTERS\s*:\s*\[\]/.test(daemonEntry), 'Previous/current daemon must implement verified readers-off scheduler isolation before boot');
  assert.match(trayEntry, /configureInstanceProfile\(app,\s*process\.env\.QUOTAPULSE_DATA_DIR\)/, 'Tray must configure an explicitly isolated Electron profile before boot');
  const profile = readFileSync(join(bundle, 'packages/tray/dist/instance-profile.js'), 'utf8');
  assert.ok(profile.includes("setPath('userData'") && profile.includes("setPath('sessionData'"), 'Tray profile must isolate both userData and sessionData');
  const manifest = json(join(bundle, 'review-manifest.json'));
  assert.equal(manifest.platform, 'win32'); assert.equal(manifest.arch, 'x64');
  assert.equal(manifest.requiredNodeAbi, process.versions.modules, 'Host Node ABI must match both bundles');
  assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64');
  return { bundle, checkout, sourceCommit: provenance.sourceCommit, provenanceSha256: sha(readFileSync(provenancePath)), runtime, runtimeInventorySha256: sha(Buffer.from(JSON.stringify(runtime))), fullInventoryPath, fullInventorySha256:sha(fullInventoryBytes),fullFiles:Object.keys(full).length,maxRelativePath:Math.max(...Object.keys(full).map(path=>path.length)),checkpoint: manifest.checkpoint };
}
function owned(fixture) {
  fixture = plain(realpathSync(fixture));
  const boundary = resolve(ROOT, 'tmp', 'release-rollback') + sep;
  assert.ok(fixture.toLowerCase().startsWith(boundary.toLowerCase()), 'Fixture must remain under repository tmp/release-rollback');
  assert.match(relative(resolve(ROOT, 'tmp', 'release-rollback'), fixture), /^run-[a-f0-9]{32}$/, 'Invalid owned fixture name');
  const marker = json(join(fixture, 'fixture.json'));
  assert.equal(marker.mode, 'synthetic-two-checkout-rollback');
  assert.equal(resolve(marker.fixture), fixture);
  const installation=plain(resolve(marker.installationRoot));
  const expected=resolve(tmpdir(),'qprb-'+basename(fixture).slice(4,12));
  assert.equal(installation.toLowerCase(),expected.toLowerCase(),'Installation must be the exact short temp path bound to this owned fixture');
  return { fixture, installation, data: join(installation, 'review-data') };
}
function database(fixture, runtime, readonly) {
  const { data } = owned(fixture);
  const req = createRequire(join(runtime, 'package.json'));
  const entry = realpathSync(req.resolve('better-sqlite3'));
  assert.ok(entry.toLowerCase().startsWith((realpathSync(runtime) + sep).toLowerCase()), 'SQLite must resolve inside active release');
  return new (req('better-sqlite3'))(join(data, 'usage.db'), { readonly, fileMustExist: true });
}
function snapshot(fixture, runtime) {
  const db = database(fixture, runtime, true);
  try {
    return {
      schemaVersion: db.prepare("SELECT value FROM meta WHERE key='schema_version'").get(),
      meta: db.prepare('SELECT * FROM meta ORDER BY key').all(),
      sources: db.prepare('SELECT * FROM source ORDER BY id').all(),
      quotas: db.prepare('SELECT * FROM limit_sample ORDER BY id').all(),
      alerts: db.prepare('SELECT * FROM alert_event ORDER BY id').all(),
      cursors: db.prepare('SELECT * FROM ingest_state ORDER BY source_id,target_key').all(),
      rollups: db.prepare('SELECT * FROM rollup_hourly ORDER BY bucket_ts,source_id,model,project').all(),
      sessions: db.prepare('SELECT * FROM session ORDER BY id').all(),
      usage: db.prepare('SELECT * FROM usage_event ORDER BY id').all(),
      price: db.prepare('SELECT * FROM price ORDER BY provider,model').all(),
      settings: db.prepare('SELECT pet_enabled,tray_animation_enabled,hidden_subscriptions FROM app_setting WHERE id=1').get(),
      notifications: db.prepare('SELECT enabled,snooze_until,quiet_start,quiet_end FROM notification_setting WHERE id=1').get(),
      windowSize: json(join(owned(fixture).data, 'window-size.json')),
    };
  } finally { db.close(); }
}
function seed(fixture, runtime) {
  const { data } = owned(fixture); const db = database(fixture, runtime, false);
  try {
    assert.equal(db.prepare("SELECT value FROM meta WHERE key='schema_version'").get()?.value, '7', 'This fixture targets the existing no-migration schema7 contract');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM usage_event').get().n, 0, 'Only a newly created empty synthetic DB may be seeded');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM source').get().n, 0, 'Fresh fixture required');
    db.transaction(() => {
      db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at) VALUES(9101,'codex','rollback-synthetic','/synthetic/nonexistent','Rollback fixture',0);
        INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES(9101,9101,'rollback-null',NULL,1747489320000),(9102,9101,'rollback-empty','',1747489320000);
        INSERT INTO price(model,provider,input_per_1m,cached_input_per_1m,cache_write_per_1m,output_per_1m,origin,updated_at) VALUES('rollback-priced-model','rollback-provider',17,2,25,31,'synthetic-rollback-only',1);
        INSERT INTO usage_event(id,source_id,session_id,dedup_key,ts,model,provider,effort,input_tokens,cached_input_tokens,cache_write_tokens,output_tokens,reasoning_tokens,total_tokens,call_count,cost_usd,cost_source,cost_input_usd,cost_cached_input_usd,cost_cache_write_usd,cost_output_usd,cost_cache_saving_usd,price_provider) VALUES
          (9101,9101,9101,'rollback-computed',1747489320000,'rollback-priced-model','rollback-provider',NULL,100,40,10,50,20,200,1,0.000638,'computed',0.0002,0.000008,0.00003,0.0004,0.000072,'rollback-provider'),
          (9102,9101,9102,'rollback-native',1747489320001,'rollback-priced-model','rollback-provider','',10,0,0,10,0,20,1,0.123456,'native',NULL,NULL,NULL,NULL,NULL,NULL),
          (9103,9101,NULL,'rollback-unknown',1747489320002,NULL,NULL,'high',1,0,0,0,0,1,1,NULL,'unknown',NULL,NULL,NULL,NULL,NULL,NULL);
        INSERT INTO limit_sample(id,source_id,window_kind,used_percent,used_dollars,limit_dollars,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES
          (9101,9101,'5h',0,NULL,NULL,4102444800000,1747489000000,1747489005000,1747489005000,'rollback-synthetic'),
          (9102,9101,'5h',83,NULL,NULL,4102444800000,1747489320000,1747489320050,1747489320050,'rollback-synthetic'),
          (9103,9101,'monthly',100,0,100,4102444800000,1747489320001,1747489320010,1747489320010,'rollback-synthetic'),
          (9104,9101,'weekly',NULL,NULL,NULL,NULL,1747489320002,1747489320002,NULL,'rollback-synthetic');
        INSERT INTO alert_event(id,kind,source_id,owner_key,window_kind,threshold,used_percent,resets_at,detected_at,delivered_at,origin) VALUES(9101,'threshold',9101,'source:9101','5h',80,83,4102444800000,1747489320000,1747489320001,'rollback-synthetic');
        INSERT INTO ingest_state(source_id,target_key,kind,byte_offset,file_size,file_mtime,watermark,meta,last_ok_at,last_error,error_count) VALUES(9101,'synthetic-target','fixture',123,456,1747489320000,1747489320002,'{"fixture":"rollback-only"}',1747489320002,NULL,0);
        INSERT INTO meta(key,value) VALUES('synthetic_rollback_fixture','115');
        INSERT INTO rollup_hourly(bucket_ts,source_id,model,project,calls,input_tokens,cached_tokens,cache_write,output_tokens,reasoning_tokens,total_tokens,cost_usd,cost_known_calls)
          SELECT (u.ts/3600000)*3600000,u.source_id,COALESCE(u.model,''),COALESCE(s.project,''),SUM(u.call_count),SUM(u.input_tokens),SUM(u.cached_input_tokens),SUM(u.cache_write_tokens),SUM(u.output_tokens),SUM(u.reasoning_tokens),SUM(u.total_tokens),COALESCE(SUM(u.cost_usd),0),SUM(CASE WHEN u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END)
          FROM usage_event u LEFT JOIN session s ON s.id=u.session_id GROUP BY (u.ts/3600000)*3600000,u.source_id,COALESCE(u.model,''),COALESCE(s.project,'');
        INSERT OR REPLACE INTO app_setting(id,pet_enabled,tray_animation_enabled,hidden_subscriptions,updated_at) VALUES(1,0,0,'["rollback-hidden-owner"]',1);
        INSERT OR REPLACE INTO notification_setting(id,enabled,snooze_until,quiet_start,quiet_end,updated_at) VALUES(1,0,4102444800000,1320,420,1);`);
    })();
    writeFileSync(join(data, 'window-size.json'), JSON.stringify({ width: 1371, height: 887 }) + '\n');
    writeFileSync(join(data, 'rollback-sentinel.txt'), 'synthetic-only; preserve across actual app checkout rollback\n');
  } finally { db.close(); }
  const result = snapshot(fixture, runtime);
  assert.equal(result.usage.length, 3); assert.equal(result.sessions[0].project, null); assert.equal(result.sessions[1].project, '');
  assert.equal(result.quotas.length,4); assert.equal(result.alerts.length,1); assert.equal(result.cursors.length,1); assert.equal(result.rollups.length,2);
  assert.equal(result.usage[0].cost_usd,0.000638);
  const catalog=result.price.find(row=>row.provider==='rollback-provider'&&row.model==='rollback-priced-model');
  assert.deepEqual([catalog.input_per_1m,catalog.cached_input_per_1m,catalog.cache_write_per_1m,catalog.output_per_1m],[17,2,25,31]);
  assert.notEqual((100*catalog.input_per_1m+40*catalog.cached_input_per_1m+10*catalog.cache_write_per_1m+50*catalog.output_per_1m)/1e6,result.usage[0].cost_usd,'Catalog is deliberately newer than the stored computed cost');
  return result;
}
function settle(fixture,runtime,seedFile,baselineFile,reportFile){
  const seeded=json(seedFile),actual=snapshot(fixture,runtime),expected=structuredClone(seeded);
  // In readers-off mode the old detector marks sources absent. This is derived
  // detection state, not a usage/quota fact. Settle ONLY that field before the
  // upgrade baseline; every subsequent upgrade/rollback comparison stays exact.
  const transitions=expected.sources.map(source=>({sourceId:source.id,beforeEnabled:source.enabled,afterEnabled:0}));
  for(const source of expected.sources)source.enabled=0;
  assert.deepEqual(actual,expected,'Old-mode initialization may only settle source.enabled; no other durable mutation is permitted');
  save(baselineFile,actual);
  save(reportFile,{phase:'previous-mode initialization before upgrade baseline',allowedDerivedTransitions:transitions,allOtherSeededFieldsEqual:true,baselineSha256:sha(readFileSync(baselineFile))});
}
// sendStatic serves HTML with one exact, synthetic-token insertion. Derive the
// expected bytes from the hash-verified raw bundle, never by stripping response HTML.
function expectedServedBytes(identity, path, token) {
  const raw = readFileSync(join(identity.bundle, path));
  assert.equal(sha(raw), identity.runtime[path], `Raw bundle asset changed since provenance verification: ${path}`);
  const html = path.toLowerCase().endsWith('.html');
  return {
    rawSha256: identity.runtime[path],
    transform: html ? 'exact daemon token insertion before first </head>' : 'none',
    bytes: html ? Buffer.from(raw.toString('utf8').replace('</head>', `<script>window.__QUOTAPULSE_TOKEN__=${JSON.stringify(token)};</script></head>`), 'utf8') : raw,
  };
}
async function live(fixture, identity) {
  const { data } = owned(fixture); const lock = json(join(data, 'daemon.lock'));
  assert.ok(Number.isSafeInteger(lock.port) && lock.port >= 1024 && lock.port <= 65535);
  const origin = `http://127.0.0.1:${lock.port}`;
  const get = async path => {
    const response = await fetch(origin + path, { headers: { 'x-quotapulse-token': lock.token }, signal: AbortSignal.timeout(10000), redirect: 'error' });
    assert.equal(response.status, 200, `Local API/asset failed: ${path}`); return response;
  };
  const health = await (await get('/api/health')).json();
  assert.equal(health.ok, true); assert.deepEqual(health.scheduler.sources, [], 'No adapters/readers allowed');
  // Check served bytes against this checkout, not just a changed release label.
  const served = {};
  for (const [path, hash] of Object.entries(identity.runtime)) if (path.startsWith('packages/web/dist/')) {
    const url = '/' + path.slice('packages/web/dist/'.length).split('/').map(encodeURIComponent).join('/');
    const expected = expectedServedBytes(identity, path, lock.token);
    const actual = Buffer.from(await (await get(url)).arrayBuffer());
    assert.deepEqual(actual, expected.bytes, `Wrong served web asset: ${path}`);
    served[path] = { rawSha256: hash, expectedServedSha256: sha(expected.bytes), actualServedSha256: sha(actual), transform: expected.transform };
  }
  const settings = await (await get('/api/settings')).json();
  const notifications = await (await get('/api/notification-settings')).json();
  assert.equal(settings.pet_enabled, false); assert.equal(settings.tray_animation_enabled, false);
  assert.deepEqual(settings.hidden_subscriptions, ['rollback-hidden-owner']);
  assert.equal(notifications.enabled, false); assert.equal(notifications.snooze_until, 4102444800000);
  assert.equal(notifications.quiet_start, 1320); assert.equal(notifications.quiet_end, 420);
  const usage=await (await get('/api/usage-events?from=1747489319999&to=1747489320003&limit=8&offset=0')).json();
  assert.equal(usage.total,3);assert.equal(usage.rows.length,3);
  assert.deepEqual(usage.rows.map(row=>({id:row.event_id,model:row.model,provider:row.provider,effort:row.effort,session:row.session_key,tokens:row.total_tokens,cost:row.cost_usd,basis:row.cost_source})),[
    {id:9103,model:null,provider:null,effort:'high',session:null,tokens:1,cost:null,basis:'unknown'},
    {id:9102,model:'rollback-priced-model',provider:'rollback-provider',effort:'',session:9102,tokens:20,cost:0.123456,basis:'native'},
    {id:9101,model:'rollback-priced-model',provider:'rollback-provider',effort:null,session:9101,tokens:200,cost:0.000638,basis:'computed'},
  ],'Actual served records must retain null/empty distinctions and stored monetary basis');
  assert.equal(usage.rows.reduce((sum,row)=>sum+row.total_tokens,0),221);
  return { sourceCommit: identity.sourceCommit, runtimeInventorySha256: identity.runtimeInventorySha256, served, readersDisabled: true, settings, notifications,usage };
}
async function main() {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'inspect') {
    const [configFile, output] = args; const c = json(configFile);
    const previous = inspect(c.previousBundle, c.previousProvenance, c.gitExecutable);
    const current = inspect(c.currentBundle, c.currentProvenance, c.gitExecutable);
    assert.notEqual(previous.sourceCommit, current.sourceCommit, 'Actual two different application commits required');
    const code = id => Object.fromEntries(Object.entries(id.runtime).filter(([p]) => /\.(js|cjs|css|html)$/.test(p) && /^(packages\/(daemon|tray)\/dist|packages\/web\/dist)/.test(p)));
    assert.notDeepEqual(code(previous), code(current), 'Identical application runtime; manifest labels/notices/assets alone are not actual-version rollback');
    const orchestrationInputs = {};
    // The orchestrator uses these local helpers before generated installed wrappers
    // take over; bind their bytes to the selected current checkout as well.
    for (const path of ['scripts/install-review.ps1', 'scripts/review-profile.ps1']) {
      const hash = sha(readFileSync(join(ROOT, path)));
      assert.equal(hash, current.runtime[path], `Local installer helper differs from current checkout-bound bundle: ${path}`);
      orchestrationInputs[path] = hash;
    }
    for (const path of ['scripts/check-release-rollback.ps1', 'scripts/check-release-rollback.cjs']) orchestrationInputs[path] = sha(readFileSync(join(ROOT, path)));
    save(output, { previous, current, orchestrationInputs });
  } else if (mode === 'settle') settle(...args);
  else if (mode === 'seed') save(args[2], seed(args[0], args[1]));
  else if (mode === 'installed') {
    const [fixture, identityFile, output] = args; const {installation}=owned(fixture); const identity = json(identityFile);
    const marker = json(join(installation, 'installation.json')); assert.match(marker.active, /^release-[a-f0-9]{64}$/);
    const runtime = join(installation, 'releases', marker.active);
    assert.deepEqual(inventory(runtime), identity.runtime, 'Installed runtime differs from checkout-bound bundle');
    const packed=readFileSync(identity.fullInventoryPath);assert.equal(sha(packed),identity.fullInventorySha256);
    assert.deepEqual(inventory(runtime,true),JSON.parse(gunzipSync(packed)),'Extracted package files differ, including dependencies/assets/notices');
    save(output, { runtime, sourceCommit: identity.sourceCommit, runtimeInventorySha256: identity.runtimeInventorySha256, fullFiles:identity.fullFiles,fullPackageEqual:true });
  } else if (mode === 'snapshot') save(args[2], snapshot(args[0], args[1]));
  else if (mode === 'live') save(args[2], await live(args[0], json(args[1])));
  else if (mode === 'inventory') save(args[1], inventory(args[0]));
  else throw new Error('Expected inspect, seed, settle, snapshot, live or inventory mode');
}
if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { inventory, expectedServedBytes };
