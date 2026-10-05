import { isExpired, primaryLimits, type WindowReadings } from '../format.js';
import type { Limit, Overview } from '../api.js';

export interface QuotaRisk {
  key: string;
  owner: string;
  window: string;
  title: string;
  reading: Limit;
  level: 'critical' | 'warning' | 'info' | 'stale';
  reason: 'forecast' | 'threshold' | 'stale';
}

export interface QuotaRiskModel {
  windows: Array<WindowReadings<Limit>>;
  risks: QuotaRisk[];
  activeRisks: QuotaRisk[];
  freshCount: number;
}

export const quotaOwnerKey = (reading: Limit) => reading.subscription_key ?? reading.account_key ?? `source:${reading.source_id}`;
export const quotaWindowKey = (reading: Limit) => JSON.stringify([quotaOwnerKey(reading), reading.window_kind]);
export const isQuotaReadingFresh = (reading: Limit, now: number) =>
  reading.last_seen_at <= now && now - reading.last_seen_at < 3_600_000 && !isExpired(reading, now);

export function getQuotaRiskModel(readings: Limit[], hiddenSubscriptions: string[], now: number): QuotaRiskModel {
  const windows = primaryLimits(readings, now).filter(({ primary }) => !hiddenSubscriptions.includes(quotaOwnerKey(primary)));
  const risks = windows.flatMap<QuotaRisk>(({ primary }): QuotaRisk[] => {
    const owner = quotaOwnerKey(primary);
    const base = {
      key: quotaWindowKey(primary),
      owner,
      window: primary.window_kind,
      title: primary.subscription_display_name ?? primary.display_name,
      reading: primary,
    };
    if (!isQuotaReadingFresh(primary, now) || primary.used_percent === null) return [{ ...base, level: 'stale', reason: 'stale' }];
    const forecastBeforeReset = primary.forecast?.status === 'ready' && primary.forecast.projectedFullAt != null &&
      primary.resets_at != null && primary.forecast.projectedFullAt < primary.resets_at;
    if (forecastBeforeReset) return [{ ...base, level: 'critical', reason: 'forecast' }];
    if (primary.used_percent >= 95) return [{ ...base, level: 'critical', reason: 'threshold' }];
    if (primary.used_percent >= 80) return [{ ...base, level: 'warning', reason: 'threshold' }];
    if (primary.used_percent >= 50) return [{ ...base, level: 'info', reason: 'threshold' }];
    return [];
  }).sort((a, b) => ({ critical: 0, warning: 1, info: 2, stale: 3 })[a.level] -
    ({ critical: 0, warning: 1, info: 2, stale: 3 })[b.level] || a.title.localeCompare(b.title));
  const activeRisks = risks.filter(risk => risk.level !== 'stale');
  const freshCount = windows.filter(({ primary }) => isQuotaReadingFresh(primary, now) && primary.used_percent !== null).length;
  return { windows, risks, activeRisks, freshCount };
}

export function activeQuotaRiskCount(overview: Overview): number {
  return getQuotaRiskModel(overview.limits, overview.settings.hidden_subscriptions, overview.now).activeRisks.length;
}
