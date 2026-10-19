import assert from 'node:assert/strict';
import { test } from 'node:test';
import { liveTokenFlow, liveTokenFlowX, liveTokenFlowY, type LiveTokenFlowResponse } from '../src/redesign/live-token-flow-data.ts';
import { minuteFlowTransitions, playMinuteFlowTransitions, type MinuteFlowSnapshot } from '../src/redesign/live-token-flow-motion.ts';
import { DURATION, EASE } from '../src/lib/motion.ts';

type Row = LiveTokenFlowResponse['rows'][number];
const row = (bucket_ts: number, total_tokens: number, overrides: Partial<Row> = {}): Row => ({ bucket_ts, records: 1, calls: 1,
  total_tokens, input_tokens: total_tokens / 2, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: total_tokens / 2, ...overrides });
const snapshot = (rows: Row[], overrides: Partial<MinuteFlowSnapshot> = {}): MinuteFlowSnapshot => {
  const data = { from: 60000, to: 240000, rows };
  return { scopeKey: 'all', from: data.from, to: data.to, ...liveTokenFlow(data), ...overrides };
};

test('initial, identical, changed scope and numeric maximum snap without a history replay', () => {
  const before = snapshot([row(60000, 100), row(120000, 20)]);
  assert.deepEqual(minuteFlowTransitions(undefined, before), []);
  assert.deepEqual(minuteFlowTransitions(before, structuredClone(before)), []);
  assert.deepEqual(minuteFlowTransitions(before, snapshot([row(60000, 100), row(120000, 40)], { scopeKey: 'provider-null' })), []);
  assert.deepEqual(minuteFlowTransitions(before, snapshot([row(60000, 120), row(120000, 40)])), []);
});

test('only changed common real values provide a start; unchanged vertices stay at final geometry', () => {
  const before = snapshot([row(60000, 100), row(120000, 20)]);
  const next = snapshot([row(60000, 100), row(120000, 40)]);
  const unchanged = structuredClone(next);
  const changes = minuteFlowTransitions(before, next);
  assert.equal(changes.filter(change => change.attribute === 'cy').length, 3);
  assert.ok(changes.every(change => !change.selector.includes('data-at="60000"')));
  const line = changes.find(change => change.selector === 'polyline[data-series="total"]')!;
  const x = liveTokenFlowX(120000, next.from, next.to);
  assert.ok(line.from.includes(`${x},${liveTokenFlowY(20, 100)}`));
  assert.ok(line.to.includes(`${x},${liveTokenFlowY(40, 100)}`));
  assert.equal(line.from.split(' ')[0], line.to.split(' ')[0]);
  assert.deepEqual(next, unchanged, 'rendered factual coordinates/table data are not mutated by planning');
});

test('new, removed, missing-to-recorded and unknown-to-known points do not interpolate fabricated readings', () => {
  const before = snapshot([row(60000, 100), row(120000, 0), row(180000, 20, { input_tokens: null })]);
  const next = snapshot([row(60000, 100), row(120000, 10), row(180000, 20)]);
  const changes = minuteFlowTransitions(before, next);
  assert.ok(changes.some(change => change.selector === 'circle[data-series="total"][data-at="120000"]'), 'recorded zero is eligible');
  assert.ok(!changes.some(change => change.selector === 'circle[data-series="input"][data-at="180000"]'), 'unknown is not zero');
  const missing = snapshot([row(60000, 100)]);
  assert.deepEqual(minuteFlowTransitions(missing, snapshot([row(60000, 100), row(120000, 20)])), []);
  const removed = snapshot([row(60000, 100)]);
  assert.deepEqual(minuteFlowTransitions(next, removed), []);
  const newWindow = snapshot([row(60000, 100), row(120000, 20)], { points: [...next.points, { ...next.points[1]!, at: 240000, start: 240000 }] });
  assert.ok(!minuteFlowTransitions(before, newWindow).some(change => change.selector.includes('data-at="240000"')));
});

