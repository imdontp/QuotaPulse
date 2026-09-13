import * as React from 'react';
import { BookmarkPlus, RotateCcw } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { useT } from '@/i18n';

export type AnalysisRange = 0 | 1 | 7 | 30 | 120;

export interface AnalysisFilters {
  days: AnalysisRange;
  sourceId: number | undefined;
}

const VALID_RANGES: AnalysisRange[] = [0, 1, 7, 30, 120];

function readFilters(): AnalysisFilters {
  if (typeof window === 'undefined') return { days: 30, sourceId: undefined };
  const params = new URLSearchParams(window.location.search);
  // `Number(null)` is zero. Treat a missing query parameter as the default 30-day
  // view instead of accidentally turning every first visit into an all-time query.
  const rawDays = params.get('days');
  const days = (rawDays == null || rawDays === '' ? 30 : Number(rawDays)) as AnalysisRange;
  const source = Number(params.get('source'));
  return {
    days: VALID_RANGES.includes(days) ? days : 30,
    sourceId: Number.isSafeInteger(source) && source > 0 ? source : undefined,
  };
}

/** URL-backed filters shared by the analysis pages. Hash navigation remains untouched. */
export function useAnalysisFilters(): [AnalysisFilters, (next: Partial<AnalysisFilters>) => void, () => void] {
  const [filters, setFilters] = React.useState<AnalysisFilters>(readFilters);
  React.useEffect(() => {
    const sync = () => setFilters(readFilters());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);
  const update = (next: Partial<AnalysisFilters>) => {
    const merged = { ...filters, ...next };
    const params = new URLSearchParams(window.location.search);
    if (merged.days === 30) params.delete('days'); else params.set('days', String(merged.days));
    if (merged.sourceId == null) params.delete('source'); else params.set('source', String(merged.sourceId));
    const query = params.toString();
    history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
    setFilters(merged);
  };
  const clear = () => update({ days: 30, sourceId: undefined });
  return [filters, update, clear];
}

export function AnalysisFilterBar({
  filters,
  sources,
  onChange,
  onClear,
  allowAllTime = false,
}: {
  filters: AnalysisFilters;
  sources?: Array<{ id: number; display_name: string }>;
  onChange: (next: Partial<AnalysisFilters>) => void;
  onClear: () => void;
  allowAllTime?: boolean;
}) {
  const t = useT();
  const [saved, setSaved] = React.useState<Array<{ name: string; filters: AnalysisFilters }>>(() => {
    try { const raw = localStorage.getItem('quotapulse-saved-views'); return raw ? JSON.parse(raw) as Array<{ name: string; filters: AnalysisFilters }> : []; } catch { return []; }
  });
  const active = filters.days !== 30 || filters.sourceId != null;
  const save = () => {
    const name = window.prompt(t('analysis.viewName'))?.trim();
    if (!name) return;
    const next = [...saved.filter((view) => view.name !== name), { name, filters }].slice(-10);
    setSaved(next);
    try { localStorage.setItem('quotapulse-saved-views', JSON.stringify(next)); } catch { /* optional convenience */ }
  };
  const applySaved = (value: string) => {
    const view = saved.find((entry) => entry.name === value);
    if (view) onChange(view.filters);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 bg-muted/15 px-3 py-2.5" aria-label={t('analysis.filters')}>
      <span className="text-muted-foreground text-xs font-medium">{t('analysis.filters')}</span>
      <Select label={t('trend.range')} value={filters.days} onChange={(e) => onChange({ days: Number(e.target.value) as AnalysisRange })}>
        {(allowAllTime || filters.days === 0) && <option value={0}>{t('projects.allTime')}</option>}
        <option value={1}>{t('trend.range24h')}</option>
        <option value={7}>{t('trend.range7d')}</option>
        <option value={30}>{t('trend.range30d')}</option>
        <option value={120}>{t('trend.range120d')}</option>
      </Select>
      {sources && sources.length > 0 && (
        <Select label={t('analysis.source')} value={filters.sourceId ?? ''} onChange={(e) => onChange({ sourceId: e.target.value ? Number(e.target.value) : undefined })}>
          <option value="">{t('analysis.allSources')}</option>
          {sources.map((source) => <option key={source.id} value={source.id}>{source.display_name}</option>)}
        </Select>
      )}
      <button onClick={save} className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs" title={t('analysis.save')}><BookmarkPlus className="size-3.5" />{t('analysis.save')}</button>
      {saved.length > 0 && <Select label={t('analysis.saved')} value="" onChange={(e) => applySaved(e.target.value)}><option value="">{t('analysis.saved')}</option>{saved.map((view) => <option key={view.name} value={view.name}>{view.name}</option>)}</Select>}
      {active && <button onClick={onClear} className="text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs" title={t('analysis.clear')}><RotateCcw className="size-3.5" />{t('analysis.clear')}</button>}
    </div>
  );
}
