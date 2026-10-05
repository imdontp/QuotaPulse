/** Independent, read-only browser evidence against the synthetic production server. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import type { Page, Request, Route } from 'playwright';
import type { MinuteTrendResponse } from '../packages/web/src/api.js';
import { en } from '../packages/web/src/i18n/en.js';
import { th } from '../packages/web/src/i18n/th.js';

type Series = 'input' | 'output' | 'total';
interface ExpectedMinute {
  at: number; start: number; end: number; partial: boolean;
  state: 'missing' | 'zero' | 'recorded'; records: number; calls: number;
  fresh: number | null; read: number | null; write: number | null;
  input: number | null; output: number | null; total: number; partialBreakdown: boolean;
}

/** Reconcile each displayed minute against raw response rows, without importing the production derivation. */
function expectedMinutes(data: MinuteTrendResponse): ExpectedMinute[] {
  assert.equal(data.bucket, 'minute'); assert.equal(data.groupBy, 'none');
  assert.ok(Number.isSafeInteger(data.from) && Number.isSafeInteger(data.to) && data.from >= 0 && data.to > data.from && data.to - data.from <= 86400000);
  const minutes: ExpectedMinute[] = [];
  for (let at = Math.floor(data.from / 60000) * 60000; at < data.to; at += 60000) {
    const rows = data.rows.filter(row => row.bucket_ts === at && row.records > 0);
    const knownFields = (fields: Array<'input_tokens' | 'cached_input_tokens' | 'cache_write_tokens' | 'output_tokens'>) => rows.every(row => fields.every(field => typeof row[field] === 'number' && Number.isFinite(row[field]) && row[field]! >= 0));
    const fieldSum = (field: 'input_tokens' | 'cached_input_tokens' | 'cache_write_tokens' | 'output_tokens') => knownFields([field]) ? rows.reduce((sum, row) => sum + row[field]!, 0) : null;
    const fresh = fieldSum('input_tokens'), read = fieldSum('cached_input_tokens'), write = fieldSum('cache_write_tokens');
    const input = knownFields(['input_tokens', 'cached_input_tokens', 'cache_write_tokens']) ? rows.reduce((sum, row) => sum + row.input_tokens! + row.cached_input_tokens! + row.cache_write_tokens!, 0) : null;
    const output = fieldSum('output_tokens');
    const total = rows.reduce((sum, row) => sum + row.total_tokens, 0);
    const records = rows.reduce((sum, row) => sum + row.records, 0), calls = rows.reduce((sum, row) => sum + row.calls, 0);
    const start = Math.max(at, data.from), end = Math.min(at + 60000, data.to);
    minutes.push({ at, start, end, partial: end - start !== 60000, state: !records ? 'missing' : total === 0 ? 'zero' : 'recorded',
      records, calls, fresh, read, write, input, output, total,
      partialBreakdown: records > 0 && (input === null || output === null || input + output !== total) });
  }
  return minutes;
}

