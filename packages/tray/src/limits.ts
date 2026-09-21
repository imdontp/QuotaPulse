/**
 * Which quota reading to trust, and how to say it in the few characters a Windows tray
 * tooltip allows. Deliberately free of Electron imports so it can be tested headlessly.
 */

export interface Limit {
  source_id: number;
  display_name: string;
  window_kind: string;
  used_percent: number | null;
  resets_at: number | null;
  origin: string;
  ageSeconds: number | null;
  burn: { percentPerHour: number; projectedFullAt: number | null } | null;
  /** Canonical quota owner. Several harness/account readers can share one subscription. */
  account_key?: string | null;
  subscription_key?: string | null;
  account_display_name?: string | null;
  subscription_display_name?: string | null;
}

/** How long each quota window covers; used to judge a reading with no reset timestamp. */
const WINDOW_SPAN_MS: Record<string, number> = {
  '5h': 5 * 3_600_000,
  weekly: 7 * 86_400_000,
  weekly_opus: 7 * 86_400_000,
  weekly_sonnet: 7 * 86_400_000,
  monthly: 31 * 86_400_000,
  session: 5 * 3_600_000,
};

const WINDOW_ORDER = ['5h', 'weekly', 'weekly_opus', 'weekly_sonnet', 'monthly'];
const SHORT_WINDOW_LABEL: Record<string, string> = {
  '5h': '5h',
  weekly: 'wk',
  weekly_opus: 'wk-opus',
  weekly_sonnet: 'wk-sonnet',
  monthly: 'mo',
};

const windowRank = (kind: string): number => {
  const rank = WINDOW_ORDER.indexOf(kind);
  return rank < 0 ? WINDOW_ORDER.length : rank;
};

const compareLimits = (a: Limit, b: Limit): number =>
  a.display_name.localeCompare(b.display_name) || windowRank(a.window_kind) - windowRank(b.window_kind);

/**
 * A reading is void when it can no longer describe the CURRENT window, for either of two
 * reasons:
 *
 *  1. its window has rolled over (`resets_at` has passed), so the quota is back near zero;
 *  2. it is older than the window itself. Claude's cached config fallback publishes a
 *     percentage with no reset time at all, and a two-day-old "0%" cannot possibly be a
 *     statement about a five-hour window.
 *
 * Age on its own is NOT the test. An earlier flat one-hour cutoff here was why the tooltip
 * only ever showed one source: Codex republishes quota only when Codex is used, and a
 * Claude profile writes a statusline only while it has a live session, so both were
 * routinely "too old" and vanished. A weekly reading three hours old is good information
 * about a seven-day window; it just needs its age shown beside it.
 */
export function isExpired(l: Limit, now = Date.now()): boolean {
  if (l.resets_at != null && l.resets_at <= now) return true;
  const span = WINDOW_SPAN_MS[l.window_kind];
  if (span != null && l.ageSeconds != null && l.ageSeconds * 1000 > span) return true;
  return false;
}

export function isUsable(l: Limit, now = Date.now()): boolean {
  return l.used_percent != null && !isExpired(l, now);
}

/**
 * One row per (source, window), keeping whichever origin confirmed it most recently, so a
 * live statusline reading always beats the same window's stale config fallback.
 */
export function currentLimits(all: Limit[], now = Date.now()): Limit[] {
  const best = new Map<string, Limit>();
  for (const l of all) {
    if (l.used_percent == null) continue;
    const key = `${l.source_id}:${l.window_kind}`;
    const prev = best.get(key);
    if (!prev) {
      best.set(key, l);
      continue;
    }
    // A still-valid window beats a rolled-over one even if the dead one is fresher.
    const prevDead = isExpired(prev, now);
    const currDead = isExpired(l, now);
    if (prevDead !== currDead) {
      if (prevDead) best.set(key, l);
      continue;
    }
    if ((l.ageSeconds ?? Infinity) < (prev.ageSeconds ?? Infinity)) best.set(key, l);
  }
  return [...best.values()].sort(compareLimits);
}

