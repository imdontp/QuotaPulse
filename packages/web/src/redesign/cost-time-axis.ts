interface CostTimeScope {
  from: number;
  to: number;
  bucketMs: number;
  starts: readonly number[];
}

/** Labels sample actual bucket boundaries; endpoints retain the exact API scope. */
export function costTimeAxis(scope: CostTimeScope, language: 'en' | 'th', timeZone?: string) {
  const { from, to, bucketMs, starts } = scope;
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || bucketMs <= 0) return [];
  const daily = bucketMs >= 86_400_000 && to - from >= 86_400_000;
  const firstDate = new Date(from), lastDate = new Date(to - 1);
  const years = new Intl.DateTimeFormat('en', { year: 'numeric', timeZone });
  const includeYear = years.format(firstDate) !== years.format(lastDate);
  const formatter = new Intl.DateTimeFormat(language === 'th' ? 'th-TH' : 'en-US', {
    timeZone,
    ...(daily || to - from >= 86_400_000 ? { month: 'short' as const, day: 'numeric' as const } : {}),
    ...(includeYear ? { year: 'numeric' as const } : {}),
    ...(!daily ? { hour: '2-digit' as const, minute: '2-digit' as const, hourCycle: 'h23' as const } : {}),
  });
  const candidates = [...new Set([from, ...starts.filter(at => Number.isFinite(at) && at > from && at < to), to])].sort((a, b) => a - b);
  // For daily buckets, the final label names the last included day, not the next
  // day at an exclusive midnight. It replaces an interior label for that day.
  const labels = candidates.map(at => ({ at, label: formatter.format(daily && at === to ? to - 1 : at) }));
  const uniqueDays = new Map<string, (typeof labels)[number]>();
  if (daily) for (const tick of labels) {
    if (!uniqueDays.has(tick.label) || tick.at === to) uniqueDays.set(tick.label, tick);
  }
  const ticks = daily ? uniqueDays.size > 1 ? [...uniqueDays.values()] : [labels[0]!, labels.at(-1)!] : labels;
  const sampled = ticks.length <= 9 ? ticks : Array.from({ length: 9 }, (_, index) => ticks[Math.round(index * (ticks.length - 1) / 8)]!);
  return sampled.map(tick => ({ ...tick, position: (tick.at - from) / (to - from) * 100 }));
}
