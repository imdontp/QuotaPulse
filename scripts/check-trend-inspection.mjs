import assert from 'node:assert/strict';

/** Expected points must come from an independent API read, not chart attributes. */
export async function checkTrendInspection(page, expected, unit) {
  const axes = page.locator('.qp-observed-trend-axes');
  const svg = axes.locator(':scope > svg');
  const tip = axes.locator('.qp-trend-inspection-tooltip');
  await svg.scrollIntoViewIfNeeded();
  assert.equal(await axes.getAttribute('data-value-label'), unit);
  assert.equal(await svg.getAttribute('role'), 'group');
  assert.equal(await page.locator('svg[tabindex="0"]').count(), 1, 'Only the full chart adds a focus stop');
  assert.deepEqual(await svg.locator(':scope > circle[data-at]').evaluateAll(nodes => nodes.map(node => ({ at: Number(node.dataset.at), value: Number(node.dataset.value) }))), expected);
  const table = axes.locator('..').locator('.qp-chart-data');
  assert.deepEqual(await table.locator('tbody tr').evaluateAll(nodes => nodes.map(node => ({ at: Number(node.dataset.at), value: Number(node.dataset.value) }))), expected, 'Full data table remains complete');
  const original = await svg.locator('polyline,polygon').evaluateAll(nodes => nodes.map(node => node.getAttribute('points')));
  const inspect = async index => {
    await tip.waitFor();
    await page.waitForFunction(at => Number(document.querySelector('.qp-trend-inspection-tooltip')?.getAttribute('data-at')) === at, expected[index].at);
    assert.equal(await tip.locator('time').getAttribute('datetime'), new Date(expected[index].at).toISOString());
    assert.equal(Number(await tip.locator('dd').getAttribute('data-value')), expected[index].value);
    assert.equal(await tip.locator('dt').innerText(), unit);
    const bounds = await tip.boundingBox(), viewport = page.viewportSize();
    assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, 'Tooltip stays in viewport');
    const panel = await axes.locator('..').boundingBox();
    assert.ok(bounds.x >= panel.x && bounds.x + bounds.width <= panel.x + panel.width, 'Tooltip stays inside panel horizontally');
    const marker = await svg.locator('.qp-observed-inspection>circle').boundingBox();
    assert.ok(bounds.x + bounds.width <= marker.x || bounds.x >= marker.x + marker.width || bounds.y + bounds.height <= marker.y || bounds.y >= marker.y + marker.height, 'Tooltip does not cover selected point');
  };
  await svg.evaluate(node => node.blur());
  await svg.focus(); await inspect(0);
  await page.keyboard.press('ArrowLeft'); await inspect(0);
  await page.keyboard.press('End'); await inspect(expected.length - 1);
  await page.keyboard.press('ArrowRight'); await inspect(expected.length - 1);
  await page.keyboard.press('Home'); await inspect(0);
  await page.keyboard.press('ArrowRight'); await inspect(Math.min(1, expected.length - 1));
  await page.keyboard.press('ArrowLeft'); await inspect(0);
  await page.keyboard.press('Escape'); await tip.waitFor({ state: 'hidden' });
  await table.locator('summary').focus();
  await svg.scrollIntoViewIfNeeded();
  const box = await svg.boundingBox();
  const index = Math.floor(expected.length / 2);
  await page.mouse.move(box.x + (.008 + .984 * index / Math.max(1, expected.length - 1)) * box.width, box.y + box.height / 2);
  await inspect(index);
  await page.mouse.click(box.x + (.008 + .984 * index / Math.max(1, expected.length - 1)) * box.width, box.y + box.height / 2);
  assert.equal(Number(await tip.getAttribute('data-at')), expected[index].at, 'Click focus retains the pointer bucket');
  await page.mouse.move(0, 0); await tip.waitFor({ state: 'hidden' });
  await page.keyboard.press('Home'); await inspect(0);
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
  await tip.waitFor({ state: 'hidden' });
  await page.setViewportSize(viewport);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await tip.count(), 0, 'Restoring dimensions does not revive selection');
  await svg.scrollIntoViewIfNeeded(); await page.keyboard.press('Home'); await inspect(0);
  const scroll = await page.evaluate(() => ({ y: scrollY, maximum: document.documentElement.scrollHeight - innerHeight }));
  if (scroll.maximum > 0) {
    await page.evaluate(y => scrollTo(0, y > 0 ? y - 1 : 1), scroll.y);
    await tip.waitFor({ state: 'hidden' });
  }
  await svg.focus(); await page.keyboard.press('Home'); await inspect(0);
  await page.keyboard.press('Tab');
  const summary = table.locator('summary');
  assert.equal(await summary.evaluate(node => node === document.activeElement), true, 'Tab reaches full data disclosure');
  await tip.waitFor({ state: 'hidden' });
  await page.keyboard.press('Enter');
  assert.equal(await table.evaluate(node => node.open), true);
  assert.equal(await table.locator('tbody tr').count(), expected.length);
  await page.keyboard.press('Enter');
  assert.deepEqual(await svg.locator('polyline,polygon').evaluateAll(nodes => nodes.map(node => node.getAttribute('points'))), original, 'Inspection does not change plot geometry');
  return { points: expected.length, apiFacts: true, fullTable: true, keyboard: true, pointer: true, viewport: true, resizeDismissal: true, scrollChecked: scroll.maximum > 0 };
}