test('rolling-window x reframe is immediate and only matching timestamp y values move', () => {
  const before = snapshot([row(60000, 100), row(120000, 20)]);
  const next = snapshot([row(60000, 100), row(120000, 40)], { from: 60001, to: 240001 });
  const line = minuteFlowTransitions(before, next).find(change => change.selector === 'polyline[data-series="total"]')!;
  assert.deepEqual(line.from.split(' ').map(point => point.split(',')[0]), line.to.split(' ').map(point => point.split(',')[0]));
  assert.ok(line.from.includes(`${liveTokenFlowX(120000, next.from, next.to)},`));
});

test('unknown component gaps retain their current segments and never connect across a gap', () => {
  const before = snapshot([row(60000, 100), row(120000, 20, { input_tokens: null }), row(180000, 20)]);
  const next = snapshot([row(60000, 100), row(120000, 20, { input_tokens: null }), row(180000, 30)]);
  const inputLines = minuteFlowTransitions(before, next).filter(change => change.selector.includes('.qp-live-flow-input polyline'));
  assert.equal(inputLines.length, 1);
  assert.ok(inputLines[0]!.selector.endsWith('[data-segment="1"]'));
  assert.equal(inputLines[0]!.from.split(' ').length, 1);
});

class FakeAnimation {
  attributes = new Map<string, string>();
  listeners = new Set<EventListener>();
  started = 0; stopped = 0; removed = 0;
  setAttribute(name: string, value: string) { this.attributes.set(name, value); }
  addEventListener(_name: string, listener: EventListener) { this.listeners.add(listener); }
  removeEventListener(_name: string, listener: EventListener) { this.listeners.delete(listener); }
  beginElement() { this.started++; }
  endElement() { this.stopped++; }
  remove() { this.removed++; }
  finish() { for (const listener of [...this.listeners]) listener({ currentTarget: this } as unknown as Event); }
}
function regionFixture() {
  const animations: FakeAnimation[] = [];
  const appended: FakeAnimation[] = [];
  const region = { ownerDocument: { createElementNS() { const animation = new FakeAnimation(); animations.push(animation); return animation; } },
    querySelector(selector: string) { return selector === 'absent' ? null : { appendChild(animation: FakeAnimation) { appended.push(animation); } }; } } as unknown as HTMLElement;
  return { region, animations, appended };
}
const change = { selector: 'circle', attribute: 'cy' as const, from: '80', to: '60' };

test('SMIL uses shared exact180ms/easing, indefinite trigger and one iteration with final-base fallback', () => {
  const fixture = regionFixture();
  const cancel = playMinuteFlowTransitions(fixture.region, [change], DURATION.fast);
  const animation = fixture.animations[0]!;
  assert.equal(animation.started, 1);
  assert.equal(animation.attributes.get('dur'), '180ms');
  assert.equal(animation.attributes.get('keySplines'), EASE.motion.join(' '));
  assert.equal(animation.attributes.get('fill'), 'remove');
  assert.equal(animation.attributes.get('repeatCount'), '1');
  assert.equal(animation.attributes.get('begin'), 'indefinite');
  animation.finish();
  assert.equal(animation.removed, 1);
  assert.equal(animation.listeners.size, 0);
  cancel();
  assert.equal(animation.stopped, 0, 'completed handles are removed from the cancellation set');
  assert.equal(animation.removed, 1);
});

test('cancellation releases every active handle/listener once, including replacement and unmount callers', () => {
  const fixture = regionFixture();
  const cancel = playMinuteFlowTransitions(fixture.region, [change, { ...change, selector: 'polyline', attribute: 'points' }], DURATION.fast);
  cancel(); cancel();
  assert.equal(fixture.animations.length, 2);
  for (const animation of fixture.animations) {
    assert.equal(animation.stopped, 1);
    assert.equal(animation.removed, 1);
    assert.equal(animation.listeners.size, 0);
  }
});

test('reduced immediate duration, empty changes or missing targets do not create active animations', () => {
  const fixture = regionFixture();
  playMinuteFlowTransitions(fixture.region, [change], 0)();
  playMinuteFlowTransitions(fixture.region, [], DURATION.fast)();
  playMinuteFlowTransitions(fixture.region, [{ ...change, selector: 'absent' }], DURATION.fast)();
  assert.equal(fixture.animations.length, 0);
});
