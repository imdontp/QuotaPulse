/** Static canonical reference capture. Isolated synthetic DB, compiled application, no user data. */
import assert from 'node:assert/strict';
import { installBrowserFixedDate } from '../scripts/browser-fixed-date.mjs';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, type Page, type Request } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'tmp/feed113/'+(process.env.QUOTAPULSE_FEED_VARIANT??'canonical'));
const referenceRoot = 'C:/Users/TH12367283/Downloads/quotapulse_build_blueprint';
const priorTimezone = process.env.TZ;
process.env.TZ = 'Asia/Bangkok';
mkdirSync(output, { recursive: true });

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
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const indexPath = resolve(root, 'packages/web/dist/index.html');
const productionIndexSha256 = sha(readFileSync(indexPath));
const rendererArgs = ['--disable-gpu', '--deterministic-mode', '--disable-skia-runtime-opts', '--force-color-profile=srgb'];
const referenceManifest = JSON.parse(readFileSync(resolve(referenceRoot, 'reference_manifest.json'), 'utf8'));
const targets = { overview: '.qp-activity-item', live: '.qp-live-chart', projects: '.qp-project-trend', models: '.qp-model-trend', history: '[data-testid="usage-history"] tbody tr', alerts: '.qp-quota-point', providers: '.qp-provider-health tbody tr', cost: '.qp-cost-chart' };
const results: unknown[] = [];
try {
  await daemon.listen({ host: '127.0.0.1', port: 7816 });
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: rendererArgs });
  for (const [routeName, readySelector] of Object.entries(targets)) {
    if(process.env.QUOTAPULSE_FEED_VARIANT&&routeName!=='live')continue;
    const entry = referenceManifest.references.find((entry: { file: string }) => entry.file === `refs/${routeName}.png`);
    assert.ok(entry, routeName);
    const reference = readFileSync(resolve(referenceRoot, entry.file));
    assert.equal(sha(reference), entry.sha256, `${routeName} original reference hash`);
    assert.equal(reference.readUInt32BE(16), entry.width); assert.equal(reference.readUInt32BE(20), entry.height);
    const context = await browser.newContext({ viewport: { width: entry.width, height: entry.height }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok', colorScheme: 'dark' });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors: string[] = [], forbidden: string[] = [], pending = new Set<Request>();
    let streams = 0;
    const modelReads:Promise<unknown>[]=[];
    page.on('response',response=>{const url=new URL(response.url());if(url.pathname==='/api/models'&&url.searchParams.get('detailed')==='1'&&response.status()===200)modelReads.push(response.body().then(bytes=>{const data=JSON.parse(bytes.toString());return{url:url.pathname+url.search,bytes:bytes.length,breakdown:data.breakdown??null,hasRows:Object.hasOwn(data,'rows'),groups:data.groups.length,tokens:data.totals.tokens};}));});
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.includes('/events/stream')) streams++;
      else if (path.startsWith('/api/')) pending.add(request);
    });
    page.on('requestfinished', request => pending.delete(request)); page.on('requestfailed', request => pending.delete(request));
    await page.route('**/*', route => {
      const request = route.request(), url = new URL(request.url());
      const readPost = request.method() === 'POST' && url.pathname === '/api/model-row-trends';
      if (url.origin !== 'http://127.0.0.1:7816' || url.pathname.startsWith('/api/') && request.method() !== 'GET' && !readPost) {
        forbidden.push(`${request.method()} ${url.origin}${url.pathname}`); return route.abort();
      }
      return route.continue();
    });
    await page.addInitScript(() => {
      (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
      localStorage.setItem('quotapulse-theme', 'dark');
    });
    await installBrowserFixedDate(page, fixedNow);
    await page.goto(`http://127.0.0.1:7816/#${routeName}${routeName === 'cost' ? '?range=month' : ''}`, { waitUntil: 'domcontentloaded' });
    await page.getByTestId(`production-${routeName}`).waitFor(); await page.locator(readySelector).first().waitFor();
    await page.waitForFunction(() => /^\d[\d,]*$/.test(document.querySelector('[data-stat=models]')?.textContent ?? ''));
    if (routeName === 'history') await page.locator('[data-history-detail-rail]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    const deadline = performance.now() + 30000; let idle = 0;
    while (idle < 12) { assert.ok(performance.now() < deadline, `${routeName} API did not settle`); await page.waitForTimeout(40); idle = pending.size === 0 ? idle + 1 : 0; }
    await page.evaluate(() => { document.activeElement instanceof HTMLElement && document.activeElement.blur(); window.scrollTo(0, 0); document.querySelector('.qp-sidebar')!.scrollTop = 0; });
    await page.mouse.move(0, 0); await page.waitForTimeout(150);
    const geometry = await page.evaluate(() => {
      const main = document.querySelector('.qp-redesign main')!;
      const nav = document.querySelector('.qp-sidebar nav')!;
      return {
        viewport: { width: innerWidth, height: innerHeight }, pageOverflow: document.documentElement.scrollWidth > innerWidth,
        main: main.getBoundingClientRect().toJSON(), sidebar: document.querySelector('.qp-sidebar')!.getBoundingClientRect().toJSON(), quickStats: document.querySelector('.qp-quick-stats')!.getBoundingClientRect().toJSON(),
        moreOpen: document.querySelector('.qp-nav-more')!.hasAttribute('open'),
        mainRegions: [...main.children].map(element => ({ tag: element.tagName, className: element.className, ...element.getBoundingClientRect().toJSON() })),
        navigationOrder: [...nav.children].flatMap(element => element.matches('.qp-nav-secondary') ? [element.querySelector(':scope > a span')!.textContent!.trim()] : element.tagName === 'A' ? [element.querySelector('span')!.textContent!.trim()] : []),
        headings: [...main.querySelectorAll('h1,h2')].map(element => ({ text: element.textContent, ...element.getBoundingClientRect().toJSON(), fontSize: getComputedStyle(element).fontSize, fontWeight: getComputedStyle(element).fontWeight })),
      };
    });
    assert.equal(geometry.pageOverflow, false, `${routeName} page overflow`); assert.equal(geometry.moreOpen, false);
    if(routeName==='overview'){
      const rows=await page.locator('.qp-quota').evaluateAll(elements=>elements.map(element=>{const fill=element.querySelector('.qp-bar>span')!;return{owner:element.getAttribute('data-owner'),window:element.getAttribute('data-window'),text:element.textContent,aria:element.getAttribute('aria-label'),selected:element.getAttribute('aria-pressed'),stale:element.getAttribute('data-stale'),rect:element.getBoundingClientRect().toJSON(),fillRect:fill.getBoundingClientRect().toJSON(),fillStyle:fill.getAttribute('style'),background:getComputedStyle(fill).backgroundImage,numberColor:getComputedStyle(element.querySelector('.qp-quota-number strong')!).color}}));
      writeFileSync(resolve(output,'quota-rows.json'),JSON.stringify(rows,null,2));
    }
    if(routeName==='live'){
      const rows=await page.locator('.qp-live-feed li').evaluateAll(elements=>elements.map(element=>({identity:element.getAttribute('data-live-record'),grain:element.getAttribute('data-grain'),text:element.textContent,rect:element.getBoundingClientRect().toJSON(),children:Array.from(element.children).map(child=>({tag:child.tagName,text:child.textContent,title:child.getAttribute('title'),dateTime:child.getAttribute('datetime'),rect:child.getBoundingClientRect().toJSON()}))})));
      writeFileSync(resolve(output,'feed-rows.json'),JSON.stringify(rows,null,2));
    }
    const first = await page.screenshot({ path: resolve(output, `${routeName}.png`), animations: 'disabled' });
    await page.waitForTimeout(150);
    const repeat = await page.screenshot({ path: resolve(output, `${routeName}-repeat.png`), animations: 'disabled' });
    assert.deepEqual(errors, [], `${routeName} browser errors`); assert.deepEqual(forbidden, [], `${routeName} forbidden requests`);
    results.push({ route: routeName, viewport: { width: entry.width, height: entry.height }, referenceSha256: entry.sha256, sha256: sha(first), repeatSha256: sha(repeat), repeatIdentical: first.equals(repeat), geometry, errors, forbidden, totalStreamRequests: streams });
    console.log(`Captured ${routeName} ${entry.width}x${entry.height}; repeat identical=${first.equals(repeat)}`);

    const headingGeometry=await page.locator('main h1,main h2,.qp-overview-heading-title').evaluateAll(elements=>elements.map(element=>{
      const css=getComputedStyle(element);const ranges=[];for(const child of element.childNodes){if(child.nodeType!==Node.TEXT_NODE||!child.textContent?.trim())continue;const range=document.createRange();range.selectNodeContents(child);ranges.push(...[...range.getClientRects()].map(rect=>rect.toJSON()));}
      return {text:element.textContent,className:element.className,tag:element.tagName,rect:element.getBoundingClientRect().toJSON(),ranges,font:css.font,tracking:css.letterSpacing,color:css.color,shadow:css.textShadow,transform:css.transform};
    }));
    writeFileSync(resolve(output,routeName+'-heading-geometry.json'),JSON.stringify(headingGeometry,null,2));
    writeFileSync(resolve(output,routeName+'-model-requests.json'),JSON.stringify(await Promise.all(modelReads),null,2));
    await context.close();
  }
  assert.equal(sha(readFileSync(indexPath)), productionIndexSha256, 'Build changed while capturing');
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ productionIndexSha256, browser: browser.version(), language: 'en', theme: 'dark', deviceScaleFactor: 1, reducedMotion: 'reduce', rendererArgs, fixture: 'same isolated in-memory synthetic fixture as v1.85.95', scope: 'Current compiled application screenshots and geometry; unapproved concept parity', results }, null, 2));
} finally { await browser?.close(); await daemon.close(); db.close(); globalThis.Date = realDate; process.env.TZ = priorTimezone; }
