import assert from 'node:assert/strict';

/** Each expected bucket is supplied by an independent Cost API read. */
export async function checkCostInspection(page, data, { locale, currency, rate, basisLabel, unknown }) {
  const plot = page.locator('.qp-cost-chart'), tip = page.locator('.qp-cost-inspection-tooltip');
  // The API omits empty buckets; the established plot/table includes them as
  // recorded zero-call buckets. Derive that domain from the API scope, not DOM.
  const byStart = new Map(data.points.map(point => [point.start, point]));
  const expected = [];
  for (let start = data.scope.from; start < data.scope.to; start += data.bucketMs) expected.push(byStart.get(start) ?? { start, amount: 0, pricedTokens: 0, pricedCalls: 0, allCalls: 0 });
  const number = new Intl.NumberFormat(locale);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency });
  const value = point => point.allCalls === 0 ? money.format(0) : point.pricedCalls === 0 ? unknown
    : money.format(point.amount * (currency === 'THB' ? rate : 1)) + (point.pricedCalls < point.allCalls ? '+' : '');
  assert.equal(await plot.getAttribute('role'), 'group');
  assert.equal(await plot.getAttribute('tabindex'), '0');
  const guides = await plot.locator('.qp-cost-time-guide').evaluateAll(nodes => nodes.map(node => ({ at: Number(node.dataset.at), left: node.style.left })));
  const dates = await page.locator('.qp-cost-plot-dates time').evaluateAll(nodes => nodes.map(node => ({ at: Date.parse(node.dateTime), left: node.style.left })));
  assert.deepEqual(guides, dates, 'Time guides align with the actual scope axis');
  const dots = await plot.locator('.qp-cost-token-dot').evaluateAll(nodes => nodes.map(node => ({ at: Number(node.dataset.at), value: Number(node.dataset.value), left: parseFloat(node.style.left), top: parseFloat(node.style.top) })));
  if (expected.length <= 60) {
    const maximum = Math.max(0, ...expected.map(point => point.pricedTokens));
    assert.equal(dots.length, expected.length);
    dots.forEach((dot, index) => {
      assert.equal(dot.at, expected[index].start); assert.equal(dot.value, expected[index].pricedTokens);
      // CSSOM serializes percentages at limited precision; bound the resulting
      // position to less than a thousandth of a pixel at these test widths.
      assert.ok(Math.abs(dot.left - (index + .5) / expected.length * 100) < 1e-4);
      assert.ok(Math.abs(dot.top - (100 - 100 * expected[index].pricedTokens / (maximum || 1))) < 1e-4);
    });
  } else assert.equal(dots.length, 0, 'Dense charts do not accumulate overlapping markers');
  const table = page.locator('.qp-cost-chart-data');
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(rows => rows.map(row => ({ start: Number(row.dataset.at), amount: Number(row.dataset.amount), pricedTokens: Number(row.dataset.pricedTokens), pricedCalls: Number(row.dataset.pricedCalls), allCalls: Number(row.dataset.allCalls) }))), expected.map(({ start, amount, pricedTokens, pricedCalls, allCalls }) => ({ start, amount, pricedTokens, pricedCalls, allCalls })), 'Complete Cost table matches the independent API');
  await plot.scrollIntoViewIfNeeded();
  const original = await plot.evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(), line: node.querySelector('polyline')?.getAttribute('points'), bars: Array.from(node.querySelectorAll('.qp-cost-column')).map(bar => ({ height: bar.getAttribute('style'), rect: bar.getBoundingClientRect().toJSON() })) }));
  const inspect = async index => {
    await page.waitForFunction(at => Number(document.querySelector('.qp-cost-inspection-tooltip')?.getAttribute('data-at')) === at, expected[index].start);
    const point = expected[index];
    assert.equal(await tip.locator('time').getAttribute('datetime'), new Date(point.start).toISOString());
    assert.equal(Number(await tip.locator('[data-amount]').getAttribute('data-amount')), point.amount);
    assert.equal(await tip.locator('.qp-cost-value>span:first-child').textContent(), value(point));
    assert.equal(await tip.locator('dt').first().textContent(), basisLabel);
    assert.equal(await tip.locator('[data-tokens]').textContent(), number.format(point.pricedTokens));
    assert.equal(Number(await tip.locator('[data-priced-calls]').getAttribute('data-priced-calls')), point.pricedCalls);
    assert.equal(Number(await tip.locator('[data-all-calls]').getAttribute('data-all-calls')), point.allCalls);
    const box = await tip.boundingBox(), viewport = page.viewportSize();
    const amountMark = await plot.locator('.qp-cost-inspection-marks circle[data-series=amount]').boundingBox();
    const actualBar = await plot.locator('.qp-cost-column').nth(index).boundingBox();
    assert.ok(Math.abs(amountMark.x + amountMark.width / 2 - actualBar.x - actualBar.width / 2) <= 1 && Math.abs(amountMark.y + amountMark.height / 2 - actualBar.y) <= 1, 'Cost marker must follow the actual recorded bar, including flex gaps and border geometry');
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height, 'Cost tooltip remains within viewport');
    for (const marker of await plot.locator('.qp-cost-inspection-marks circle').all()) {
      const bounds = await marker.boundingBox();
      assert.ok(box.x + box.width <= bounds.x || box.x >= bounds.x + bounds.width || box.y + box.height <= bounds.y || box.y >= bounds.y + bounds.height, 'Cost tooltip must not cover either selected value');
    }
    assert.deepEqual(await plot.evaluate(node => ({ rect: node.getBoundingClientRect().toJSON(), line: node.querySelector('polyline')?.getAttribute('points'), bars: Array.from(node.querySelectorAll('.qp-cost-column')).map(bar => ({ height: bar.getAttribute('style'), rect: bar.getBoundingClientRect().toJSON() })) })), original, 'Inspection preserves both plot scales and all original bar/line geometry');
  };
  await plot.focus(); await inspect(0); await page.keyboard.press('ArrowLeft'); await inspect(0);
  await page.keyboard.press('End'); await inspect(expected.length - 1); await page.keyboard.press('ArrowRight'); await inspect(expected.length - 1);
  await page.keyboard.press('Home'); await inspect(0); await page.keyboard.press('ArrowRight'); await inspect(Math.min(1, expected.length - 1));
  await page.keyboard.press('Escape'); await tip.waitFor({ state: 'hidden' });
  await plot.evaluate(node => node.blur());
  const bounds = await plot.boundingBox(), middle = Math.floor(expected.length / 2);
  const pointX = bounds.x + (middle + .5) / expected.length * bounds.width, pointY = bounds.y + bounds.height / 2;
  await page.mouse.move(pointX, pointY); await inspect(middle);
  await page.mouse.click(pointX, pointY); await inspect(middle);
  await page.mouse.move(bounds.x - 4, bounds.y - 4); await tip.waitFor({ state: 'hidden' });
  await plot.focus(); await page.keyboard.press('Home'); await inspect(0);
  await page.keyboard.press('Shift+Tab'); await tip.waitFor({ state: 'hidden' });
  assert.equal(await table.locator('summary').evaluate(node => node === document.activeElement), true, 'The complete Cost table remains adjacent in keyboard order');
  await page.keyboard.press('Enter'); assert.equal(await table.evaluate(node => node.open), true);
  await page.keyboard.press('Enter'); await plot.scrollIntoViewIfNeeded();
  // The prior layout check predates opening the complete disclosure; a new
  // focus is sufficient to verify invalidation without comparing old scrolling.
  await plot.focus(); await page.keyboard.press('Home'); await tip.waitFor();
  const viewport = page.viewportSize(); await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
  await tip.waitFor({ state: 'hidden' }); await page.setViewportSize(viewport);
  await plot.evaluate(node => node.blur()); await page.mouse.move(0, 0);
  return { points: expected.length, apiFacts: true, twoScalesUnchanged: true, pointer: true, clickPreservesBucket: true, keyboard: true, table: true, viewport: true, resizeDismissal: true };
}
