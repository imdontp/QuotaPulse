/** Date-fixture regression: browser timers/RAF must progress even with a frozen Node wall clock. */
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { installBrowserFixedDate } from './browser-fixed-date.mjs';

const output = resolve('tmp/browser-fixed-date-regression');
mkdirSync(output, { recursive: true });
rmSync(resolve(output, 'verification.json'), { force: true });
const NativeDate = globalThis.Date;
// A gap just above signed32-bit timer range reproduces the old fixture interaction
// independently of the calendar date on the machine running this check.
const fixedNow = NativeDate.now() - (2 ** 31 + 60_000);
const fixtureDate = new Proxy(NativeDate, {
  construct(target, args) { return Reflect.construct(target, args.length ? args : [fixedNow]); },
  apply() { return new NativeDate(fixedNow).toString(); },
  get(target, key, receiver) { return key === 'now' ? () => fixedNow : Reflect.get(target, key, receiver); },
});
let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
const outcomes: unknown[] = [];
async function within<T>(work: Promise<T>, milliseconds: number): Promise<T | { timedOut: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([work, new Promise<{ timedOut: true }>(resolve => { timer = setTimeout(() => resolve({ timedOut: true }), milliseconds); })]); }
  finally { clearTimeout(timer); }
}
try {
  globalThis.Date = fixtureDate;
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  const old = await browser.newPage();
  await old.clock.setFixedTime(fixedNow);
  await old.goto('data:text/html,<title>Old fixture clock reproduction</title>');
  const started = performance.now();
  const oldTimer = await within(old.evaluate(() => new Promise(resolve => setTimeout(() => resolve({ fired: true }), 25))), 1000);
  const oldState = await old.evaluate(() => {
    const controller = (globalThis as any).__pwClock?.controller;
    return { date: Date.now(), ticks: controller?._now?.ticks, nextRealTimeCallAt: controller?._currentRealTimeTimer?.callAt };
  });
  outcomes.push({ method: 'previous Playwright clock approach', result: oldTimer, state: oldState, elapsedMs: performance.now() - started });
  await old.close();

  for (const lang of ['en', 'th']) {
    const page = await browser.newPage({ timezoneId: 'Asia/Bangkok', locale: lang });
    await installBrowserFixedDate(page, fixedNow);
    await page.goto('data:text/html,<title>Date-only fixture</title>');
    const measured = await within(
      page.evaluate(async () => {
        const before = performance.now();
        const frames: number[] = [];
        await new Promise<void>(resolve => requestAnimationFrame(first => {
          frames.push(first);
          requestAnimationFrame(second => { frames.push(second); resolve(); });
        }));
        await new Promise(resolve => setTimeout(resolve, 25));
        let intervals = 0;
        await new Promise<void>(resolve => {
          const timer = setInterval(() => { if (++intervals === 2) { clearInterval(timer); resolve(); } }, 10);
        });
        const FixtureDate = [class extends Date {}][0];
        return {
          now: Date.now(), constructed: new Date().getTime(), explicit: new Date(0).getTime(),
          parsed: Date.parse('2025-05-17T13:42:00.000Z'), utc: Date.UTC(2025, 4, 17, 13, 42),
          instance: new Date() instanceof Date, subclass: new FixtureDate() instanceof FixtureDate, frames, intervals, elapsedMs: performance.now() - before,
          virtualClockInstalled: Object.hasOwn(globalThis, '__pwClock'),
        };
      }), 5000);
    assert.ok(!('timedOut' in measured), 'Native fixture timers/RAF did not progress');
    assert.equal(measured.now, fixedNow); assert.equal(measured.constructed, fixedNow);
    assert.equal(measured.explicit, 0); assert.equal(measured.parsed, 1747489320000); assert.equal(measured.utc, 1747489320000);
    assert.equal(measured.instance, true); assert.equal(measured.subclass, true); assert.equal(measured.intervals, 2);
    assert.ok(measured.frames[1] > measured.frames[0]); assert.ok(measured.elapsedMs >= 25);
    assert.equal(measured.virtualClockInstalled, false); assert.equal(Date.now(), fixedNow);
    await installBrowserFixedDate(page, fixedNow + 1000);
    assert.equal(await page.evaluate(() => Date.now()), fixedNow + 1000, 'explicit current-document date updates remain available');
    outcomes.push({ method: 'date-only fixture', lang, measured });
    await page.close();
  }
  writeFileSync(resolve(output, 'verification.json'), JSON.stringify({ browser: browser.version(), fixedNow, hostFrozen: true, outcomes }, null, 2));
  console.log(JSON.stringify(outcomes, null, 2));
} finally { await browser?.close(); globalThis.Date = NativeDate; }