const ownerKey = (l: Limit): string =>
  l.subscription_key ?? l.account_key ?? `source:${l.source_id}`;

/** The daemon stores hidden subscriptions by this same canonical owner key. */
export function hiddenOwnerKey(l: Pick<Limit, 'source_id' | 'account_key' | 'subscription_key'>): string {
  return l.subscription_key ?? l.account_key ?? `source:${l.source_id}`;
}

/** Apply the shared Settings visibility choice before any tray surface is resolved. */
export function visibleLimits(all: Limit[], hiddenSubscriptions: readonly string[]): Limit[] {
  const hidden = new Set(hiddenSubscriptions.filter(Boolean));
  return all.filter((l) => !hidden.has(hiddenOwnerKey(l)));
}

const ownerName = (l: Limit): string =>
  l.subscription_display_name ?? l.account_display_name ?? l.display_name;

/**
 * One row per (subscription, window), collapsing readers such as Codex and Hermes that
 * report the same OpenAI quota. Reader/origin deduplication happens first, so a live
 * statusline still beats that source's cached fallback before subscriptions are merged.
 */
export function subscriptionLimits(all: Limit[], now = Date.now()): Limit[] {
  const best = new Map<string, Limit>();
  for (const l of currentLimits(all, now)) {
    const key = `${ownerKey(l)}:${l.window_kind}`;
    const candidate = { ...l, display_name: ownerName(l) };
    const prev = best.get(key);
    if (!prev) {
      best.set(key, candidate);
      continue;
    }

    // A still-valid reader is preferable to an expired reader for the same quota pool.
    const prevDead = isExpired(prev, now);
    const currDead = isExpired(candidate, now);
    if (prevDead !== currDead) {
      if (prevDead) best.set(key, candidate);
      continue;
    }
    if ((candidate.ageSeconds ?? Infinity) < (prev.ageSeconds ?? Infinity)) {
      best.set(key, candidate);
    }
  }

  return [...best.values()].sort(compareLimits);
}

/** The badge tracks the worst limit that is still live. */
export function worst(all: Limit[], now = Date.now()): Limit | null {
  const usable = currentLimits(all, now).filter((l) => isUsable(l, now));
  if (usable.length === 0) return null;
  return usable.reduce((a, b) => ((b.used_percent ?? 0) > (a.used_percent ?? 0) ? b : a));
}

export const shortAge = (s: number | null | undefined): string => {
  if (s == null) return '';
  if (s < 120) return ''; // live: saying so would cost characters for no information
  if (s < 5400) return ` ${Math.round(s / 60)}m`;
  if (s < 172800) return ` ${Math.round(s / 3600)}h`;
  return ` ${Math.round(s / 86400)}d`;
};

export const shortWindow = (kind: string): string =>
  SHORT_WINDOW_LABEL[kind] ?? kind.replace('weekly_', 'wk-');

export const shortSource = (name: string): string =>
  name
    .replace(/^OpenAI Subscription$/, 'OpenAI')
    .replace(/^Claude Company Subscription$/, 'Claude company')
    .replace(/^Claude Personal Subscription$/, 'Claude personal')
    .replace(/^OpenCode Go Subscription$/, 'OpenCode Go')
    .replace(/^Claude Code$/, 'Claude')
    .replace(/^Claude Code \((.+)\)$/, 'Claude $1')
    .replace(/^Codex CLI$/, 'Codex')
    .replace(/^Hermes Agent$/, 'Hermes')
    .replace(/^Hermes Agent \((.+)\)$/, 'Hermes $1');

export const clockAt = (ms: number | null): string =>
  ms == null ? '' : new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export type TrayConnectionStatus = 'connecting' | 'online' | 'offline';

/** Keep the Windows hover affordance predictable: identity on line one, connection on line two. */
export function buildTooltip(status: TrayConnectionStatus): string {
  const label = status === 'online' ? 'Online' : status === 'connecting' ? 'Connecting' : 'Offline';
  return `QuotaPulse\n${label}`;
}
