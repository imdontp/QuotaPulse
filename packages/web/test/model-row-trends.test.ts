import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { comparisonPageSelection } from '../src/redesign/model-comparison-page.ts';
import { modelPairKey, modelRowTrend, modelRowTrendTone } from '../src/redesign/model-row-trends.ts';
import { effortPage } from '../src/redesign/effort-page.ts';

test('exact model/provider keys preserve null, empty and literal Unknown identities', () => {
  const pairs = [null, '', 'Unknown'].flatMap(model => [null, '', 'Unknown'].map(provider => ({ model, provider })));
  assert.equal(new Set(pairs.map(modelPairKey)).size, 9);
});

test('real sparse row buckets fill only valid scope gaps and never borrow provider curves', () => {
  const data = { now: 1, scope: { from: 100, to: 400 }, bucketMs: 100, pairs: [
    { model: 'a', provider: null, points: [{ start: 200, tokens: 7, records: 1, calls: 12 }] },
    { model: 'a', provider: '', points: [{ start: 100, tokens: 0, records: 1, calls: 1 }] },
    { model: 'b', provider: null, points: [] },
  ] };
  assert.deepEqual(modelRowTrend(data, { model: 'a', provider: null }), [{ at: 100, value: 0 }, { at: 200, value: 7 }, { at: 300, value: 0 }]);
  assert.deepEqual(modelRowTrend(data, { model: 'a', provider: '' }), [{ at: 100, value: 0 }, { at: 200, value: 0 }, { at: 300, value: 0 }]);
  assert.deepEqual(modelRowTrend(data, { model: 'b', provider: null }), []);
  assert.equal(modelRowTrend(data, { model: 'a', provider: 'Unknown' }), null);
  assert.equal(modelRowTrend(null, { model: 'a', provider: null }), null);
  assert.equal(modelRowTrend({ ...data, bucketMs: 0 }, { model: 'a', provider: null }), null);
});

test('deep-link selection waits for accepted list then reveals its page once', () => {
  const initial = { scopeKey: '', selectionKey: '', page: 0 };
  const pending = comparisonPageSelection(initial, 'scope', 'selected-a', undefined, -1);
  assert.equal(pending.selectionKey, '');
  const accepted = comparisonPageSelection(pending, 'scope', 'selected-a', 1240, 53);
  assert.equal(accepted.page, 2);
  const manual = { ...accepted, page: 5 };
  assert.equal(comparisonPageSelection(manual, 'scope', 'selected-a', 1240, 53), manual);
  assert.equal(comparisonPageSelection(manual, 'scope', 'selected-b', 1240, 83).page, 4);
});

test('comparison refresh preserves manual page, shrink clamps persistently and scope changes reset', () => {
  const selected = { scopeKey: 'a', selectionKey: 'selected', page: 5 };
  assert.equal(comparisonPageSelection(selected, 'a', 'selected', undefined, -1), selected);
  const shrunk = comparisonPageSelection(selected, 'a', 'selected', 21, 0);
  assert.equal(shrunk.page, 1);
  assert.equal(comparisonPageSelection(shrunk, 'a', 'selected', 1240, 0), shrunk);
  assert.equal(comparisonPageSelection(shrunk, 'b', 'selected', 1240, -1).page, 0);
});

test('20-row comparison pages expose every ranked pair without changing full list or totals', () => {
  const pairs = Array.from({ length: 1240 }, (_, i) => ({ model: String(i), provider: null, tokens: 1240 - i }));
  const rows = Array.from({ length: 62 }, (_, page) => effortPage(pairs, page).rows).flat();
  assert.deepEqual(rows, pairs);
  assert.equal(effortPage(pairs, 0).total, 1240);
  for (const count of [0, 1, 20]) {
    const result = effortPage(pairs.slice(0, count), 0);
    assert.equal(result.hasNext, false);
    assert.equal(result.hasPrevious, false);
  }
});


test('decorative row tones remain stable across ordering, page windows and recreated refresh objects', () => {
  const pairs = [null, '', 'Unknown', 'same-model'].flatMap(model => [null, '', 'route-a', 'route-b'].map(provider => ({ model, provider })));
  const original = new Map(pairs.map(pair => [modelPairKey(pair), modelRowTrendTone(pair)]));
  const palette = new Set(['blue', 'violet', 'orange', 'cyan', 'rose']);
  for (const pair of [...pairs].reverse()) {
    assert.ok(palette.has(modelRowTrendTone(pair)));
    assert.equal(modelRowTrendTone({ ...pair }), original.get(modelPairKey(pair)));
    assert.equal(modelRowTrendTone(pair), modelRowTrendTone({ provider: pair.provider, model: pair.model }));
  }
  assert.equal(new Set(Array.from({ length: 100 }, (_, i) => modelRowTrendTone({ model: `custom-${i}`, provider: 'route' }))).size, 5);
  const untouched = pairs.map(pair => ({ ...pair }));
  pairs.forEach(modelRowTrendTone);
  assert.deepEqual(pairs, untouched, 'color assignment must not mutate exact identities');
});


test('light row trend strokes exceed 3:1 on white and across the selected row gradient', () => {
  const css = readFileSync(new URL('../src/redesign/models.css', import.meta.url), 'utf8');
  const rgb = (hex: string) => [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const luminance = (channels: number[]) => channels.reduce((sum, value, index) => sum + [0.2126, 0.7152, 0.0722][index] * (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4), 0);
  const contrast = (a: number[], b: number[]) => { const [low, high] = [luminance(a), luminance(b)].sort((x, y) => x - y); return (high + 0.05) / (low + 0.05); };
  const mixWhite = (hex: string, share: number) => rgb(hex).map(channel => channel * share + 1 - share);
  // Models selected row: #2158ff at 19% -> light --qp-series #7040bb at 11%, over --qp-panel white.
  const start = mixWhite('#2158ff', 0.19);
  const end = mixWhite('#7040bb', 0.11);
  const backgrounds = [[1, 1, 1], ...Array.from({ length: 101 }, (_, index) => start.map((value, channel) => value + (end[channel] - value) * index / 100))];
  for (const tone of ['blue', 'violet', 'orange', 'cyan', 'rose']) {
    const rule = css.split('\n').find(line => line.startsWith('.qp-redesign[data-theme=light] .qp-model-row-trend-cell[data-trend-tone=' + tone + ']'));
    assert.ok(rule, tone + ' light color rule');
    const color = rule.match(/--qp-accent:(#[0-9a-f]{6})/)![1];
    for (const background of backgrounds) assert.ok(contrast(rgb(color), background) >= 3, tone + ' has insufficient contrast');
  }
});
