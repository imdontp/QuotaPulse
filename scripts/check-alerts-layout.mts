import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser } from 'playwright';
import type { DB } from '../packages/daemon/src/db/index.js';
import type { Scheduler } from '../packages/daemon/src/ingest/scheduler.js';
import { recordQuotaAlerts } from '../packages/daemon/src/api/queries.js';
import { en } from '../packages/web/src/i18n/en.ts';
import { th } from '../packages/web/src/i18n/th.ts';

/** Called after existing History/Cost flows; every inserted row is synthetic. */
export async function checkAlertsLayout(browser: Browser, db: DB, output: string, errors: string[], scheduler: Scheduler) {
  const captures: unknown[] = [];
  const now = Date.now();
  const source = db.prepare("INSERT INTO source(id,harness,profile,root_path,display_name,detected_at,account_key,account_provider,account_display_name,account_state,account_last_success_at) VALUES (?,'codex',?,'/synthetic/nonexistent',?,0,?,'openai',?,'active',?)");
  const sample = db.prepare("INSERT INTO limit_sample(source_id,window_kind,used_percent,resets_at,observed_at,last_seen_at,source_fetched_at,origin) VALUES (?,'5h',?,?,?,?,?,'alerts-occupied')");
  for (let index = 0; index < 4; index++) {
    source.run(400 + index, `alerts-${index}`, `Quota reader ${index}`, `quota:fixture-${index}`, `Quota owner ${index}`, now);
    const values = index === 0 ? [0, null, 45, 97] : index === 1 ? [85] : index === 2 ? [55] : [null];
    values.forEach((value, i) => { const at = now - (values.length - i) * 15_000; sample.run(400 + index, value, now + 7200000, at, at, at); });
  }
  recordQuotaAlerts(db, now);
  try {
    for (const lang of ['en', 'th'] as const) for (const theme of ['dark', 'light'] as const) {
      const messages = lang === 'en' ? en : th;
      const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', deviceScaleFactor: 1, timezoneId: 'Asia/Bangkok' });
      try {
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
        await page.addInitScript(({ lang, theme }) => {
          (window as unknown as { __QUOTAPULSE_TOKEN__: string }).__QUOTAPULSE_TOKEN__ = 'history-test';
          localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
          localStorage.setItem('quotapulse-theme', theme);
        }, { lang, theme });
        await page.goto('http://127.0.0.1:7801/#alerts?owner=quota%3Afixture-0&window=5h', { waitUntil: 'domcontentloaded', timeout: 60000 });
        const screen = page.getByTestId('production-alerts');
        await screen.getByRole('heading', { name: messages['redesign.alertHeading'], exact: true }).waitFor();
        await screen.locator('.qp-quota-point').nth(2).waitFor();
        await page.locator('.qp-quick-stats [data-stat=namedProjects]').getByText('1', { exact: true }).waitFor();
        await page.evaluate(() => document.fonts.ready);
        const currentRiskCount = screen.locator('[data-summary="redesign.alertCurrent"] strong');
        await currentRiskCount.waitFor({ state: 'visible' });
        const expectedRiskCount = (await currentRiskCount.textContent())!.trim();
        const alertsLink = page.locator('.qp-sidebar nav a[href="#alerts"]');
        assert.equal(await alertsLink.locator('.qp-nav-count').textContent(), expectedRiskCount, 'Sidebar badge and Alerts summary must share the current risk count');
        assert.equal(await alertsLink.locator('.qp-nav-count').getAttribute('aria-hidden'), 'true');
        assert.ok((await alertsLink.getAttribute('aria-label'))!.includes(`${messages['redesign.currentQuotaRisks']}: ${expectedRiskCount}`));
        assert.equal(await screen.locator('.qp-quota-point').count(), 3, 'Unknown sample has a plotted numeric value');
        assert.equal(await screen.locator('.qp-quota-series').count(), 1, 'Series connects through unknown sample');
        assert.equal(await screen.locator('.qp-alert-rules>div span').count(), 3);
        assert.equal(await page.locator('.qp-sidebar nav a').count(), 9);
        assert.equal(await page.locator('.qp-quick-stats [data-stat=models]').textContent(), '2');
        assert.equal(await page.locator('.qp-quick-stats [data-stat=providers]').textContent(), '2');
        const chart = await screen.locator('.qp-alert-segments').evaluate(node => {
          const box = node.getBoundingClientRect();
          return { width: box.width, viewWidth: node.getAttribute('viewBox')!.split(' ').map(Number)[2], points: Array.from(node.querySelectorAll('circle')).map(point => ({ x: +point.getAttribute('cx')!, y: +point.getAttribute('cy')! })) };
        });
        assert.ok(Math.abs(chart.width - chart.viewWidth) <= 1, 'Quota chart uses stretched coordinates');
        assert.equal(chart.points[0].y, 104, 'Zero quota was raised above baseline');
        const regions = await screen.evaluate(node => Object.fromEntries(['.qp-alert-header', '.qp-alert-summary', '.qp-alert-chart', '.qp-alert-risk', '.qp-alert-rules', '.qp-alert-forecast', '.qp-alert-guidance', '.qp-alert-history'].map(selector => {
          const { x, y, width, height, bottom } = node.querySelector(selector)!.getBoundingClientRect(); return [selector, { x, y, width, height, bottom }];
        })));
        // refs/alerts.png places the forecast beside the heading at y72;
        // the summary belongs below that heading within the left column.
        assert.equal(regions['.qp-alert-header'].y, regions['.qp-alert-forecast'].y, 'Forecast is not beside heading');
        assert.ok(regions['.qp-alert-summary'].y >= regions['.qp-alert-header'].bottom, 'Summary overlaps heading');
        assert.ok(regions['.qp-alert-forecast'].x >= regions['.qp-alert-summary'].x + regions['.qp-alert-summary'].width, 'Forecast overlaps summary column');
        assert.ok(regions['.qp-alert-rules'].bottom < 941, `${lang}/${theme}: rules outside viewport: ${JSON.stringify(regions)}`);
        assert.ok(regions['.qp-alert-history'].bottom < 941, `${lang}/${theme}: history outside viewport: ${JSON.stringify(regions)}`);
        const filename = `alerts-occupied-${lang}-${theme}.png`;
        await page.screenshot({ path: resolve(output, filename), animations: 'disabled' });
        captures.push({ lang, theme, filename, chart, regions });
        const riskList = screen.locator('.qp-alert-risk ul');
        assert.equal(await riskList.count(), 1, 'Risks and reader advisories must share one bounded list');
        await riskList.focus(); await page.keyboard.press('End');
        await page.waitForFunction(() => {
          const list = document.querySelector('.qp-alert-risk ul');
          const last = list?.lastElementChild;
          return !!list && !!last && last.getBoundingClientRect().bottom <= list.getBoundingClientRect().bottom + 1;
        });
        const samples = screen.locator('.qp-quota-samples');
        await samples.locator('summary').focus(); await page.keyboard.press('Enter');
        await samples.locator('tbody tr').nth(3).waitFor();
        assert.equal(await samples.locator('tbody tr').nth(1).locator('td').nth(1).textContent(), messages['redesign.unknownValue']);
        await page.keyboard.press('Enter');
        for (const width of [390, 900, 1280]) {
          await page.setViewportSize({ width, height: 941 });
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${lang}/${theme}/${width}: Alerts overflow`);
        }
        if (lang === 'en' && theme === 'dark') {
          const originalUrl = page.url();
          await page.locator('.qp-skip').focus(); await page.keyboard.press('Enter');
          assert.equal(await page.evaluate(() => document.activeElement?.id), 'alerts', 'Skip link did not focus main');
          assert.equal(page.url(), originalUrl, 'Skip link changed route filters');
          await page.route('**/api/runtime-summary', route => route.fulfill({ status: 503, json: { error: 'Synthetic summary outage' } }));
          scheduler.emit('data', { newEvents: 0, newLimits: 0, durationMs: 0, trigger: 'poll', results: [] });
          await page.locator('.qp-quick-stats[data-stale=true]').waitFor();
          assert.equal(await page.locator('.qp-quick-stats [data-stat=models]').textContent(), '2', 'Summary failure erased known counts');
          await page.unroute('**/api/runtime-summary');
          scheduler.emit('data', { newEvents: 0, newLimits: 0, durationMs: 0, trigger: 'poll', results: [] });
          await page.locator('.qp-quick-stats[data-stale=false]').waitFor();
          const at = Date.now();
          const update = sample.run(400, 0, now + 7200000, at, at, at);
          // The empty adapter list intentionally cannot detect these sources.
          // Emit a real SSE data event after inserting a new recorded sample.
          scheduler.emit('data', { newEvents: 0, newLimits: 1, durationMs: 0, trigger: 'poll', results: [] });
          await screen.locator('.qp-quota-point').nth(3).waitFor();
          assert.equal(await screen.locator('.qp-quota-reset').count(), 1, 'Same-owner refresh did not include counter drop');
          db.prepare('DELETE FROM limit_sample WHERE id=?').run(update.lastInsertRowid);
        }
        if (lang === 'th' && theme === 'light') {
          await page.setViewportSize({ width: 390, height: 941 });
          await screen.locator('.qp-alert-chart select').selectOption(JSON.stringify(['quota:fixture-3', '5h']));
          await page.waitForFunction(() => document.querySelector('.qp-quota-samples')?.textContent?.includes('(1)'));
          assert.equal(await screen.locator('.qp-quota-point').count(), 0, 'Unknown-only owner drew a zero reading');
          await page.screenshot({ path: resolve(output, 'alerts-unknown-th-light-390.png'), fullPage: true });
        }
      } finally { await page.close(); }
    }
  } finally {
    db.exec('DELETE FROM alert_event WHERE source_id BETWEEN 400 AND 403; DELETE FROM limit_sample WHERE source_id BETWEEN 400 AND 403; DELETE FROM source WHERE id BETWEEN 400 AND 403;');
  }
  writeFileSync(resolve(output, 'alerts-occupied-layout.json'), JSON.stringify({ database: 'in-memory synthetic', fixture: { addedOwners: 4, selectedValues: [0, null, 45, 97] }, checks: ['sidebar current-risk badge matches Alerts summary in en/th and dark/light', 'accessible badge label discloses current quota risks; not unread count', 'forecast beside heading; summary contained below without overlap', 'complete rules/history in concept viewport', 'unknown sample breaks lines', 'known zero baseline', 'timestamp coordinates', 'keyboard sample table', 'same-owner refresh includes counter drop', '390/900/1280 overflow', 'unknown-only owner', 'machine-wide Quick Stats'], captures }, null, 2));
}