async function bounded<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([promise, new Promise<T>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Live token-flow gate timed out: ${label}`)), 12000);
    })]);
  } finally { if (timer) clearTimeout(timer); }
}

async function settle(page: Page, pending: Set<Request>) {
  const deadline = performance.now() + 15000;
  let idle = 0;
  while (idle < 8) {
    assert.ok(performance.now() < deadline, 'Live token-flow requests did not settle');
    idle = pending.size === 0 ? idle + 1 : 0;
    await page.waitForTimeout(25);
  }
  await bounded(page.evaluate(() => document.fonts.ready), 'fonts');
  await page.waitForTimeout(100);
}

interface RGBA { r: number; g: number; b: number; alpha: number }
interface BackgroundLayer { selector: string; color: string; image: string }
interface BackgroundCandidate { color: RGBA; source: string }

/** Computed color-mix() backgrounds can use normalized CSS Color 4 channels, rather than rgb(). */
function rgba(value: string): RGBA {
  const color = value.trim().toLowerCase();
  if (color === 'transparent') return { r: 0, g: 0, b: 0, alpha: 0 };
  let channels: number[];
  let alpha = 1;
  if (/^#[0-9a-f]{3,8}$/.test(color)) {
    let hex = color.slice(1);
    assert.ok([3, 4, 6, 8].includes(hex.length), `Unsupported computed hex color: ${value}`);
    if (hex.length < 5) hex = hex.split('').map(channel => channel + channel).join('');
    channels = hex.slice(0, 6).match(/../g)!.map(channel => parseInt(channel, 16));
    if (hex.length === 8) alpha = parseInt(hex.slice(6), 16) / 255;
  } else {
    const normalized = color.startsWith('color(');
    assert.ok(normalized ? color.endsWith(')') : /^rgba?\(.+\)$/.test(color), `Unsupported computed color: ${value}`);
    const parts = color.slice(color.indexOf('(') + 1, -1).trim().split(/[\s,/]+/);
    if (normalized) assert.equal(parts.shift(), 'srgb', `Unsupported computed color profile: ${value}`);
    assert.ok(parts.length === 3 || parts.length === 4, `Invalid computed channels: ${value}`);
    channels = parts.slice(0, 3).map(channel => parseFloat(channel) * (channel.endsWith('%') ? 255 / 100 : normalized ? 255 : 1));
    if (parts[3] !== undefined) alpha = parseFloat(parts[3]) / (parts[3].endsWith('%') ? 100 : 1);
  }
  assert.ok([...channels, alpha].every(Number.isFinite), `Invalid computed color: ${value}`);
  const [r, g, b] = channels.map(channel => Math.max(0, Math.min(255, channel)));
  return { r, g, b, alpha: Math.max(0, Math.min(1, alpha)) };
}
function rgb(color: string) { const parsed = rgba(color); return [parsed.r, parsed.g, parsed.b]; }
function composite(front: RGBA, back: RGBA): RGBA {
  const alpha = front.alpha + back.alpha * (1 - front.alpha);
  if (alpha === 0) return { r: 0, g: 0, b: 0, alpha: 0 };
  return { r: (front.r * front.alpha + back.r * back.alpha * (1 - front.alpha)) / alpha,
    g: (front.g * front.alpha + back.g * back.alpha * (1 - front.alpha)) / alpha,
    b: (front.b * front.alpha + back.b * back.alpha * (1 - front.alpha)) / alpha, alpha };
}
function luminance(color: RGBA) {
  return [color.r, color.g, color.b].map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
}
function contrast(first: string, second: RGBA) {
  assert.ok(Math.abs(second.alpha - 1) < .000001, 'Contrast requires a resolved opaque background');
  const a = luminance(composite(rgba(first), second)), b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

function backgroundImages(value: string) {
  if (value === 'none') return [];
  const images: string[] = [];
  let depth = 0, start = 0;
  for (let index = 0; index < value.length; index++) {
    if (value[index] === '(') depth++;
    else if (value[index] === ')') depth--;
    else if (value[index] === ',' && depth === 0) { images.push(value.slice(start, index).trim()); start = index + 1; }
  }
  images.push(value.slice(start).trim());
  assert.ok(images.length <= 8, 'Unexpectedly many plot background images');
  return images.filter(image => image !== 'none').map(image => {
    assert.ok(/^(?:repeating-)?(?:radial|linear)-gradient\(/.test(image), `Cannot measure plot image background: ${image}`);
    const colors = image.match(/#[0-9a-f]{3,8}\b|(?:rgba?|color)\([^)]*\)|\btransparent\b/gi) ?? [];
    assert.ok(colors.length > 0 && colors.length <= 16, `Cannot resolve gradient endpoints: ${image}`);
    return colors.map(rgba);
  });
}
function uniqueCandidates(values: BackgroundCandidate[]) {
  const unique = new Map(values.map(candidate => [JSON.stringify([candidate.color.r, candidate.color.g, candidate.color.b, candidate.color.alpha].map(channel => Math.round(channel * 1e9) / 1e9)), candidate]));
  assert.ok(unique.size <= 128, 'Unexpectedly many plot background candidates');
  return [...unique.values()];
}
function resolvedBackgrounds(layers: BackgroundLayer[]) {
  let candidates: BackgroundCandidate[] = [{ color: { r: 0, g: 0, b: 0, alpha: 0 }, source: 'transparent canvas' }];
  for (const layer of [...layers].reverse()) {
    const color = rgba(layer.color);
    candidates = uniqueCandidates(candidates.map(candidate => ({ color: composite(color, candidate.color), source: `${layer.selector} color over ${candidate.source}` })));
    // CSS paints its first background image last, above the following images and background color.
    for (const [index, stops] of backgroundImages(layer.image).reverse().entries()) {
      candidates = uniqueCandidates(candidates.flatMap(candidate => stops.map((stop, stopIndex) => ({
        color: composite(stop, candidate.color), source: `${layer.selector} gradient ${index} endpoint ${stopIndex} over ${candidate.source}`,
      }))));
    }
  }
  assert.ok(candidates.every(candidate => Math.abs(candidate.color.alpha - 1) < .000001), 'Plot background did not resolve to an opaque ancestor');
  // Every interpolated gradient color lies within these channel bounds. Taking the minimum contrast
  // over both bounds is conservative for opaque foreground colors above or below that luminance range.
  const lower = { r: Math.min(...candidates.map(candidate => candidate.color.r)), g: Math.min(...candidates.map(candidate => candidate.color.g)), b: Math.min(...candidates.map(candidate => candidate.color.b)), alpha: 1 };
  const upper = { r: Math.max(...candidates.map(candidate => candidate.color.r)), g: Math.max(...candidates.map(candidate => candidate.color.g)), b: Math.max(...candidates.map(candidate => candidate.color.b)), alpha: 1 };
  return uniqueCandidates([...candidates, { color: lower, source: 'conservative gradient channel minimum' }, { color: upper, source: 'conservative gradient channel maximum' }]);
}
function minimumContrast(foreground: string, candidates: BackgroundCandidate[]) {
  const measured = candidates.map(candidate => ({ background: candidate.color, source: candidate.source, ratio: contrast(foreground, candidate.color) }));
  const foregroundColor = rgba(foreground);
  if (foregroundColor.alpha === 1) {
    const lower = Math.min(...candidates.map(candidate => luminance(candidate.color))), upper = Math.max(...candidates.map(candidate => luminance(candidate.color)));
    // If a foreground lies within the possible background luminance range, endpoints alone cannot prove contrast.
    if (luminance(foregroundColor) >= lower && luminance(foregroundColor) <= upper) return { minimum: 1, measured };
  }
  return { minimum: Math.min(...measured.map(item => item.ratio)), measured };
}

// Module-local pure checks fail before a browser run if normalization or alpha composition regresses.
assert.deepEqual(rgb('color(srgb 1 0.5 0 / 0.94)'), [255, 127.5, 0]);
assert.deepEqual(backgroundImages('none, none'), []);
assert.equal(rgba('color(srgb 1 1 1 / 0.94)').alpha, .94);
assert.equal(contrast('#000', rgba('#fff')), 21);
assert.deepEqual(composite(rgba('rgba(255, 255, 255, 0.5)'), rgba('#000')), { r: 127.5, g: 127.5, b: 127.5, alpha: 1 });
const colorFixture = resolvedBackgrounds([
  { selector: 'panel', color: 'color(srgb 1 1 1 / 0.94)', image: 'none' },
  { selector: 'root', color: '#edf3fa', image: 'radial-gradient(ellipse at 48% 0, rgb(220, 233, 255), rgba(0, 0, 0, 0) 65%)' },
]);
assert.ok(colorFixture.every(candidate => candidate.color.alpha === 1 && candidate.color.r >= 252.8 && candidate.color.g >= 253.6 && candidate.color.b >= 254.7));
assert.ok(minimumContrast('#057e95', colorFixture).minimum > 4.6);

async function checkValues(page: Page, data: MinuteTrendResponse, lang: string, theme: string, pending: Set<Request>, state: 'baseline' | 'diagnostic' | 'empty') {
  await page.locator('.qp-live-token-flow').waitFor({ timeout: 12000 }); await settle(page, pending);
  const expected = expectedMinutes(data);
  const maximum = Math.max(0, ...expected.flatMap(point => [point.total, point.input ?? 0, point.output ?? 0]));
  const messages = lang === 'th' ? th : en;
  const locale = lang === 'th' ? 'th-TH' : 'en-US';
  const timeZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium', timeZone });
  const clock = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone });
  const value = (point: ExpectedMinute, amount: number | null) => point.state === 'missing' ? '—' : amount === null ? messages['redesign.unknownValue'] : number.format(amount);
  const partial = (point: ExpectedMinute, index: number) => messages[index === expected.length - 1 && point.end === data.to && point.end % 60000 !== 0 ? 'redesign.liveMinuteCurrent' : 'redesign.liveMinutePartial'];
  const states = { missing: messages['redesign.liveMinuteMissing'], zero: messages['redesign.liveMinuteZero'], recorded: messages['redesign.liveMinuteRecorded'] };
  const snapshot = await page.evaluate(() => {
    const root = document.querySelector('.qp-live-token-flow')!;
    const points = Array.from(root.querySelectorAll('circle')).map(element => ({
      series: element.getAttribute('data-series'), at: Number(element.getAttribute('data-at')), value: Number(element.getAttribute('data-value')),
      x: Number(element.getAttribute('cx')), y: Number(element.getAttribute('cy')), state: element.getAttribute('data-state'), partial: element.getAttribute('data-partial'),
      title: element.querySelector('title')?.textContent,
    }));
    const lines = Array.from(root.querySelectorAll('polyline')).map(element => ({ series: element.getAttribute('data-series'), points: element.getAttribute('points') ?? '', stroke: getComputedStyle(element).stroke }));
    return { maximum: Number(root.getAttribute('data-maximum')), points, lines,
      totalOnly: Array.from(root.querySelectorAll('.qp-live-chart>circle')).every(element => element.getAttribute('data-series') === 'total'),
      axis: Array.from(root.querySelectorAll('.qp-live-flow-axis>span')).map(element => ({ at: Number(element.getAttribute('data-at')), text: element.textContent, left: Number.parseFloat((element as HTMLElement).style.left) })),
      yAxis: Array.from(root.querySelectorAll('.qp-live-flow-y-axis>span')).map(element => ({ value: element.textContent, top: Number.parseFloat((element as HTMLElement).style.top) })),
      latest: (() => {
        const element = root.querySelector('.qp-live-flow-latest')!;
        return { attrs: ['data-at', 'data-start', 'data-end', 'data-partial', 'data-input', 'data-output', 'data-total'].map(key => element.getAttribute(key)),
          heading: element.querySelector('.qp-live-flow-latest-heading>span')?.textContent,
          time: element.querySelector('.qp-live-flow-latest-heading>time')?.textContent ?? null,
          values: Array.from(element.querySelectorAll('.qp-live-flow-latest-values>[data-series]')).map(value => ({
            series: value.getAttribute('data-series'), label: value.querySelector('small')?.textContent, value: value.querySelector('strong')?.textContent,
          })), empty: element.querySelector(':scope>small')?.textContent ?? null };
      })(),
      note: root.querySelector('.qp-live-flow-breakdown')?.textContent ?? null,
      role: root.querySelector('.qp-live-flow-canvas')?.getAttribute('role'), imageLabel: root.querySelector('.qp-live-flow-canvas')?.getAttribute('aria-label'),
      description: root.querySelector('.qp-live-flow-canvas')?.getAttribute('aria-describedby'), tableId: root.querySelector('.qp-live-flow-data')?.id,
    };
  });
  assert.equal(snapshot.maximum, maximum, `${state}: the shared scale ignored an actual component`);
  assert.equal(snapshot.totalOnly, true, 'Existing .qp-live-chart point selector must retain total only');
  assert.equal(snapshot.role, 'img'); assert.equal(snapshot.description, snapshot.tableId);
  assert.ok(snapshot.imageLabel?.includes(number.format(maximum)), 'Accessible plot label omits its shared range');
  const expectedYTicks = maximum > 0 ? [maximum, Math.round(maximum * 2 / 3), Math.round(maximum / 3), 0].filter((value, index, values) => index === 0 || value < values[index - 1]!) : [0];
  assert.deepEqual(snapshot.yAxis.map(item => item.value), expectedYTicks.map(value => number.format(value)), `${state}: y-axis labels must use the actual shared scale`);
  assert.ok(snapshot.yAxis.every((item, index) => Math.abs(item.top - (94 - 88 * expectedYTicks[index]! / (maximum || 1))) < .0001), `${state}: y-axis labels must align to the actual gridlines`);
  const pointCounts: Record<Series, number> = { input: 0, output: 0, total: 0 };
  const segmentCounts: Record<Series, number> = { input: 0, output: 0, total: 0 };
  for (const series of ['input', 'output', 'total'] as const) {
    const known = expected.map((point, index) => ({ point, index })).filter(({ point }) => point[series] !== null);
    const circles = snapshot.points.filter(point => point.series === series);
    assert.deepEqual(circles.map(point => [point.at, point.value]), known.map(({ point }) => [point.at, point[series]]), `${state}/${series}: SVG values differ from API components`);
    for (const [index, circle] of circles.entries()) {
      const item = known[index]!, point = item.point;
      const x = 8 + 984 * (point.start - data.from) / Math.max(1, data.to - 1 - data.from), y = 94 - 88 * point[series]! / (maximum || 1);
      assert.ok(Math.abs(circle.x - x) < .0001 && Math.abs(circle.y - y) < .0001, `${state}/${series}: incorrect shared-scale coordinate at ${point.at}`);
      assert.equal(circle.state, point.state); assert.equal(circle.partial, point.partial ? 'true' : null);
      assert.ok(circle.title?.includes(states[point.state]));
      if (point.partial) assert.ok(circle.title?.includes(partial(point, item.index)), 'Partial minute is unlabeled');
    }
    const lines = snapshot.lines.filter(line => line.series === series);
    const actualSegments = lines.map(line => line.points.trim() ? line.points.trim().split(/\s+/).map(pair => pair.split(',').map(Number)) : []);
    const flattened = actualSegments.flat();
    assert.equal(flattened.length, known.length, `${state}/${series}: line invents or omits points`);
    for (const [index, coordinates] of flattened.entries()) {
      const item = known[index]!;
      assert.ok(Math.abs(coordinates[0]! - (8 + 984 * (item.point.start - data.from) / Math.max(1, data.to - 1 - data.from))) < .0001);
      assert.ok(Math.abs(coordinates[1]! - (94 - 88 * item.point[series]! / (maximum || 1))) < .0001);
    }
    const expectedRuns = expected.filter((point, index) => point[series] !== null && (index === 0 || expected[index - 1]![series] === null)).length;
    assert.equal(actualSegments.length, expectedRuns, `${state}/${series}: unknown component did not break its line`);
    let offset = 0;
    for (const segment of actualSegments) {
      for (let index = 1; index < segment.length; index++) assert.equal(known[offset + index]!.index - known[offset + index - 1]!.index, 1, `${state}/${series}: a line bridges an unknown minute`);
      offset += segment.length;
    }
    pointCounts[series] = circles.length; segmentCounts[series] = lines.length;
  }
  const expectedTicks = Array.from({ length: 7 }, (_, index) => Math.round(data.from + (data.to - 1 - data.from) * index / 6));
  assert.deepEqual(snapshot.axis.map(({ at, text }) => ({ at, text })), expectedTicks.map(at => ({ at, text: clock.format(at) })), `${state}: time axis must show seven timestamps across the requested window`);
  assert.ok(snapshot.axis.every((item, index) => Math.abs(item.left - 100 * index / 6) < .0001), `${state}: axis timestamps must be evenly spaced`);
  const latestIndex = expected.map(point => point.records > 0).lastIndexOf(true);
  const latest = latestIndex < 0 ? null : expected[latestIndex]!;
  assert.deepEqual(snapshot.latest.attrs, latest ? [latest.at, latest.start, latest.end, latest.partial ? 'true' : null, latest.input, latest.output, latest.total].map(value => value === null ? null : String(value)) : [null, null, null, null, null, null, null], `${state}: latest rail metadata must belong to one actual recorded minute`);
  assert.equal(snapshot.latest.heading, messages['redesign.liveLatestMinute']);
  if (latest) {
    const expectedTime = `${clock.format(latest.start)} – ${clock.format(latest.end)}${latest.partial ? ` · ${partial(latest, latestIndex)}` : ''}`;
    assert.equal(snapshot.latest.time, expectedTime, `${state}: latest interval and partial status must remain visible`);
    assert.deepEqual(snapshot.latest.values, ['input', 'output', 'total'].map((key, index) => ({
      series: key,
      label: messages[[ 'history.inputCombined', 'col.output', 'col.total' ][index] as keyof typeof messages],
      value: latest[key as Series] === null ? messages['redesign.unknownValue'] : number.format(latest[key as Series]!),
    })), `${state}: latest rail values must match the last recorded minute and preserve unknowns`);
    assert.equal(snapshot.latest.empty, null);
  } else {
    assert.equal(snapshot.latest.time, null);
    assert.deepEqual(snapshot.latest.values, []);
    assert.equal(snapshot.latest.empty, messages['redesign.liveFlowNoLatest']);
  }
  assert.equal(snapshot.note, expected.some(point => point.partialBreakdown) ? messages['redesign.liveFlowBreakdown'] : null);

  const disclosure = page.locator('.qp-live-flow-data'), summary = disclosure.locator('summary');
  assert.equal(await disclosure.getAttribute('open'), null, 'Token-flow data must start collapsed');
  await summary.focus(); await page.keyboard.press('Enter');
  assert.equal(await disclosure.getAttribute('open'), '');
  assert.ok(await disclosure.locator('table').isVisible());
  assert.equal(await disclosure.locator('thead th').count(), 9);
  assert.deepEqual(await disclosure.locator('thead th').allTextContents(), [messages['redesign.liveMinuteInterval'], messages['history.inputCombined'], messages['col.freshIn'], messages['col.cacheRead'], messages['col.cacheWrite'], messages['col.output'], messages['col.total'], messages['redesign.records'], messages['col.calls']]);
  const table = await disclosure.locator('tbody tr').evaluateAll(elements => elements.map(element => ({
    attrs: ['data-at', 'data-start', 'data-end', 'data-state', 'data-partial', 'data-partial-breakdown', 'data-input', 'data-output', 'data-total', 'data-fresh-input', 'data-cache-read', 'data-cache-write', 'data-records', 'data-calls'].map(key => element.getAttribute(key)),
    interval: Array.from(element.querySelector('th')?.childNodes ?? []).filter(node => node.nodeType === Node.TEXT_NODE).map(node => node.textContent).join(''), detail: element.querySelector('small')?.textContent,
    values: Array.from(element.querySelectorAll('td')).map(cell => cell.textContent),
  })));
  assert.equal(table.length, expected.length, 'Expandable table omits minute buckets');
  for (const [index, actual] of table.entries()) {
    const point = expected[index]!;
    const raw = [point.at, point.start, point.end, point.state, point.partial ? 'true' : null, point.partialBreakdown ? 'true' : null,
      point.input, point.output, point.total, point.fresh, point.read, point.write, point.records, point.calls];
    assert.deepEqual(actual.attrs, raw.map(item => item === null ? null : String(item)), `${state}: table metadata differs at ${point.at}`);
    assert.equal(actual.interval, `${date.format(point.start)} – ${date.format(point.end)}`);
    assert.equal(actual.detail, `${states[point.state]}${point.partial ? ` · ${partial(point, index)}` : ''}`);
    assert.deepEqual(actual.values, [value(point, point.input), value(point, point.fresh), value(point, point.read), value(point, point.write), value(point, point.output), value(point, point.total), point.state === 'missing' ? '—' : number.format(point.records), point.state === 'missing' ? '—' : number.format(point.calls)], `${state}: visible table values differ at ${point.at}`);
  }

  const region = page.locator('.qp-live-flow-table');
  assert.equal(await region.getAttribute('role'), 'region'); assert.equal(await region.getAttribute('tabindex'), '0');
  if (expected.length) {
    await region.focus(); await page.keyboard.press('End');
    await page.waitForFunction(() => {
      const element = document.querySelector('.qp-live-flow-table')!;
      return element.scrollTop > 0 && element.scrollTop + element.clientHeight >= element.scrollHeight - 1;
    }, undefined, { polling: 25, timeout: 12000 });
    const reach = await region.evaluate(element => ({ focused: element === document.activeElement, bottom: element.getBoundingClientRect().bottom, lastBottom: element.querySelector('tbody tr:last-child')!.getBoundingClientRect().bottom, scrollTop: element.scrollTop }));
    assert.equal(reach.focused, true); assert.ok(reach.lastBottom <= reach.bottom + 1, 'Final minute is not keyboard reachable');
  } else assert.equal(table.length, 0, 'An empty window must not invent table rows');
  const widths: Array<{ width: number; plotHeight: number; tableWidth: number; horizontalKeyboardScroll: boolean }> = [];
  for (const width of [390, 900, 1280]) {
    await page.setViewportSize({ width, height: 941 }); await page.waitForTimeout(75);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Expanded token-flow table overflows ${lang}/${theme}/${width}`);
    const bounds = await page.evaluate(() => {
      const plot = document.querySelector('.qp-live-flow-plot')!.getBoundingClientRect();
      const table = document.querySelector('.qp-live-flow-table')!;
      const canvas = document.querySelector('.qp-live-flow-canvas')!.getBoundingClientRect();
      const latest = document.querySelector('.qp-live-flow-latest')!.getBoundingClientRect();
      return { plot: { x: plot.x, y: plot.y, width: plot.width, height: plot.height },
        canvas: { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height },
        latest: { x: latest.x, y: latest.y, right: latest.right, bottom: latest.bottom, width: latest.width, height: latest.height },
        latestValues: Array.from(document.querySelectorAll('.qp-live-flow-latest-values strong')).map(element => { const r = element.getBoundingClientRect(), cell = element.closest<HTMLElement>('[data-series]')!, style = getComputedStyle(element), cellRect = cell.getBoundingClientRect(); return { text: element.textContent, left: r.left, right: r.right, top: r.top, bottom: r.bottom, fontSize: style.fontSize, cell: { left: cellRect.left, right: cellRect.right, width: cellRect.width } }; }),
        traces: Array.from(document.querySelectorAll('.qp-live-flow-canvas>svg')).map(element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }),
        tableWidth: table.clientWidth, horizontal: table.scrollWidth > table.clientWidth,
      };
    });
    assert.equal(bounds.plot.height, width >= 1280 ? 72 : width <= 540 ? 132 : 124, 'Token-flow plot exceeded its bounded height');
    assert.equal(bounds.traces.length, 3);
    for (const trace of bounds.traces) for (const dimension of ['x', 'y', 'width', 'height'] as const) assert.ok(Math.abs(trace[dimension] - bounds.canvas[dimension]) < .1, 'Input/output/total SVGs use different screen scales');
    assert.ok(bounds.latest.x >= bounds.plot.x - .1 && bounds.latest.right <= bounds.plot.x + bounds.plot.width + .1 && bounds.latest.bottom <= bounds.plot.y + bounds.plot.height + .1,
      'Latest-minute values must remain inside the bounded chart/summary region');
    assert.ok(bounds.latestValues.every(value => value.left >= bounds.latest.x - .1 && value.right <= bounds.latest.x + bounds.latest.width + .1 && value.bottom <= bounds.latest.y + bounds.latest.height + .1),
      `Latest-minute values must remain visible inside their rail at ${width}px: ${JSON.stringify({ latest: bounds.latest, values: bounds.latestValues })}`);
    let horizontalKeyboardScroll = false;
    if (bounds.horizontal) {
      await region.evaluate(element => { element.scrollLeft = 0; }); await region.focus();
      for (let index = 0; index < 4; index++) await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => document.querySelector('.qp-live-flow-table')!.scrollLeft > 0, undefined, { polling: 25, timeout: 12000 });
      horizontalKeyboardScroll = true;
    }
    widths.push({ width, plotHeight: bounds.plot.height, tableWidth: bounds.tableWidth, horizontalKeyboardScroll });
  }
  await summary.focus(); await page.keyboard.press('Enter'); assert.equal(await disclosure.getAttribute('open'), null);
  await page.setViewportSize({ width: 1672, height: 941 }); await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(75);
  const styles = await page.evaluate(() => {
    let ancestor: Element | null = document.querySelector('.qp-live-flow-plot');
    const backgroundLayers: Array<{ selector: string; color: string; image: string }> = [];
    while (ancestor) {
      const style = getComputedStyle(ancestor);
      backgroundLayers.push({ selector: ancestor.tagName.toLowerCase() + (ancestor.getAttribute('class') ? `.${ancestor.getAttribute('class')!.trim().split(/\s+/).join('.')}` : ''), color: style.backgroundColor, image: style.backgroundImage });
      if (ancestor.classList.contains('qp-redesign')) break;
      ancestor = ancestor.parentElement;
    }
    return { backgroundLayers,
      legend: Array.from(document.querySelectorAll('.qp-live-flow-legend>span')).map(element => ({
        series: element.getAttribute('data-series'), text: element.textContent, marker: getComputedStyle(element.querySelector('i')!).backgroundColor,
        foreground: getComputedStyle(element).color, background: getComputedStyle(element).backgroundColor,
      })),
    };
  });
  assert.ok(styles.backgroundLayers.length && styles.backgroundLayers.length <= 12, 'Could not resolve bounded token-flow background layers');
  const plotBackgrounds = resolvedBackgrounds(styles.backgroundLayers);
  assert.deepEqual(styles.legend.map(item => item.series), ['input', 'output', 'total']);
  assert.deepEqual(styles.legend.map(item => item.text), [messages['history.inputCombined'], messages['col.output'], messages['col.total']]);
  const colorEvidence = styles.legend.map(item => {
    const line = snapshot.lines.find(line => line.series === item.series)!;
    assert.deepEqual(rgb(line.stroke), rgb(item.marker), 'Legend marker does not identify the plotted series');
    const legendBackgrounds = uniqueCandidates(plotBackgrounds.map(candidate => ({ color: composite(rgba(item.background), candidate.color), source: `legend span over ${candidate.source}` })));
    const stroke = minimumContrast(line.stroke, plotBackgrounds), marker = minimumContrast(item.marker, legendBackgrounds), text = minimumContrast(item.foreground, legendBackgrounds);
    const strokeContrast = stroke.minimum, markerContrast = marker.minimum, textContrast = text.minimum;
    assert.ok(strokeContrast >= 3 && markerContrast >= 3 && textContrast >= 4.5, `${item.series}: token-flow requires 3:1 for traces/markers and 4.5:1 for text (${JSON.stringify({ strokeContrast, markerContrast, textContrast })})`);
    return { series: item.series, stroke: line.stroke, marker: item.marker, strokeContrast, markerContrast, textContrast,
      strokeAlpha: rgba(line.stroke).alpha, markerAlpha: rgba(item.marker).alpha, textAlpha: rgba(item.foreground).alpha,
      strokeBackgrounds: stroke.measured, legendBackgrounds: legendBackgrounds.map(candidate => candidate.color) };
  });
  assert.equal(new Set(colorEvidence.map(item => JSON.stringify(rgb(item.stroke)))).size, 3, 'The three token series must retain distinct colors');
  return { lang, theme, state, synthetic: state !== 'baseline', latestRailEmpty: !latest, latestMinuteAt: latest?.at ?? null, scope: { from: data.from, to: data.to }, buckets: expected.length,
    recordedMinutes: expected.filter(point => point.state === 'recorded').length, missingMinutes: expected.filter(point => point.state === 'missing').length,
    zeroMinutes: expected.filter(point => point.state === 'zero').length, unknownInputMinutes: expected.filter(point => point.input === null).length,
    unknownOutputMinutes: expected.filter(point => point.output === null).length, partialMinutes: expected.filter(point => point.partial).length,
    mismatchedMinutes: expected.filter(point => point.input !== null && point.output !== null && point.input + point.output !== point.total).length,
    sharedMaximum: maximum, recordedTotalTokens: expected.reduce((sum, point) => sum + point.total, 0), pointCounts, segmentCounts,
    exactApiValues: true, unknownLineGaps: true, totalSelectorPreserved: true, clippedIntervals: true, tableColumns: 9,
    keyboardOpenedAndClosed: true, keyboardFinalMinute: expected.length > 0, widths, colorEvidence,
    backgroundLayers: styles.backgroundLayers.map(layer => ({ ...layer, parsedColor: rgba(layer.color) })), resolvedPlotBackgrounds: plotBackgrounds };
}

