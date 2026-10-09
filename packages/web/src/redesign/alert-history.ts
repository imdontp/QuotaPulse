import type { Limit, QuotaHistoryResponse } from '../api.js';
import { isQuotaReadingFresh, quotaOwnerKey, quotaWindowKey } from './alert-risks.js';

export type AlertHistoryResult = { data: QuotaHistoryResponse | null; error: string | null };
type Entry = { fingerprint: string; fetchedAt: number; result: AlertHistoryResult; pending?: Promise<AlertHistoryResult> };
type Read = (scope: { subscriptionKey: string; windowKind: string; from: number; to: number }) => Promise<QuotaHistoryResponse>;

/** One shared, bounded cache for the selected chart and observed row histories. */
export class AlertHistoryCache {
  private entries = new Map<string, Entry>();
  constructor(private read: Read, private clock = () => Date.now()) {}

  async load(readings: Limit[], now: number, force = false): Promise<Map<string, AlertHistoryResult>> {
    const unique = [...new Map(readings.map(reading => [quotaWindowKey(reading), reading])).values()].slice(0, 6);
    const keys = new Set(unique.map(quotaWindowKey));
    for (const key of this.entries.keys()) if (!keys.has(key)) this.entries.delete(key);
    return new Map(await Promise.all(unique.map(async reading => {
      const key = quotaWindowKey(reading);
      const fingerprint = JSON.stringify([reading.source_id, reading.origin, reading.last_seen_at, reading.resets_at, reading.used_percent, isQuotaReadingFresh(reading, now)]);
      let entry = this.entries.get(key);
      if (entry?.pending) {
        await entry.pending;
        // A changed reader must not inherit an older in-flight response.
        if (entry.fingerprint === fingerprint) return [key, entry.result] as const;
      }
      if (entry && entry.fingerprint === fingerprint && !force && this.clock() - entry.fetchedAt < 60_000) return [key, entry.result] as const;
      entry = { fingerprint, fetchedAt: 0, result: { data: null, error: null } };
      this.entries.set(key, entry);
      const current = entry;
      current.pending = this.read({ subscriptionKey: quotaOwnerKey(reading), windowKind: reading.window_kind, from: Math.max(0, now - 30 * 86_400_000), to: now + 1 })
        .then(data => {
          if (data.subscriptionKey !== quotaOwnerKey(reading) || data.windowKind !== reading.window_kind) throw new Error('Quota history owner/window mismatch');
          return { data, error: null };
        }).catch(cause => ({ data: null, error: String(cause) }))
        .then(result => { current.result = result; current.fetchedAt = this.clock(); current.pending = undefined; return result; });
      return [key, await current.pending] as const;
    })));
  }
}

/** Preserve null/reset gaps; timestamps and percentages are never interpolated. */
export function observedQuotaSeries(history: QuotaHistoryResponse) {
  const totalSamples = history.segments.reduce((count, segment) => count + segment.samples.length, 0);
  const segments: QuotaHistoryResponse['segments'] = [];
  let remaining = 256;
  for (let i = history.segments.length - 1; i >= 0 && remaining > 0; i--) {
    const segment = history.segments[i];
    const samples = segment.samples.slice(-remaining);
    remaining -= samples.length;
    segments.unshift({ resetAt: segment.resetAt, samples });
  }
  const samples = segments.flatMap(segment => segment.samples);
  const first = samples.reduce((at, sample) => Math.min(at, sample.observedAt), Infinity);
  const last = samples.reduce((at, sample) => Math.max(at, sample.observedAt), -Infinity);
  const x = (at: number) => first === last ? 50 : 3 + (at - first) / (last - first) * 94;
  const y = (percent: number) => 3 + (100 - Math.min(100, Math.max(0, percent))) * .26;
  const points: Array<{ x: number; y: number; at: number; percent: number }> = [];
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
  for (const segment of segments) segment.samples.forEach((sample, i) => {
    if (sample.usedPercent === null) return;
    points.push({ x: x(sample.observedAt), y: y(sample.usedPercent), at: sample.observedAt, percent: sample.usedPercent });
    const previous = segment.samples[i - 1];
    if (previous?.usedPercent != null) lines.push({ x1: x(previous.observedAt), y1: y(previous.usedPercent), x2: x(sample.observedAt), y2: y(sample.usedPercent) });
  });
  return { points, lines, first, last, totalSamples, displayedSamples: samples.length };
}

export function currentQuotaForecast(history: QuotaHistoryResponse | null, reading: Limit | undefined, now: number) {
  const reader = history?.reader;
  return reading && reader && isQuotaReadingFresh(reading, now) && reader.sourceId === reading.source_id &&
    reader.origin === reading.origin && reader.lastSeenAt === reading.last_seen_at && reader.resetAt === reading.resets_at &&
    (reader.freshness === 'live' || reader.freshness === 'recent') ? reader.forecast : null;
}
