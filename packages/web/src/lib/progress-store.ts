import { useEffect, useMemo, useRef, useState } from 'react';
import type { Overview } from '../api';
import { thresholdLimits } from '../format';
import { dayKey, evaluateProgress, isBadgeId, orderedBadges, type Progress } from './progress';

/*
 * Progression persistence. The dashboard is forbidden from any write except the two
 * settings endpoints (scripts/check-ui.mjs asserts it), so this lives in localStorage next
 * to language and currency. It is a convenience layer: if the browser blocks storage, the
 * score still computes from the day list held in memory, it simply resets on reload.
 */
const STORAGE_KEY = 'quotapulse-progress';
const VERSION = 1;

/**
 * Enough history for the 30-day badge plus slack. Older days cannot change any state, so
 * an unbounded list would just be a slow leak in the user's browser.
 */
export const MAX_DAYS = 45;

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

export interface ProgressStore {
  version: number;
  /** Local `YYYY-MM-DD` days on which any usage was recorded. */
  days: string[];
  unlocked: string[];
}

const EMPTY: ProgressStore = { version: VERSION, days: [], unlocked: [] };

/**
 * Coerces anything that came out of storage into the current shape. Exported because a
 * corrupt, hand-edited or half-migrated value must degrade to a clean store rather than
 * throw during the first render, and that behaviour is worth testing directly.
 */
export function normalizeStore(value: unknown): ProgressStore {
  const source = (value ?? {}) as Partial<ProgressStore>;
  const days = Array.isArray(source.days)
    ? [...new Set(source.days.filter((d): d is string => typeof d === 'string' && DAY_KEY.test(d)))]
    : [];
  const unlocked = Array.isArray(source.unlocked) ? orderedBadges(source.unlocked.filter(isBadgeId)) : [];
  // ISO dates sort chronologically as strings, so this also trims the oldest days.
  return { version: VERSION, days: days.sort().slice(-MAX_DAYS), unlocked };
}

function loadStore(): ProgressStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeStore(JSON.parse(raw)) : EMPTY;
  } catch {
    /* Blocked storage, private window, or hand-corrupted JSON: start clean. */
    return EMPTY;
  }
}

function saveStore(store: ProgressStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* remembering the score is a convenience, never a requirement */
  }
}

const ZERO = { calls: 0, cached_input_tokens: 0, input_tokens: 0, cache_write_tokens: 0 };

/**
 * Live progression for the dashboard.
 *
 * `firstActivityHour` is passed in rather than fetched here: the hourly series belongs to
 * the Live section's own refresh, and this hook must not start a second query.
 */
export function useProgress(ov: Overview, firstActivityHour: number | null = null): Progress {
  const [store, setStore] = useState<ProgressStore>(loadStore);
  const today = ov?.today ?? ZERO;
  const now = ov?.now ?? Date.now();
  const todayKey = dayKey(now);
  const activeToday = (today.calls ?? 0) > 0;

  /*
   * Today is folded into the day list before evaluating rather than written to storage
   * first, so the very first render is already correct even when persistence is blocked.
   */
  const days = useMemo(() => {
    const base = activeToday && !store.days.includes(todayKey) ? [...store.days, todayKey] : store.days;
    return normalizeStore({ days: base }).days;
  }, [store.days, activeToday, todayKey]);

  const quotaHealthy = useMemo(() => {
    const limits = ov?.limits ?? [];
    // No readings is unknown, not healthy. An empty dashboard must not pay out.
    if (limits.length === 0) return false;
    return thresholdLimits(limits, now).length === 0;
  }, [ov?.limits, now]);

  const progress = useMemo(
    () => evaluateProgress({ now, today, quotaHealthy, days, unlocked: store.unlocked, firstActivityHour }),
    [now, today, quotaHealthy, days, store.unlocked, firstActivityHour],
  );

  /*
   * The dashboard re-renders on every coalesced SSE push, and a busy day produces a fresh
   * `unlocked` array identity each time. Comparing the serialized value is what keeps this
   * from rewriting localStorage several times a minute, and from re-granting a badge the
   * user already has.
   */
  const lastPersisted = useRef<string | null>(null);
  useEffect(() => {
    const next = normalizeStore({ days, unlocked: progress.unlocked });
    const serialized = JSON.stringify(next);
    if (serialized === lastPersisted.current) return;
    lastPersisted.current = serialized;
    saveStore(next);
    setStore(next);
  }, [days, progress.unlocked]);

  return progress;
}
