import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { _electron } from 'playwright';
import { openDb } from '../packages/daemon/src/db/index.js';
import { buildServer } from '../packages/daemon/src/api/server.js';
import { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'screens/desktop-runtime');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const profiles = resolve(root, 'tmp/desktop-runtime');
mkdirSync(profiles, { recursive: true });
const userData = mkdtempSync(resolve(profiles, 'profile-'));
const db = openDb(':memory:');
const now = Date.now();
db.exec(`INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_state,account_last_success_at)
  VALUES (1,'codex','synthetic','/synthetic/nonexistent','Desktop fixture',0,'openai:subscription','openai','active',${now});
  INSERT INTO session(id,source_id,native_session_id,project,last_seen_at) VALUES (1,1,'desktop-test','Desktop project',${now});
  INSERT INTO usage_event(source_id,session_id,dedup_key,ts,model,provider,total_tokens,call_count,cost_usd,cost_source)
  VALUES (1,1,'desktop-test',${now},'gpt-test','openrouter',100,1,0.02,'computed');
  INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin)
  VALUES (1,'5h',38,${now + 7200000},${now},${now},${now},'desktop-synthetic');`);
const scheduler = new Scheduler(db, [], { pollMs: 1000000, detectMs: 1000000 });
const daemon = buildServer(db, scheduler, { token: 'synthetic-desktop-test', port: 7803, webRoot: resolve(root, 'packages/web/dist') });
let desktop: Awaited<ReturnType<typeof _electron.launch>> | undefined;
try {
  await daemon.listen({ host: '127.0.0.1', port: 7803 });
  desktop = await _electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [resolve(root, 'scripts/desktop-runtime-entry.cjs')],
    env: { ...process.env, ELECTRON_RUN_AS_NODE: undefined, QP_DESKTOP_TEST_ROOT: root, QP_DESKTOP_TEST_URL: 'http://127.0.0.1:7803', QP_DESKTOP_TEST_USER_DATA: userData } });
  await desktop.firstWindow();
  // Electron can attach the smaller popup first, irrespective of construction order.
  const deadline = performance.now() + 30000;
  while (performance.now() < deadline && !desktop.windows().some(page => page.url() === 'http://127.0.0.1:7803/#overview')) await delay(50);
  const dashboard = desktop.windows().find(page => page.url() === 'http://127.0.0.1:7803/#overview');
  assert.ok(dashboard, 'dashboard window did not navigate to its production URL');
  await dashboard.getByTestId('production-overview').locator('.qp-metrics strong').first().waitFor();
  await dashboard.waitForFunction(() => typeof (window as any).qpDashboard?.ready === 'function');
  const popup = desktop.windows().find(page => page !== dashboard) ?? await desktop.waitForEvent('window');
  await popup.locator('.pet-popup .quota-card').first().waitFor();
  assert.equal(await popup.getByTestId('production-overview').count(), 0, 'popup hash incorrectly selected redesign dashboard');
  assert.equal(await popup.evaluate(() => typeof (window as any).qpPopup?.openDashboard), 'function');
  assert.equal(await dashboard.evaluate(() => typeof (window as any).require), 'undefined');
  assert.equal(await popup.evaluate(() => typeof (window as any).require), 'undefined');
  await dashboard.screenshot({ path: resolve(output, 'dashboard-production.png') });
  await popup.screenshot({ path: resolve(output, 'popup-production.png') });
  const trigger = dashboard.locator('.qp-topbar button[aria-haspopup=dialog]');
  await trigger.click();
  const palette = dashboard.locator('.qp-command-dialog'); await palette.waitFor();
  assert.equal(await palette.evaluate(element => element.matches(':modal')), true);
  const search = palette.getByRole('searchbox');
  await search.focus(); await dashboard.keyboard.press('Shift+Tab');
  assert.equal(await palette.locator('button').last().evaluate(element => element === document.activeElement), true);
  await dashboard.keyboard.press('Tab');
  assert.equal(await search.evaluate(element => element === document.activeElement), true);
  await dashboard.evaluate(() => (document.querySelector('.qp-sidebar a') as HTMLElement).focus());
  assert.equal(await search.evaluate(element => element === document.activeElement), true);
  await dashboard.keyboard.press('Escape'); await palette.waitFor({ state: 'hidden' });
  assert.equal(await trigger.evaluate(element => element === document.activeElement), true);
  await dashboard.locator('.qp-tools button').first().click();
  await dashboard.waitForFunction(() => document.documentElement.lang === 'th');
  await dashboard.evaluate(() => document.fonts.ready);
  const cdp = await dashboard.context().newCDPSession(dashboard);
  let thaiFont;
  try {
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.qp-sidebar nav a span' });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    thaiFont = fonts.find(font => font.familyName === 'Noto Sans Thai');
    assert.ok(thaiFont && thaiFont.isCustomFont && thaiFont.glyphCount > 0, 'Electron Thai label must use the bundled custom font');
  } finally { await cdp.detach(); }
  await dashboard.screenshot({ path: resolve(output, 'dashboard-production-thai.png') });
  await dashboard.locator('.qp-tools button').first().click();
  await dashboard.waitForFunction(() => document.documentElement.lang === 'en');
  await popup.getByRole('button', { name: 'Open dashboard', exact: true }).click();
  await popup.locator('.pet-popup-close').click();
  await dashboard.goto('http://127.0.0.1:7803/#sessions?range=all');
  await dashboard.getByTestId('production-history').getByTestId('history-total-tokens').waitFor();
  assert.equal(new URL(dashboard.url()).hash, '#history?range=all');
  const evidence = await desktop.evaluate(({ BrowserWindow, app }) => ({
    state: (globalThis as any).qpDesktopEvidence,
    userData: app.getPath('userData'),
    windows: BrowserWindow.getAllWindows().map(win => ({ visible: win.isVisible(), preferences: win.webContents.getLastWebPreferences() })),
    versions: process.versions,
  }));
  assert.equal(evidence.userData, userData);
  assert.ok(evidence.state.ready.includes('qp-dashboard-ready'));
  assert.ok(evidence.state.ready.includes('qp-popup-ready'));
  assert.ok(evidence.state.actions.includes('qp-popup-open-dashboard'));
  assert.ok(evidence.state.actions.includes('qp-popup-close'));
  assert.deepEqual(evidence.state.preloadErrors, []);
  assert.deepEqual(evidence.state.blocked, []);
  for (const win of evidence.windows) {
    assert.equal(win.visible, false);
    assert.equal(win.preferences.sandbox, true);
    assert.equal(win.preferences.contextIsolation, true);
    assert.equal(win.preferences.nodeIntegration, false);
  }
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ status: 'passed', host: 'isolated hidden Electron windows', database: 'in-memory synthetic',
    checks: ['built dashboard', 'built popup with hash override', 'real compiled sandboxed preloads', 'renderer ready IPC', 'popup dashboard/close IPC', 'legacy sessions alias', 'isolated user data', 'native command modal and keyboard isolation', 'bundled custom Thai font and language switching', 'no external requests'], thaiFont,
    limitations: ['fixture main process; installed tray/main lifecycle not exercised', 'not an installer or packaged application release', 'no scheduled tasks, tray registration or live readers'], evidence }, null, 2));
  console.log('Desktop runtime passed: isolated dashboard/popup, compiled preloads and readiness/action IPC.');
} catch (error) {
  if (desktop) {
    const state = await desktop.evaluate(({ BrowserWindow }) => ({ evidence: (globalThis as any).qpDesktopEvidence, windows: BrowserWindow.getAllWindows().map(win => ({ url: win.webContents.getURL(), loading: win.webContents.isLoading() })) }));
    console.log('Desktop failure evidence:', JSON.stringify(state));
    for (const [index, page] of desktop.windows().entries()) writeFileSync(resolve(output, `failure-window-${index}.html`), await page.content());
  }
  throw error;
} finally {
  await desktop?.close();
  await daemon.close();
  db.close();
}
