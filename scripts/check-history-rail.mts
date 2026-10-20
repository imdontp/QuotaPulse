/** Real compiled History composition and keyboard checks; synthetic API only. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Browser } from 'playwright';

export async function checkHistoryRail(browser: Browser, output: string, fixedNow: number) {
  const results: unknown[] = [];
  for (const lang of ['en', 'th']) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1672, height: 941 }, reducedMotion: 'reduce', timezoneId: 'Asia/Bangkok' });
    const errors: string[] = [];
    await page.addInitScript('globalThis.__name = value => value');
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(({ lang, theme }) => {
      (window as any).__QUOTAPULSE_TOKEN__ = 'stable-capture-test';
      localStorage.setItem('quotapulse-theme', theme);
      localStorage.setItem('quotapulse-prefs', JSON.stringify({ lang, currency: 'USD', rate: 1, hiddenSubscriptions: [] }));
    }, { lang, theme });
    await page.clock.setFixedTime(fixedNow);
    try {
      for (const width of [1672, 1440, 1280, 1279, 900, 390]) {
        await page.setViewportSize({ width, height: 941 });
        await page.goto(`http://127.0.0.1:7816/?rail94=${lang}-${theme}-${width}#history?range=today`);
        const rail = page.locator('[data-history-detail-rail]');
        await rail.waitFor(); await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.locator('dialog[aria-labelledby=history-detail-title]').count(), 0, 'Redesign renders no modal or inert top layer');
        const initial = await rail.evaluate(element => ({
          rect: element.getBoundingClientRect().toJSON(), position: getComputedStyle(element).position,
          focusInside: element.contains(document.activeElement), scroll: document.querySelector('main')?.scrollTop,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          topLayer: document.querySelectorAll(':modal').length,
          tableMargin: getComputedStyle(document.querySelector('[data-testid=usage-history]')!).marginRight,
        }));
        assert.equal(initial.focusInside, false, 'Initial real-row selection does not steal focus');
        assert.equal(initial.topLayer, 0); assert.equal(initial.pageOverflow, false);
        if (width >= 1280) {
          assert.equal(initial.position, 'fixed'); assert.equal(initial.rect.width, 288);
          assert.equal(initial.tableMargin, '296px'); assert.equal(initial.rect.x, width - 296);
        } else assert.equal(initial.position, 'static');
        const first = page.locator('[data-history-record]').first();
        const expectedKey = await first.getAttribute('data-history-record');
        assert.equal(await rail.getAttribute('data-history-detail-rail'), expectedKey, 'First selected record has exact accepted identity');
        await page.screenshot({ path: resolve(output, `history-entry-${lang}-${theme}-${width}.png`) });
        // A genuine pointer hit on a background control would fail under showModal.
        const search = page.locator('[data-testid=usage-history] form input:not([type=checkbox])').first();
        await search.click(); await search.fill('temporary draft');
        assert.equal(await search.inputValue(), 'temporary draft'); await search.fill('');
        const second = page.locator('[data-history-record]').nth(1);
        const secondKey = await second.getAttribute('data-history-record');
        assert.notEqual(secondKey, expectedKey);
        const opener = second.getByRole('button');
        await opener.scrollIntoViewIfNeeded(); await opener.focus(); await page.keyboard.press('Enter');
        await page.waitForFunction(key => document.querySelector('[data-history-detail-rail]')?.getAttribute('data-history-detail-rail') === key, secondKey);
        if (width >= 1280) assert.equal(await opener.evaluate(element => element === document.activeElement), true);
        else {
          assert.equal(await rail.evaluate(element => element === document.activeElement), true, 'Narrow explicit selection reveals the flow rail');
          assert.ok((await rail.boundingBox())!.y < 941);
        }
        await rail.focus(); await page.keyboard.press('Escape'); await rail.waitFor({ state: 'detached' });
        const afterClose = await page.evaluate(() => ({ tag: document.activeElement?.tagName, inTable: !!document.activeElement?.closest('.qp-history-table'), main: document.activeElement?.id }));
        assert.ok(afterClose.inTable || afterClose.main === 'history', 'Close restores visible table opener or actual page fallback');
        if (width >= 1280) assert.equal(await opener.evaluate(element => element === document.activeElement), true, 'Exact visible opener restored');
        await opener.scrollIntoViewIfNeeded(); await opener.click(); await rail.waitFor();
        await rail.locator('.qp-history-detail-heading button').click(); await rail.waitFor({ state: 'detached' });
        results.push({ lang, theme, width, initial, expectedKey, secondKey, afterClose, tableOperable: true, keyboardSelection: true, explicitClose: true });
      }
      assert.deepEqual(errors, []);
    } finally { await page.close(); }
  }
  // Compatibility path keeps native dialog semantics and no redesign rail.
  const legacy = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  try {
    await legacy.addInitScript(() => { (window as any).__QUOTAPULSE_TOKEN__ = 'stable-capture-test'; });
    await legacy.clock.setFixedTime(fixedNow);
    await legacy.goto('http://127.0.0.1:7816/?mode=legacy#history?range=today');
    const opener = legacy.locator('[data-testid=usage-history] tbody tr button').first();
    await opener.click(); await legacy.locator('dialog:modal').waitFor();
    assert.equal(await legacy.locator('[data-history-detail-rail]').count(), 0);
    await legacy.keyboard.press('Escape'); await legacy.locator('dialog:modal').waitFor({ state: 'detached' });
    assert.equal(await opener.evaluate(element => element === document.activeElement), true);
    results.push({ legacyNativeDialog: true, escapeExactOpener: true });
  } finally { await legacy.close(); }
  writeFileSync(resolve(output, 'history-rail.json'), JSON.stringify({ scope: 'Compiled synthetic API, EN/TH x light/dark x native/narrow, legacy compatibility', results }, null, 2));
  return results;
}
