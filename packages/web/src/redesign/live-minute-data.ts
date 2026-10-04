import type { ProviderModelMinuteResponse } from '@/api';

export interface LiveMinuteBucket {
  at: number;
  start: number;
  end: number;
  partial: boolean;
}
export interface LiveMinuteCell extends LiveMinuteBucket {
  state: 'missing' | 'zero' | 'recorded';
  tokens: number | null;
  records: number | null;
  calls: number | null;
  intensity: number;
}

export function liveMinutePairKey(pair: { provider: string | null; model: string | null }) {
  return JSON.stringify([pair.provider, pair.model]);
}

/** Minute bins intersecting the exact half-open observation window, without filling missing data. */
export function liveMinuteBuckets(from: number, to: number): LiveMinuteBucket[] {
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || to - from > 86400000) return [];
  const first = Math.floor(from / 60000) * 60000;
  const count = Math.floor((to - 1) / 60000) - Math.floor(from / 60000) + 1;
  return Array.from({ length: count }, (_, index) => {
    const at = first + index * 60000;
    const start = Math.max(at, from);
    const end = Math.min(at + 60000, to);
    return { at, start, end, partial: end - start < 60000 };
  });
}

export function liveMinutePairs(data: ProviderModelMinuteResponse) {
  const buckets = liveMinuteBuckets(data.from, data.to);
  const rows = new Map(data.rows.map(row => [JSON.stringify([row.bucket_ts, row.provider, row.model]), row]));
  const max = data.rows.reduce((value, row) => Math.max(value, row.total_tokens), 0);
  return data.groups.slice(0, 12).map(group => ({
    ...group,
    key: liveMinutePairKey(group),
    cells: buckets.map(bucket => {
      const row = rows.get(JSON.stringify([bucket.at, group.provider, group.model]));
      const observed = row !== undefined && row.records > 0;
      return {
        ...bucket,
        state: !observed ? 'missing' : row.total_tokens === 0 ? 'zero' : 'recorded',
        tokens: observed ? row.total_tokens : null,
        records: observed ? row.records : null,
        calls: observed ? row.calls : null,
        intensity: observed && max > 0 ? row.total_tokens / max : 0,
      } satisfies LiveMinuteCell;
    }),
  }));
}
