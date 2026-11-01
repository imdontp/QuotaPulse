import assert from 'node:assert/strict';
import { test } from 'node:test';
import { historyAxis } from '../src/redesign/history-axis';

test('an empty or zero chart labels only zero while retaining safe geometry', () => {
  assert.deepEqual(historyAxis(0, 'en'), { scaleMaximum: 1, ticks: [{ fraction: 0, value: 0, label: '0' }] });
  assert.deepEqual(historyAxis(Infinity, 'en').ticks, []);
  assert.deepEqual(historyAxis(NaN, 'en').ticks, []);
});

test('small token axes keep distinct meaningful quarter labels', () => {
  for (const lang of ['en', 'th'] as const) {
    assert.deepEqual(historyAxis(1, lang).ticks.map(tick => tick.label), ['0', '0.25', '0.5', '0.75', '1']);
    assert.deepEqual(historyAxis(2, lang).ticks.map(tick => tick.label), ['0', '0.5', '1', '1.5', '2']);
    const tiny = historyAxis(.000001, lang);
    assert.equal(tiny.scaleMaximum, .000001);
    assert.equal(new Set(tiny.ticks.map(tick => tick.label)).size, 5);
    assert.equal(tiny.ticks[0].label, '0');
  }
});

test('ordinary large values keep the established compact token labels', () => {
  assert.deepEqual(historyAxis(1_000_000, 'en').ticks.map(tick => tick.label), ['0', '250.0k', '500.0k', '750.0k', '1.0M']);
});