export async function checkLiveTokenFlow(page: Page, data: MinuteTrendResponse, lang: string, theme: string, pending: Set<Request>, output: string) {
  const home = new URL(page.url()); home.hash = '#live';
  const origin = home.origin, viewport = page.viewportSize();
  const original = JSON.stringify(data);
  const diagnostic = structuredClone(data);
  const recorded = diagnostic.rows.filter(row => row.records > 0).sort((a, b) => a.bucket_ts - b.bucket_ts);
  assert.ok(recorded.length >= 3 && new Set(recorded.slice(0, 3).map(row => row.bucket_ts)).size === 3, 'Token-flow diagnostics need three distinct actual recorded minutes');
  const zero = recorded[0]!;
  const mismatch = recorded[1]!;
  const unknown = recorded.at(-1)!;
  for (const field of ['input_tokens', 'cached_input_tokens', 'cache_write_tokens', 'output_tokens'] as const) delete unknown![field];
  Object.assign(zero!, { input_tokens: 0, cached_input_tokens: 0, cache_write_tokens: 0, output_tokens: 0, total_tokens: 0 });
  Object.assign(mismatch!, { input_tokens: 1000, cached_input_tokens: 300, cache_write_tokens: 0, output_tokens: 40, total_tokens: 7 });
  assert.deepEqual(diagnostic.coverage, data.coverage, 'Diagnostic component changes must preserve API grain coverage');
  const pattern = (url: URL) => url.origin === origin && url.pathname === '/api/trend' && url.searchParams.get('bucket') === 'minute' && url.searchParams.get('group_by') === 'none';
  let interceptions = 0, installed = false;
  let responseUnderTest: MinuteTrendResponse = diagnostic;
  const handler = async (route: Route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET' || url.searchParams.get('from') !== String(data.from) || url.searchParams.get('to') !== String(data.to)) return route.fallback();
    interceptions++;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(responseUnderTest) });
  };
  const writes: string[] = [];
  const observe = (request: Request) => {
    const url = new URL(request.url());
    if (url.origin === origin && url.pathname.startsWith('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${url.pathname}`);
  };
  page.on('request', observe);
  try {
    console.log(`Live token-flow gate ${lang}/${theme}: baseline`);
    await page.goto(home.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const baseline = await checkValues(page, data, lang, theme, pending, 'baseline');
    assert.ok(baseline.missingMinutes > 0 && baseline.recordedMinutes > 0, 'Canonical flow needs both recorded and missing minute evidence');
    assert.ok(data.rows.some(row => row.records > 0 && row.total_tokens === 1 && row.bucket_ts >= Math.floor(data.from / 60000) * 60000 && row.bucket_ts < data.to), 'Canonical Live must retain its actual one-token minute regression fixture');
    await page.route(pattern, handler); installed = true;
    const synthetic = new URL(home); synthetic.searchParams.set('live-flow', 'synthetic-states');
    console.log(`Live token-flow gate ${lang}/${theme}: diagnostic response`);
    await page.goto(synthetic.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const states = await checkValues(page, diagnostic, lang, theme, pending, 'diagnostic');
    assert.ok(interceptions > 0, 'Diagnostic GET interceptor was never reached');
    assert.ok(states.zeroMinutes > 0 && states.missingMinutes > 0 && states.unknownInputMinutes > 0 && states.unknownOutputMinutes > 0 && states.mismatchedMinutes > 0, 'Diagnostic response did not exercise zero, missing, unknown and stored-total mismatch');
    assert.equal(await page.locator(`.qp-live-chart>circle[data-at="${mismatch!.bucket_ts}"]`).getAttribute('data-value'), '7', 'Stored mismatch total was repaired from components');
    assert.equal(await page.locator(`.qp-live-flow-input circle[data-at="${unknown!.bucket_ts}"]`).count(), 0, 'Omitted input breakdown acquired an invented value');
    assert.equal(await page.locator(`.qp-live-flow-output circle[data-at="${unknown!.bucket_ts}"]`).count(), 0, 'Omitted output breakdown acquired an invented value');
    const summary = page.locator('.qp-live-flow-data>summary'); await summary.focus(); await page.keyboard.press('Enter');
    await page.locator(`.qp-live-flow-data tbody tr[data-at="${unknown!.bucket_ts}"]`).scrollIntoViewIfNeeded();
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(100);
    const filename = `live-flow-states-${lang}-${theme}.png`;
    const screenshot = await page.screenshot({ path: resolve(output, filename), animations: 'disabled', fullPage: true, timeout: 15000 });
    await summary.focus(); await page.keyboard.press('Enter');
    responseUnderTest = { ...diagnostic, rows: [] };
    const emptyWindow = new URL(home); emptyWindow.searchParams.set('live-flow', 'empty-window');
    console.log(`Live token-flow gate ${lang}/${theme}: empty window`);
    await page.goto(emptyWindow.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const empty = await checkValues(page, responseUnderTest, lang, theme, pending, 'empty');
    assert.equal(empty.recordedMinutes, 0);
    assert.equal(empty.latestRailEmpty, true, 'An empty window must show the no-record state rather than borrow an older minute');
    assert.deepEqual(writes, [], 'Live token-flow checks issued an API write');
    assert.equal(JSON.stringify(data), original, 'Synthetic response mutated the supplied real API baseline');
    return [baseline, { ...states, diagnosticGetInterceptions: interceptions, persistedDataChanged: false, writeRequests: 0,
      capture: { filename, sha256: createHash('sha256').update(screenshot).digest('hex'), synthetic: true, approvedVisualBaseline: false } },
    { ...empty, diagnosticGetInterceptions: interceptions, persistedDataChanged: false, writeRequests: 0 }];
  } finally {
    if (installed) await page.unroute(pattern, handler);
    page.off('request', observe);
    if (viewport) await page.setViewportSize(viewport);
    await page.goto(home.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.locator('.qp-live-token-flow').waitFor({ timeout: 12000 }); await settle(page, pending);
    await page.evaluate(() => scrollTo(0, 0));
  }
}
