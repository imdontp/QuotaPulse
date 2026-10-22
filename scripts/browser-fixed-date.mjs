function applyFixedDate(now) {
  const NativeDate = globalThis.Date;
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args, newTarget) { return Reflect.construct(target, args.length ? args : [now], newTarget); },
    apply() { return new NativeDate(now).toString(); },
    get(target, key, receiver) { return key === 'now' ? () => now : Reflect.get(target, key, receiver); },
  });
}

/** Freeze current/future fixture wall-date reads; leave native timers/performance alone. */
export async function installBrowserFixedDate(page, timestamp) {
  if (!Number.isSafeInteger(timestamp) || Math.abs(timestamp) > 8_640_000_000_000_000)
    throw new RangeError('Expected a valid integer fixture timestamp');
  await page.addInitScript(applyFixedDate, timestamp);
  await page.evaluate(applyFixedDate, timestamp);
}
