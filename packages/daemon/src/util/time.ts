/** Every timestamp inside QuotaPulse is epoch milliseconds UTC. Adapters convert on the way in. */
export type Millis = number;

export function fromIso(v: unknown): Millis | null {
  if (typeof v !== 'string') return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : null;
}

/** Codex writes `resets_at` as epoch SECONDS; OpenCode/Cursor write epoch MILLIS. */
export function fromEpochSeconds(v: unknown): Millis | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

export function fromEpochMillis(v: unknown): Millis | null {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Hermes stores float epoch seconds; some tools store millis in the same shaped field.
 * Disambiguate by magnitude: anything below year ~2286 in seconds is seconds.
 */
export function fromEpochAuto(v: unknown): Millis | null {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n < 1e11 ? Math.round(n * 1000) : Math.round(n);
}

export const hourBucket = (ms: Millis) => ms - (ms % 3_600_000);
export const dayBucket = (ms: Millis) => {
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};
