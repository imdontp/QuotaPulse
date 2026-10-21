/** Compiled aggregate presence regression using isolated API/SSE and a synthetic DB. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Request } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
const taskLang='en', taskTheme='dark';
const output=resolve(root,'tmp/presence95-browser');
mkdirSync(output,{recursive:true});if((process.env.QUOTAPULSE_PRESENCE95_MODE??'verify')==='verify')rmSync(resolve(output,'verification.json'),{force:true});
const fixedNow = Date.parse('2025-05-17T13:42:00.000Z');
// Freeze Date only, keeping real timers/performance for HTTP, browser and cleanup.
// This applies to internal query helpers too, without changing production clocks.
const realDate = globalThis.Date;
globalThis.Date = new Proxy(realDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
  apply() { return new realDate(fixedNow).toString(); },
  get(target, property, receiver) { return property === 'now' ? () => fixedNow : Reflect.get(target, property, receiver); },
});
const db = openDb(':memory:');
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at)
  VALUES (1,'codex','fixed','/synthetic/nonexistent','Codex fixture',0,'openai:subscription','openai','OpenAI Subscription','active',${fixedNow}),
    (2,'hermes','fixed','/synthetic/nonexistent','Hermes fixture',0,'opencode:go','opencode','OpenCode Go Subscription','active',${fixedNow}),
    (3,'claude-code','fixed','/synthetic/nonexistent','Claude Code fixture',0,'opencode:go','opencode','OpenCode Go Subscription','active',${fixedNow}),
    (4,'opencode','fixed','/synthetic/nonexistent','OpenCode fixture',0,'openai:subscription','openai','OpenAI Subscription','active',${fixedNow});`);
const referenceProjects = ['QuotaPulse', 'Agent Platform', 'Edge Services', 'Developer Tools', 'Research Lab'];
const referenceModels = [
  { name: 'DeepSeek V4.1', provider: 'deepseek', share: 38 },
  { name: 'GPT-5.x', provider: 'openai', share: 24 },
  { name: 'Claude 3.7', provider: 'anthropic', share: 18 },
  { name: 'Claude 3.5', provider: 'anthropic', share: 11 },
  { name: 'Others', provider: 'openrouter', share: 9 },
  { name: 'GPT-4.1 mini', provider: 'openai', share: 0 },
];
const session = db.prepare('INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (?,?,?,?,?)');
const usage = db.prepare('INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source,cost_input_usd,cost_cached_input_usd,cost_cache_write_usd,cost_output_usd,cost_cache_saving_usd,price_provider) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
// Synthetic catalogue rates for the in-memory visual fixture only. The saved
// amount is derived from the same fresh/cached input components the UI reports.
const fixtureInputUsdPerMillion = 0.0593846153846154, fixtureCachedInputUsdPerMillion = 0.004, fixtureOutputUsdPerMillion = 0.004;
for (let index = 0; index < 12; index++) {
  // Keep the reference map's 4 Codex, 2 Claude Code, 6 Hermes, 0 OpenCode
  // recent-session distribution while preserving the same 12 sessions.
  const source = [1, 1, 1, 1, 3, 3, 2, 2, 2, 2, 2, 2][index]!;
  session.run(index + 1, source, `fixture-session-${index}`, referenceProjects[0], fixedNow - 10_000);
  const model = referenceModels[index % referenceModels.length]!;
  const totalTokens = model.share === 0 ? 1 : model.share * 721_000_000 / 600;
  for (let call = 0; call < 3; call++) {
    const inputShare = [.6, .65, .7][(index + call) % 3]!;
    const inputTokens = totalTokens * inputShare * .58, cachedInputTokens = totalTokens * inputShare * .42;
    const outputTokens = totalTokens * (1 - inputShare);
    const costSource = index === 0 ? 'native' : 'computed';
    const inputUsd = inputTokens / 1_000_000 * fixtureInputUsdPerMillion;
    const cachedInputUsd = cachedInputTokens / 1_000_000 * fixtureCachedInputUsdPerMillion;
    const outputUsd = outputTokens / 1_000_000 * fixtureOutputUsdPerMillion;
    const cacheSavingUsd = cachedInputTokens / 1_000_000 * (fixtureInputUsdPerMillion - fixtureCachedInputUsdPerMillion);
    // Keep each session's latest record within four minutes, then spread older calls across the visible 30-minute interval.
    const ageMs = call === 0 ? 15_000 + index * 20_000 : source === 2
      ? 300_000 + index * 120_000 + (call === 2 ? 30_000 : 0)
      : 300_000 + index * 240_000 + (call === 2 ? 90_000 : 0);
    const recordedAt = fixedNow - ageMs;
    usage.run(source, index + 1, `fixed-${index}-${call}`, recordedAt, model.name, model.provider,
      inputTokens, cachedInputTokens, outputTokens, totalTokens, call + 1,
      costSource === 'native' ? (index + 1) / 100 : inputUsd + cachedInputUsd + outputUsd, costSource,
      costSource === 'native' ? null : inputUsd, costSource === 'native' ? null : cachedInputUsd,
      costSource === 'native' ? null : 0, costSource === 'native' ? null : outputUsd,
      costSource === 'native' ? null : cacheSavingUsd, costSource === 'native' ? null : model.provider);
  }
}
// A stale recorded OpenCode route keeps the concept's zero-active-session edge
// visible without manufacturing a provider relationship or changing live counts.
const openCodeAt = fixedNow - 10 * 60_000;
session.run(13, 4, 'fixture-opencode-quota-pulse', referenceProjects[0], openCodeAt);
usage.run(4, 13, 'fixed-opencode-route', openCodeAt, 'DeepSeek V4.1', 'deepseek', 1, 0, 0, 1, 1,
  null, 'unknown', null, null, null, null, null, null);
// The monthly concept is focused on QuotaPulse while the machine-wide quick
// stats still report all five named projects. Keep four small monthly records
// for the other projects, outside the recent-session window.
for (let index = 1; index < referenceProjects.length; index++) {
  const id = 100 + index, source = [1, 3, 4, 2][index - 1]!;
  const model = referenceModels[index - 1]!;
  const at = fixedNow - 10 * 60_000;
  session.run(id, source, `fixture-project-${index}`, referenceProjects[index], at);
  const inputUsd = fixtureInputUsdPerMillion / 1_000_000;
  usage.run(source, id, `fixture-project-usage-${index}`, at, model.name, model.provider, 1, 0, 0, 1, 1,
    inputUsd, 'computed', inputUsd, 0, 0, 0, 0, model.provider);
}
// Values below the old visual minimum catch inflated nonzero bars in both charts.
const tinyUsage = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,cached_input_tokens,output_tokens,total_tokens,call_count,cost_usd,cost_source) VALUES (1,1,?,?,'DeepSeek V4.1','deepseek',1,0,0,1,1,0,'computed')");
tinyUsage.run('fixed-tiny-minute', fixedNow - 15 * 60_000);
tinyUsage.run('fixed-tiny-day', fixedNow - 3 * 86_400_000);
const quota = db.prepare('INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,?,?,?,?,?,?,?)');
const addQuotaSample = (sourceId: number, window: string, percent: number | null, resetAt: number | null, observedAt: number) => quota.run(sourceId, window, percent, resetAt, observedAt, observedAt, observedAt, 'fixed-fixture');
// Complete history must include older reset periods, nulls and more than eight
// readings per period, without changing the latest live quota/default selection.
for (let segment = 0; segment < 4; segment++) for (let index = 0; index < 12; index++) {
  const at = fixedNow - (5 - segment) * 3_600_000 + index * 60_000;
  addQuotaSample(1, '5h', index === 4 ? null : index === 1 ? 0.5 : index * 8, segment === 0 ? null : fixedNow - (4 - segment) * 3_600_000, at);
}
addQuotaSample(1, '5h', 38, fixedNow + (2 * 60 + 17) * 60_000, fixedNow - 5 * 60_000);
addQuotaSample(1, '5h', 83, fixedNow + (2 * 60 + 17) * 60_000, fixedNow - 30_000);
addQuotaSample(1, 'weekly', 62, fixedNow + (3 * 24 + 5) * 3_600_000, fixedNow - 30_000);
const monthlyReset = fixedNow + (6 * 24 + 2) * 3_600_000;
addQuotaSample(1, 'monthly', 59, monthlyReset, fixedNow - 48 * 3_600_000);
addQuotaSample(1, 'monthly', 65.5, monthlyReset, fixedNow - 24 * 3_600_000);
addQuotaSample(1, 'monthly', 72, monthlyReset, fixedNow - 30_000);
addQuotaSample(2, 'monthly', 58, fixedNow + (12 * 24 + 6) * 3_600_000, fixedNow - 30_000);
addQuotaSample(2, 'daily', 34, fixedNow + (7 * 60 + 18) * 60_000, fixedNow - 30_000);
recordQuotaAlerts(db, fixedNow);
const scheduler = new Scheduler(db, [], { pollMs: 1_000_000, detectMs: 1_000_000 });
const daemon = buildServer(db, scheduler, { token: 'stable-capture-test', port: 7816, webRoot: resolve(root, 'packages/web/dist') });
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const sha = (value: Buffer) => createHash('sha256').update(value).digest('hex');
const rendererArgs = ['baseline','paint'].includes(process.env.QUOTAPULSE_PRESENCE95_MODE??'verify') ? ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'] : ['--force-color-profile=srgb'];
async function settled(page:Page,pending:Set<Request>) {
 const deadline=performance.now()+30_000;let idle=0;
 while(idle<12){assert.ok(performance.now()<deadline,`API did not settle: ${[...pending].map(r=>r.url()).join(', ')}`);idle=pending.size===0?idle+1:0;await page.waitForTimeout(25);}
 await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(1_000);
}
const mode = process.env.QUOTAPULSE_PRESENCE95_MODE ?? 'verify';
const stages: any[] = [], errors: string[] = [], forbidden: string[] = [], samplingGaps: any[] = [];
let page: Page | undefined, releaseHeld: (() => void) | undefined;
let serial = 10000;
const addRecord = db.prepare("INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,input_tokens,output_tokens,total_tokens,call_count,cost_source) VALUES(1,?,?,?,?,?,?,0,?,1,'unknown')");
const addModel = (model: string, provider = 'fixture', tokens = 800_000_000, sessionKey = 1) => {
  const id = serial++;
  addRecord.run(sessionKey, `presence95-${id}`, fixedNow - 1, model, provider, tokens, tokens);
  return id;
};
const addProject = (project: string | null, tokens = 800_000_000) => {
  const id = serial++;
  session.run(id, 1, `presence95-session-${id}`, project, fixedNow - 1);
  addModel('DeepSeek V4.1', 'deepseek', tokens, id);
  return id;
};
const notify = () => scheduler.emit('data', { newEvents: 1, newLimits: 0, trigger: 'synthetic-presence95' });
const modelRow = (model: string, provider = 'fixture') => page!.locator('[data-model-pair-key]').filter({ has: page!.locator('button').filter({ hasText: model }) }).filter({ hasText: provider });
const card = (project: string | null) => page!.locator('[data-project-selection-role=card]').filter({ hasText: project ?? 'Unassigned' });
async function clear() { await page!.evaluate(() => { (window as any).__effects = []; (window as any).__startProbe = undefined; }); }
async function arm(ms = 1000) {
  await clear();
  await page!.evaluate(ms => {
    const probe = { done: false, started: false, samples: [] as any[] };
    (window as any).__probe = probe;
    (window as any).__startProbe = () => {
      if (probe.started) return; probe.started = true;
      const start = performance.now();
      const frame = () => {
        probe.samples.push({ ms: performance.now() - start, effects: (window as any).__effects.map((entry: any) => ({ key: entry.key, duration: entry.duration,
          time: entry.animation.currentTime, state: entry.animation.playState, opacity: getComputedStyle(entry.target).opacity,
          outline: getComputedStyle(entry.target).outlineColor, outlineWidth: getComputedStyle(entry.target).outlineWidth })) });
        if (performance.now() - start < ms) requestAnimationFrame(frame); else probe.done = true;
      }; requestAnimationFrame(frame);
    };
  }, ms);
}
async function collect(label: string, durations = [180, 700]) {
  await page!.waitForFunction(() => (window as any).__probe?.done, {}, { timeout: 12000 });
  const result = await page!.evaluate(() => ({ samples: (window as any).__probe.samples,
    effects: (window as any).__effects.map((entry: any) => ({ key: entry.key, duration: entry.duration, finishedTime: entry.finishedTime,
      state: entry.animation.playState, iterations: entry.animation.effect.getTiming().iterations, fill: entry.animation.effect.getTiming().fill })) }));
  writeFileSync(resolve(output, `probe-${label}.json`), JSON.stringify(result, null, 2));
  assert.deepEqual(result.effects.map((entry: any) => entry.duration).sort((a: number, b: number) => a - b), [...durations].sort((a,b) => a-b), label);
  result.effects.forEach((entry: any, index: number) => {
    assert.equal(entry.finishedTime, entry.duration, label + ' actual native finish');
    assert.equal(entry.state, 'idle'); assert.equal(entry.iterations, 1); assert.equal(entry.fill, 'none');
    const nearFullSample = result.samples.some((sample: any) => sample.effects[index]?.state === 'running' && sample.effects[index].time >= entry.duration - 60);
    if (!nearFullSample) samplingGaps.push({ label, key: entry.key, duration: entry.duration, kind: 'no-near-full-running-RAF-sample', exactNativeFinish: entry.finishedTime });
    if (entry.duration === 700) {
      assert.ok(new Set(result.samples.map((sample: any) => sample.effects[index]?.outline)).size >= 3, label + ' visible outline interpolation');
      assert.ok(result.samples.some((sample: any) => sample.effects[index]?.outlineWidth === '2px'));
    } else if (!result.samples.some((sample: any) => +sample.effects[index]?.opacity > .78 && +sample.effects[index]?.opacity < 1)) samplingGaps.push({ label, key: entry.key, duration: entry.duration, kind: 'no-intermediate-opacity-sample', exactNativeFinish: entry.finishedTime });
  });
  stages.push({ label, ...result });
}
async function staticNow(label: string) {
  await page!.waitForTimeout(150);
  const effects = await page!.evaluate(() => (window as any).__effects.map((entry: any) => ({ key: entry.key, duration: entry.duration })));
  assert.deepEqual(effects, [], label); stages.push({ label, effects });
}
async function accepted(path: string, action: () => unknown) {
  const response = page!.waitForResponse(candidate => new URL(candidate.url()).pathname === path && candidate.request().method() === 'GET');
  await action(); const result = await response; assert.equal(result.status(), 200); await result.finished();
  await page!.waitForTimeout(100);
}
async function visible(selector: string) {
  await page!.locator(selector).scrollIntoViewIfNeeded(); await page!.waitForTimeout(120);
}
try {
  if (mode === 'verify') for (let index = 0; index < 21; index++) addModel(`rank-${index}`, 'fixture', index + 1);
  await daemon.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  page = await browser.newPage({ viewport: { width: 1672, height: mode === 'paint' ? 941 : 1200 }, reducedMotion: mode === 'paint' ? 'reduce' : 'no-preference', timezoneId: 'Asia/Bangkok' });
  page.setDefaultTimeout(12000); page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url());
    const allowedReadPost = request.method() === 'POST' && url.pathname === '/api/model-row-trends';
    if (url.origin !== 'http://127.0.0.1:7816' || url.pathname.startsWith('/api/') && request.method() !== 'GET' && !allowedReadPost) { forbidden.push(request.method()+' '+url.pathname); return route.abort(); }
    return route.continue();
  });
  await page.addInitScript('globalThis.__name = value => value');
  await page.addInitScript(() => {
    (window as any).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
    localStorage.setItem('quotapulse-theme', 'dark'); localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    (window as any).__effects = [];
    (window as any).__longTasks = [];
    if (PerformanceObserver.supportedEntryTypes.includes('longtask')) new PerformanceObserver(list => { for (const entry of list.getEntries()) (window as any).__longTasks.push({start:entry.startTime,duration:entry.duration,name:entry.name}); }).observe({type:'longtask',buffered:true});
    const native = Element.prototype.animate;
    Element.prototype.animate = function(...args: Parameters<Element['animate']>) {
      const animation = native.apply(this, args);
      const key = this.getAttribute('data-model-pair-key') ?? this.getAttribute('data-project-selection-opener')
        ?? this.getAttribute('data-project-selection-detail') ?? (this.matches('.qp-model-detail-content') ? 'model-detail' : null);
      if (key !== null) {
        const entry: any = { key, target: this, duration: animation.effect!.getTiming().duration, animation, finishedTime: null };
        animation.addEventListener('finish', () => { entry.finishedTime = animation.currentTime; });
        (window as any).__effects.push(entry); (window as any).__startProbe?.();
      } return animation;
    };
  });
  await page.clock.setFixedTime(fixedNow);
  if (mode === 'paint') {
    const geometry: any[] = [];
    for (const route of ['models', 'projects', 'history']) {
      await page.goto(`http://127.0.0.1:7816/#${route}`); await page.getByTestId('production-'+route).waitFor();
      await page.locator(route === 'models' ? '[data-model-pair-key]' : route === 'projects' ? '.qp-project-card' : '[data-history-detail-rail]').first().waitFor();
      await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(1600);
      await page.screenshot({ path: resolve(output, route+'-paint.png'), animations: 'disabled' });
      geometry.push(await page.evaluate(route => ({ route, modelRows: [...document.querySelectorAll('[data-model-pair-key]')].map(e => ({ height: e.getBoundingClientRect().height, font: getComputedStyle(e.querySelector('td')!).fontSize })),
        historyCards: [...document.querySelectorAll('.qp-history-summary article')].map(e => e.getBoundingClientRect().height),
        historyTimelineBottom: document.querySelector('.qp-history-timeline')?.getBoundingClientRect().bottom,
        historyTableTop: document.querySelector('.qp-history-records')?.getBoundingClientRect().top,
        modelIcons: [...document.querySelectorAll('.qp-model-summary-icon>svg')].map(e => e.getAttribute('class')),
        projectMark: document.querySelector('.qp-project-top-mark')?.getBoundingClientRect().toJSON(),
        historyClose: document.querySelector('.qp-history-detail-close')?.getAttribute('aria-label') }), route));
    }
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    writeFileSync(resolve(output, 'paint.json'), JSON.stringify({ productionIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), geometry, errors, forbidden }, null, 2));
  } else {
    await page.goto('http://127.0.0.1:7816/#models?range=today&model=DeepSeek%20V4.1&selected_provider=deepseek');
    await page.locator('[data-model-pair-key]').first().waitFor(); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(250);
    await staticNow('models-initial-static'); assert.equal(await page.locator('[data-model-pair-key]').count(), 20);
    await visible('.qp-model-table-wrap'); await arm(); addModel('presence-new'); notify(); await modelRow('presence-new').waitFor();
    // Deliver the duplicate during the longer emphasis, after the short opacity entrance.
    await page.waitForTimeout(240);
    await accepted('/api/models', () => page!.evaluate(() => window.dispatchEvent(new Event('online'))));
    await collect('models-new-group-survives-actual-duplicate');
    await clear(); db.prepare("UPDATE usage_event SET total_tokens=900000000,input_tokens=900000000 WHERE model='rank-20'").run();
    await accepted('/api/models', notify); await modelRow('rank-20').waitFor(); await staticNow('models-existing-offpage-rank-promotion-static');
    await clear(); await page.locator('.qp-model-search input').fill('rank'); await page.locator('.qp-model-search input').fill(''); await staticNow('models-local-filter-restoration-static');
    // Client context loss seeds the next accepted real response.
    await accepted('/api/models', notify); await clear();
    await arm(); addModel('presence-provider', 'one', 1_000_000_000); notify(); await modelRow('presence-provider', 'one').waitFor(); await collect('models-exact-new-pair');
    await arm(); addModel('presence-provider', 'two', 1_100_000_000); notify(); await modelRow('presence-provider', 'two').waitFor(); await collect('models-same-model-distinct-recorded-provider');
    // Hold a real response across actual viewport eligibility loss and restoration.
    let captured!: () => void; const held = new Promise<void>(done => { captured = done; }), released = new Promise<void>(done => { releaseHeld = done; }); let once = true;
    const pattern = '**/api/models?**';
    await page.route(pattern, async route => { if (!once) return route.continue(); once = false; const response = await route.fetch(); captured(); await released; await route.fulfill({ response }); });
    await clear(); addModel('presence-held', 'fixture', 1_200_000_000); notify();
    await Promise.race([held, page.waitForTimeout(12000).then(() => { throw Error('Actual aggregate response not held'); })]);
    await page.setViewportSize({ width: 1672, height: 180 }); await page.evaluate(() => document.querySelector('main')?.scrollTo(0, 0));
    await page.waitForFunction(() => document.querySelector('.qp-model-table-wrap')!.getBoundingClientRect().top >= innerHeight); await page.waitForTimeout(120);
    await page.setViewportSize({ width: 1672, height: 1200 }); await visible('.qp-model-table-wrap'); releaseHeld!(); releaseHeld = undefined;
    await modelRow('presence-held').waitFor(); await staticNow('models-held-response-crossing-offscreen-epoch-static'); await page.unroute(pattern);
    await clear(); addModel('presence-first-restored', 'fixture', 1_300_000_000); await accepted('/api/models', notify); await modelRow('presence-first-restored').waitFor(); await staticNow('models-first-restored-response-seeds');
    await arm(); addModel('presence-restored', 'fixture', 1_400_000_000); notify(); await modelRow('presence-restored').waitFor(); await collect('models-fresh-after-restoration');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await clear(); addModel('presence-reduced', 'fixture', 1_500_000_000); await accepted('/api/models', notify); await modelRow('presence-reduced').waitFor(); await staticNow('models-reduced-static');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(120); await clear(); addModel('presence-reduced-seed', 'fixture', 1_600_000_000); await accepted('/api/models', notify); await staticNow('models-preference-restoration-seeds');
    await arm(); addModel('presence-active-unmount', 'fixture', 1_700_000_000); notify(); await modelRow('presence-active-unmount').waitFor();
    await page.waitForFunction(() => (window as any).__effects.some((entry: any) => entry.duration === 700 && entry.animation.playState === 'running'));
    await page.evaluate(() => { location.hash = '#projects?range=today&project=QuotaPulse'; }); await page.locator('.qp-project-card').first().waitFor();
    assert.ok(await page.evaluate(() => (window as any).__effects.every((entry: any) => entry.animation.playState === 'idle' && !entry.target.isConnected)), 'Active Models work cancels at unmount');
    stages.push({ label: 'models-active-unmount', passed: true });
    await page.waitForTimeout(200); await clear(); await staticNow('projects-initial-static'); await arm(); addProject('Presence project'); notify(); await card('Presence project').waitFor();
    await accepted('/api/projects', () => page!.evaluate(() => window.dispatchEvent(new Event('online')))); await collect('projects-new-group-survives-actual-duplicate');
    await clear(); db.prepare("UPDATE usage_event SET total_tokens=1800000000,input_tokens=1800000000 WHERE session_id=104").run(); await accepted('/api/projects', notify); await staticNow('projects-existing-metric-reorder-static');
    await clear(); await page.locator('.qp-project-search input').fill('QuotaPulse'); await page.locator('.qp-project-search input').fill(''); await staticNow('projects-search-restoration-static');
    await accepted('/api/projects', notify); await clear();
    await arm(); addProject('', 1_900_000_000); notify(); await page.waitForFunction(() => [...document.querySelectorAll('[data-project-selection-role=card]')].some(e => e.getAttribute('data-project-selection-opener') === '\"\"')); await collect('projects-empty-string-exact-identity');
    await arm(); addProject(null, 2_000_000_000); notify(); await page.waitForFunction(() => [...document.querySelectorAll('[data-project-selection-role=card]')].some(e => e.getAttribute('data-project-selection-opener') === 'null')); await collect('projects-null-distinct-from-empty');
    await page.emulateMedia({ reducedMotion: 'reduce' }); await clear(); addProject('Reduced project', 2_100_000_000); await accepted('/api/projects', notify); await card('Reduced project').waitFor(); await staticNow('projects-reduced-static');
    await page.emulateMedia({ reducedMotion: 'no-preference' }); await page.waitForTimeout(120); await clear(); addProject('Restored seed project', 2_200_000_000); await accepted('/api/projects', notify); await staticNow('projects-preference-restoration-seeds');
    await arm(); addProject('Intent project', 2_300_000_000); notify(); await card('Intent project').waitFor();
    await page.waitForFunction(() => (window as any).__effects.some((entry: any) => entry.duration === 700 && entry.animation.playState === 'running'));
    const prior = await page.evaluate(() => { (window as any).__interruptedPresence = [...(window as any).__effects]; return (window as any).__effects.length; }); assert.equal(prior, 2);
    await arm(); await card('Intent project').focus(); await page.keyboard.press('Enter'); await collect('projects-explicit-selection-owns-target', [180, 700, 180, 700]);
    assert.ok(await page.evaluate(() => (window as any).__interruptedPresence.every((entry: any) => entry.animation.playState === 'idle')), 'Explicit user selection cancels same-target presence');
    await page.screenshot({ path: resolve(output, 'projects-verified.png') });
    assert.deepEqual(errors, []); assert.deepEqual(forbidden, []);
    writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256: sha(readFileSync(resolve(root, 'packages/web/dist/index.html'))), browser: browser.version(), scope: 'Compiled synthetic aggregate API/SSE; new accepted group presence, not individual call or ingestion recency', finiteDurationAndSemanticsPassed:true, visualSamplingComplete:samplingGaps.length===0, samplingGaps, longTasks:await page.evaluate(()=>(window as any).__longTasks), stages, errors, forbidden }, null, 2));
    console.log('Aggregate presence exact native durations/identity/lifecycle passed; unresolved visual sampling diagnostics: '+samplingGaps.length);
  }
} catch (error) {
  if (page && !page.isClosed()) {
    await page.screenshot({ path: resolve(output, 'failure.png') }).catch(() => {});
    writeFileSync(resolve(output, 'failure.json'), JSON.stringify({ error: String((error as Error).stack ?? error), stages,
      effects: await page.evaluate(() => (window as any).__effects.map((entry: any) => ({ key: entry.key, duration: entry.duration, time: entry.animation.currentTime, state: entry.animation.playState, finishedTime: entry.finishedTime }))).catch(() => null) }, null, 2));
  } throw error;
} finally { releaseHeld?.(); await browser?.close(); await daemon.close(); db.close(); globalThis.Date = realDate; process.env.TZ = priorTimezone; }
