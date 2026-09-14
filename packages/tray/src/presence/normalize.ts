import { isExpired, subscriptionLimits, type Limit } from '../limits.js';
import {
  SEVERITY_CRIT_AT,
  SEVERITY_WARN_AT,
  type ProviderPresence,
  type ProviderWindow,
  type Severity,
} from './types.js';

/**
 * Quota rows -> deduplicated provider presence (docs/PET_MODE_V2_SPEC.md §8).
 *
 * `subscriptionLimits()` stays the normalization boundary, exactly as the spec requires:
 * Codex and Hermes can both report one OpenAI subscription, and they must collapse to a
 * single presence record here. A provider's window is the WORST live window it owns --
 * the 5-hour window at 90% matters more than the weekly one at 10%.
 */

/** The minimal slice of `SubscriptionStatus` this module needs (from /api/overview). */
export interface SubscriptionInfo {
  subscription_key: string;
  subscription_display_name: string;
  state: string;
  telemetry?: { latest_usage_at?: number | null } | null;
}

export function severityForPercent(percent: number | null | undefined): Severity {
  if (percent == null) return 'unknown';
  if (percent >= SEVERITY_CRIT_AT) return 'crit';
  if (percent >= SEVERITY_WARN_AT) return 'warn';
  return 'ok';
}

const SEVERITY_RANK: Record<Severity, number> = { unknown: 0, ok: 1, warn: 2, crit: 3 };
export const severityRank = (s: Severity): number => SEVERITY_RANK[s];

/**
 * Display order for a provider's windows: shortest first, so "5-hour then weekly" reads the
 * way the harnesses themselves present it. Unknown kinds sort last, alphabetically.
 */
const WINDOW_ORDER = ['5h', 'session', 'weekly', 'weekly_opus', 'weekly_sonnet', 'monthly', 'credits'];
const windowRank = (kind: string): number => {
  const i = WINDOW_ORDER.indexOf(kind);
  return i === -1 ? WINDOW_ORDER.length : i;
};

/** Canonical ownership: subscription_key -> account_key -> source:<id> (spec §8). */
export function ownerKeyOf(limit: Limit): string {
  return limit.subscription_key ?? limit.account_key ?? `source:${limit.source_id}`;
}

export function buildProviderPresence(
  limits: Limit[],
  subscriptions: SubscriptionInfo[],
  now = Date.now(),
  activeOwnerKeys: ReadonlySet<string> = new Set(),
): ProviderPresence[] {
  const byOwner = new Map<string, ProviderPresence>();

  const windowsByOwner = new Map<string, ProviderWindow[]>();
  const names = new Map<string, string>();
  for (const row of subscriptionLimits(limits, now)) {
    const key = ownerKeyOf(row);
    const name = row.subscription_display_name ?? row.account_display_name ?? row.display_name;
    if (name) names.set(key, name);
    // Expired windows cannot describe the current period, so they are never shown.
    if (row.used_percent == null || isExpired(row, now)) continue;
    if (!windowsByOwner.has(key)) windowsByOwner.set(key, []);
    windowsByOwner.get(key)!.push({
      windowKind: row.window_kind,
      usedPercent: row.used_percent,
      resetsAt: row.resets_at,
      ageSeconds: row.ageSeconds ?? null,
    });
  }

  for (const [key, windows] of windowsByOwner) {
    windows.sort(
      (a, b) => windowRank(a.windowKind) - windowRank(b.windowKind) || a.windowKind.localeCompare(b.windowKind),
    );
    const worst = windows.reduce((a, b) => (b.usedPercent > a.usedPercent ? b : a));
    byOwner.set(key, {
      key,
      name: names.get(key) ?? key,
      usedPercent: worst.usedPercent,
      windowKind: worst.windowKind,
      resetsAt: worst.resetsAt,
      severity: severityForPercent(worst.usedPercent),
      active: activeOwnerKeys.has(key),
      ageSeconds: worst.ageSeconds,
      windows,
    });
  }

  // A subscription with no readable window still exists -- show it as `unknown` rather
  // than pretending the provider vanished. Inactive (unsubscribed) ones do not.
  for (const sub of subscriptions) {
    if (sub.state === 'inactive' || byOwner.has(sub.subscription_key)) continue;
    byOwner.set(sub.subscription_key, {
      key: sub.subscription_key,
      name: sub.subscription_display_name,
      usedPercent: null,
      windowKind: '',
      resetsAt: null,
      severity: 'unknown',
      active: activeOwnerKeys.has(sub.subscription_key),
      ageSeconds: null,
      windows: [],
    });
  }

  // Stable order: rotation indexes into this array, so it must not reshuffle per tick.
  return [...byOwner.values()].sort((a, b) => a.name.localeCompare(b.name) || a.key.localeCompare(b.key));
}

/** Highest valid severity across every provider (spec §10). */
export function resolveGlobalSeverity(providers: ProviderPresence[]): Severity {
  if (providers.some((p) => p.severity === 'crit')) return 'crit';
  if (providers.some((p) => p.severity === 'warn')) return 'warn';
  if (providers.some((p) => p.severity === 'ok')) return 'ok';
  return 'unknown';
}

/**
 * The riskiest provider, for the tray and the global halo. Ties break toward the higher
 * used percentage, then by name, so the answer is stable for identical inputs.
 */
export function highestProvider(providers: ProviderPresence[]): ProviderPresence | null {
  let best: ProviderPresence | null = null;
  for (const p of providers) {
    if (!best) {
      best = p;
      continue;
    }
    const rank = severityRank(p.severity);
    const bestRank = severityRank(best.severity);
    if (rank !== bestRank) {
      if (rank > bestRank) best = p;
      continue;
    }
    const used = p.usedPercent ?? -1;
    const bestUsed = best.usedPercent ?? -1;
    if (used > bestUsed) best = p;
  }
  return best;
}

/**
 * Which subscription the daemon most recently recorded usage for (spec §13 priority 3).
 * `/api/overview` carries `telemetry.latest_usage_at` per subscription, which is the only
 * honest per-provider activity signal: an account reader polling every 60s makes a small
 * `ageSeconds` look active even when nobody is working.
 */
export function activeOwnerKey(
  subscriptions: SubscriptionInfo[],
  now = Date.now(),
  withinMs = 120_000,
): string | null {
  let key: string | null = null;
  let latest = -Infinity;
  for (const sub of subscriptions) {
    const at = sub.telemetry?.latest_usage_at ?? null;
    if (at == null || at > now || now - at > withinMs) continue;
    if (at > latest) {
      latest = at;
      key = sub.subscription_key;
    }
  }
  return key;
}
