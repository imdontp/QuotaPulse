import type { RuntimeObservation } from './runtime-motion';

/** Recency of actual observations in the current period/source, not execution or quota-owner attribution. */
export function recentRuntimeExpiry(rows: readonly Pick<RuntimeObservation, 'timestamp_ms' | 'grain'>[], now: number, windowMs: number): number | null {
  if (!Number.isFinite(now) || !Number.isFinite(windowMs) || windowMs <= 0) return null;
  let latest: number | null = null;
  for (const row of rows) {
    if (row.grain !== 'call' && row.grain !== 'session_aggregate') continue;
    if (!Number.isFinite(row.timestamp_ms) || row.timestamp_ms > now || now - row.timestamp_ms >= windowMs) continue;
    latest = Math.max(latest ?? row.timestamp_ms, row.timestamp_ms);
  }
  const expiry = latest === null ? null : latest + windowMs;
  return expiry !== null && Number.isFinite(expiry) ? expiry : null;
}
