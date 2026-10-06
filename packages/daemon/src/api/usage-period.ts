export type UsageRangeKey = 'today' | 'week' | 'month' | 'last30' | 'all' | 'custom';
export type UsageBucket = 'hour' | 'day' | 'week' | 'month';

export interface UsagePeriod {
  range: UsageRangeKey;
  from: number;
  to: number;
  timezone: string;
  bucket: UsageBucket;
}

export interface UsagePeriodInput {
  range: UsageRangeKey;
  from?: number;
  to?: number;
  bucket?: UsageBucket;
  now?: number;
}

const DAY_MS = 86_400_000;

function localMidnight(value: number): number {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function startOfLocalWeek(value: number): number {
  const date = new Date(localMidnight(value));
  const daysSinceMonday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - daysSinceMonday);
  return date.getTime();
}

export function startOfLocalMonth(value: number): number {
  const date = new Date(localMidnight(value));
  date.setDate(1);
  return date.getTime();
}

function timezoneName(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'local';
}

function automaticBucket(range: UsageRangeKey, from: number, to: number): UsageBucket {
  if (range === 'today') return 'hour';
  if (range === 'week' || range === 'month' || range === 'last30') return 'day';
  if (range === 'all') return 'month';
  const spanDays = (to - from) / DAY_MS;
  if (spanDays <= 31) return 'day';
  if (spanDays <= 180) return 'week';
  return 'month';
}

function validEpoch(value: number | undefined): value is number {
  return value != null && Number.isSafeInteger(value) && value >= 0;
}

export function resolveUsagePeriod(input: UsagePeriodInput): UsagePeriod {
  const now = input.now ?? Date.now();
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('Invalid usage period now');

  let from: number;
  let to: number;
  switch (input.range) {
    case 'today':
      from = localMidnight(now);
      to = now;
      break;
    case 'week':
      from = startOfLocalWeek(now);
      to = now;
      break;
    case 'month':
      from = startOfLocalMonth(now);
      to = now;
      break;
    case 'last30':
      from = now - 30 * DAY_MS;
      to = now;
      break;
    case 'all':
      from = 0;
      to = now;
      break;
    case 'custom':
      if (!validEpoch(input.from) || !validEpoch(input.to) || input.to <= input.from) {
        throw new Error('Custom usage range requires a valid from/to window');
      }
      from = input.from;
      to = input.to;
      break;
    default:
      throw new Error('Unknown usage range');
  }

  if (to <= from) throw new Error('Usage range is empty');
  return {
    range: input.range,
    from,
    to,
    timezone: timezoneName(),
    bucket: input.bucket ?? automaticBucket(input.range, from, to),
  };
}
