import * as React from 'react';
import { Select } from '@/components/ui/select';
import { useT } from '@/i18n';
import type { UsageBucket, UsageRangeKey } from '@/api';

export type UsageView = 'summary' | 'cost' | 'projects' | 'models';

export interface UsageSelection {
  range: UsageRangeKey;
  from?: number;
  to?: number;
  bucket?: UsageBucket | 'auto';
  sourceId?: number;
}

export interface UsageRoute {
  selection: UsageSelection;
  view: UsageView;
}

export interface UsageRouteUpdate {
  selection?: Partial<UsageSelection>;
  view?: UsageView;
}

const RANGE_KEYS: UsageRangeKey[] = ['today', 'week', 'month', 'all', 'custom'];
const BUCKET_KEYS: Array<UsageBucket | 'auto'> = ['auto', 'hour', 'day', 'week', 'month'];
const VIEW_KEYS: UsageView[] = ['summary', 'cost', 'projects', 'models'];
const DAY = 86_400_000;

function routeHash(scope: 'usage' | 'sessions' | 'history', route: UsageRoute): string {
  const params = new URLSearchParams();
  params.set('range', route.selection.range);
  if (route.selection.range === 'custom') {
    if (route.selection.from != null) params.set('from', String(route.selection.from));
    if (route.selection.to != null) params.set('to', String(route.selection.to));
  }
  if (route.selection.bucket && route.selection.bucket !== 'auto') params.set('bucket', route.selection.bucket);
  if (route.selection.sourceId != null) params.set('source', String(route.selection.sourceId));
  if (scope === 'usage') params.set('view', route.view);
  return `#${scope}?${params.toString()}`;
}

function readRoute(scope: 'usage' | 'sessions' | 'history'): UsageRoute {
  if (typeof window === 'undefined') return { selection: { range: 'today', bucket: 'auto' }, view: 'summary' };
  const [path, rawQuery = ''] = window.location.hash.slice(1).split('?');
  const params = new URLSearchParams(rawQuery);
  const rawRange = params.get('range') as UsageRangeKey | null;
  const range = rawRange && RANGE_KEYS.includes(rawRange) ? rawRange : 'today';
  const rawBucket = params.get('bucket') as UsageBucket | null;
  const bucket = rawBucket && BUCKET_KEYS.includes(rawBucket) ? rawBucket : 'auto';
  const source = Number(params.get('source'));
  const rawView = params.get('view') as UsageView | null;
  const view = rawView && VIEW_KEYS.includes(rawView) ? rawView : 'summary';
  const from = Number(params.get('from'));
  const to = Number(params.get('to'));
  return {
    selection: {
      range,
      bucket,
      ...(range === 'custom' && Number.isSafeInteger(from) && from >= 0 ? { from } : {}),
      ...(range === 'custom' && Number.isSafeInteger(to) && to > 0 ? { to } : {}),
      ...(Number.isSafeInteger(source) && source > 0 ? { sourceId: source } : {}),
    },
    view: scope === 'usage' && path === 'usage' ? view : 'summary',
  };
}

export function useUsageRoute(scope: 'usage' | 'sessions' | 'history'): [UsageRoute, (next: UsageRouteUpdate) => void] {
  const [route, setRoute] = React.useState<UsageRoute>(() => readRoute(scope));
  React.useEffect(() => {
    const sync = () => setRoute(readRoute(scope));
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, [scope]);
  const update = (next: UsageRouteUpdate) => {
    const selection = { ...route.selection, ...(next.selection ?? {}) };
    if (selection.range !== 'custom') {
      delete selection.from;
      delete selection.to;
    }
    const updated: UsageRoute = {
      selection,
      view: next.view ?? route.view,
    };
    const hash = routeHash(scope, updated);
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`);
    setRoute(updated);
  };
  return [route, update];
}

function dateValue(value: number | undefined): string {
  const date = new Date(value ?? Date.now());
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function startOfDate(value: string): number | undefined {
  const [year, month, day] = value.split('-').map(Number);
  if (![year, month, day].every(Number.isFinite)) return undefined;
  return new Date(year!, month! - 1, day!, 0, 0, 0, 0).getTime();
}

export function UsageRangeBar({
  route,
  onChange,
  sources = [],
  actions,
  showBucket = true,
  showHeading = true,
}: {
  route: UsageRoute;
  onChange: (next: UsageRouteUpdate) => void;
  sources?: Array<{ id: number; display_name: string }>;
  actions?: React.ReactNode;
  showBucket?: boolean;
  showHeading?: boolean;
}) {
  const t = useT();
  const selection = route.selection;
  const customFrom = selection.from ?? Date.now() - 30 * DAY;
  const customTo = selection.to ?? Date.now();
  const updateCustom = (kind: 'from' | 'to', value: string) => {
    const start = startOfDate(value);
    if (start == null) return;
    const next = kind === 'from' ? start : start + DAY;
    onChange({ selection: { range: 'custom', [kind]: next } });
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5" aria-label={t('usage.rangeLabel')}>
      {showHeading && <span className="text-muted-foreground text-xs font-medium">{t('usage.rangeLabel')}</span>}
      <Select label={t('usage.rangeLabel')} value={selection.range} onChange={(event) => {
        const value = event.target.value as UsageRangeKey;
        if (value === 'custom') {
          onChange({ selection: { range: value, from: customFrom, to: customTo } });
        } else {
          onChange({ selection: { range: value } });
        }
      }}>
        <option value="today">{t('usage.today')}</option>
        <option value="week">{t('usage.thisWeek')}</option>
        <option value="month">{t('usage.thisMonth')}</option>
        <option value="all">{t('usage.allTime')}</option>
        <option value="custom">{t('usage.custom')}</option>
      </Select>
      {selection.range === 'custom' && <>
        <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          {t('usage.from')}
          <input aria-label={t('usage.from')} type="date" value={dateValue(selection.from ?? customFrom)} onChange={(event) => updateCustom('from', event.target.value)} className="bg-card border-input h-8 rounded border px-2 text-xs text-foreground" />
        </label>
        <label className="text-muted-foreground inline-flex items-center gap-1 text-xs">
          {t('usage.to')}
          <input aria-label={t('usage.to')} type="date" value={dateValue((selection.to ?? customTo) - DAY)} onChange={(event) => updateCustom('to', event.target.value)} className="bg-card border-input h-8 rounded border px-2 text-xs text-foreground" />
        </label>
      </>}
      {showBucket && <Select label={t('usage.bucket')} value={selection.bucket ?? 'auto'} onChange={(event) => onChange({ selection: { bucket: event.target.value as UsageBucket | 'auto' } })}>
        <option value="auto">{t('usage.autoBucket')}</option>
        <option value="hour">{t('usage.hour')}</option>
        <option value="day">{t('usage.day')}</option>
        <option value="week">{t('usage.week')}</option>
        <option value="month">{t('usage.month')}</option>
      </Select>}
      {sources.length > 0 && <Select label={t('analysis.source')} value={selection.sourceId ?? ''} onChange={(event) => onChange({ selection: { sourceId: event.target.value ? Number(event.target.value) : undefined } })}>
        <option value="">{t('analysis.allSources')}</option>
        {sources.map((source) => <option key={source.id} value={source.id}>{source.display_name}</option>)}
      </Select>}
      {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
    </div>
  );
}
