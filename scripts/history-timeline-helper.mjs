import assert from 'node:assert/strict';

/** Exercise the compiled chart against independently queried API facts. No mocked responses. */
export async function checkHistoryTimeline(page, getSummary) {
  const panel = page.getByTestId('history-timeline');
  const svg = panel.locator(':scope > svg');
  const tooltip = panel.locator('.qp-history-tooltip');
  const range = page.locator('.qp-history-heading select').first();
  const originalRange = await range.inputValue();
  const results = [];
  for (const rangeValue of [originalRange, 'today']) {
    if (await range.inputValue() !== rangeValue) {
      const oldScope = await panel.getAttribute('data-scope');
      await range.focus();
      await range.selectOption(rangeValue);
      await page.waitForFunction(old => document.querySelector('[data-testid=history-timeline]')?.getAttribute('data-scope') !== old, oldScope);
      assert.equal(await tooltip.count(), 0, 'Scope changes dismiss the old bucket');
    }
    const scope = JSON.parse(await panel.getAttribute('data-scope'));
    const data = await getSummary(scope);
    assert.deepEqual(data.scope, scope);
    const expected = Array.from({ length: Math.ceil((scope.to - scope.from) / data.bucketMs) }, (_, index) => {
      const at = scope.from + index * data.bucketMs, row = data.timeline.find(row => row.at === at);
      return { at, input: row?.inputTokens ?? 0, output: row?.outputTokens ?? 0 };
    });
    const actual = await svg.locator(':scope > g[data-bucket-at]').evaluateAll(nodes => nodes.map(node => ({
      at: Number(node.dataset.bucketAt), input: Number(node.dataset.input), output: Number(node.dataset.output),
    })));
    assert.deepEqual(actual, expected, 'Every plotted bucket matches the real API, including empty intervals');
    const ticks = await svg.locator('[data-axis-at]').evaluateAll(nodes => nodes.map(node => ({
      at: Number(node.getAttribute('data-axis-at')), index: Number(node.getAttribute('data-axis-index')),
      rect: node.getBoundingClientRect().toJSON(),
    })));
    assert.equal(ticks[0].index, 0); assert.equal(ticks.at(-1).index, expected.length - 1);
    const bounds = await svg.boundingBox(); assert.ok(bounds);
    for (const [index, tick] of ticks.entries()) {
      assert.equal(tick.at, expected[tick.index].at);
      assert.ok(tick.rect.left >= bounds.x - 1 && tick.rect.right <= bounds.x + bounds.width + 1, 'Date label remains inside chart');
      if (index) assert.ok(ticks[index - 1].rect.right + 2 <= tick.rect.left, 'Date labels do not overlap');
    }
    const inspect = async index => {
      await tooltip.waitFor();
      assert.equal(Number(await tooltip.getAttribute('data-bucket-at')), expected[index].at);
      assert.equal(await tooltip.locator('time').getAttribute('datetime'), new Date(expected[index].at).toISOString());
      assert.deepEqual(await tooltip.locator('dd').evaluateAll(nodes => nodes.map(node => Number(node.dataset.value))), [expected[index].input, expected[index].output]);
      const box = await tooltip.boundingBox(), parent = await panel.boundingBox();
      assert.ok(box && parent && box.x >= parent.x && box.x + box.width <= parent.x + parent.width + 1, 'Tooltip is contained by panel');
      assert.ok(box.y >= 0 && box.y + box.height <= page.viewportSize().height, 'Tooltip remains in the visible viewport');
    };
    await svg.focus(); await inspect(0);
    await page.keyboard.press('End'); await inspect(expected.length - 1);
    await page.keyboard.press('Home'); await inspect(0);
    await page.keyboard.press('ArrowRight'); await inspect(Math.min(1, expected.length - 1));
    await page.keyboard.press('ArrowLeft'); await inspect(0);
    await page.keyboard.press('Escape'); assert.equal(await tooltip.count(), 0);
    await svg.evaluate(node => node.blur());
    const index = Math.floor(expected.length / 2);
    const point = await svg.locator(':scope > g[data-bucket-at]').nth(index).locator('circle').first().evaluate(node => ({
      x: Number(node.getAttribute('cx')), width: node.ownerSVGElement.viewBox.baseVal.width,
    }));
    await page.mouse.move(bounds.x + point.x / point.width * bounds.width, bounds.y + bounds.height / 2);
    await inspect(index);
    await page.mouse.click(bounds.x + point.x / point.width * bounds.width, bounds.y + bounds.height / 2);
    assert.equal(Number(await tooltip.getAttribute('data-bucket-at')), expected[index].at, 'Click focus retains the hovered bucket');
    await page.mouse.move(0, 0); assert.equal(await tooltip.count(), 0, 'Pointer exit dismisses tooltip');
    await page.keyboard.press('Home'); await inspect(0);
    results.push({ range: rangeValue, buckets: expected.length, ticks: ticks.length, keyboard: true, pointer: true, apiFacts: true, contained: true });
  }
  const viewport = page.viewportSize();
  await page.setViewportSize({ ...viewport, width: viewport.width - 1 });
  await tooltip.waitFor({ state: 'hidden' });
  await page.setViewportSize(viewport);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  assert.equal(await tooltip.count(), 0, 'Restoring width must not revive an old bucket');
  const previousScope = await panel.getAttribute('data-scope');
  await range.focus();
  await range.selectOption(originalRange);
  if (originalRange !== 'today') await page.waitForFunction(old => document.querySelector('[data-testid=history-timeline]')?.getAttribute('data-scope') !== old, previousScope);
  await page.waitForFunction(() => !document.querySelector('.qp-history-tooltip'));
  await page.evaluate(() => document.activeElement?.blur());
  await page.mouse.move(0, 0);
  return results;
}
