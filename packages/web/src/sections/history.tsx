import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { api, type HarnessStatus, type HistorySummaryResponse } from '@/api';
import { HistoryTimeline } from '@/redesign/history-timeline';
import { InitialRegion, type InitialRegionState } from '@/redesign/initial-region';
import { useHistoryMotion } from '@/redesign/use-history-motion';
import { historyRecordMotionKey } from '@/redesign/history-motion';
import { canonicalHash } from '@/redesign/routes';
import { HistoryRecordDetails } from '@/redesign/history-record-details';
import { refreshedHistorySelection, historyRelatedSessionHref, type HistorySelection } from '@/redesign/history-selection';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { useLiveRefresh } from '@/lib/use-live';
import type { UsageEventRow, UsageEventScope, UsageEventsResponse, UsageGrain } from '@/lib/usage-events';
import { UsageRangeBar, useUsageRoute } from '@/components/usage-range';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox } from '@/components/primitives';
import { Folder, History } from 'lucide-react';
import { VendorIcon } from '@/components/vendor-icon';
import { HarnessIcon } from '@/components/harness-icon';

type Filters = Pick<UsageEventScope, 'q' | 'project' | 'projectMissing' | 'provider' | 'vendor' | 'model' | 'harness' | 'grain'>;
const FILTER_FIELDS = ['q', 'project', 'provider', 'vendor', 'model', 'harness'] as const;
function routeFilters(hash = location.hash): Filters {
  const params = new URLSearchParams(hash.split('?')[1] ?? '');
  const filters: Filters = { grain: 'all' };
  for (const field of FILTER_FIELDS) {
    if (params.has(field)) filters[field] = params.get(field)!;
  }
  if (params.get('project_missing') === '1') { filters.projectMissing = true; delete filters.project; }
  if (['call', 'session_aggregate', 'unknown'].includes(params.get('grain') ?? '')) filters.grain = params.get('grain') as UsageGrain;
  return filters;
}

export function HistorySection({ sources, harnesses = [], redesign = false, onScopeChange, onPauseChange }: { onPauseChange?: (paused: boolean) => void; onScopeChange?: (scope: UsageEventScope | null) => void; sources: Array<{ id: number; display_name: string }>; harnesses?: HarnessStatus[]; redesign?: boolean }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const rawSessionId = new URLSearchParams(location.hash.split('?')[1] ?? '').get('session_id');
  const sessionId = rawSessionId && /^\d+$/.test(rawSessionId) && Number.isSafeInteger(Number(rawSessionId)) && Number(rawSessionId) > 0 ? Number(rawSessionId) : undefined;
  const [route, updateRoute] = useUsageRoute('history', { sessionId });
  const [draft, setDraft] = useState<Filters>(routeFilters);
  const [filters, setFilters] = useState<Filters>(routeFilters);
  const [offset, setOffset] = useState(0);
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);
  const [snapshot, setSnapshot] = useState<UsageEventsResponse | null>(null);
  const [summary, setSummary] = useState<HistorySummaryResponse | null>(null);
  const [snapshotKey, setSnapshotKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKey, setErrorKey] = useState('');
  const [errorEpoch, setErrorEpoch] = useState(-1);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [selection, setSelection] = useState<HistorySelection | null>(null);
  const selected = selection?.row ?? null;
  const initialSelection = useRef(false);
  const motionTable = useRef<HTMLDivElement>(null);
  const [selectionSerial, setSelectionSerial] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const returnFocus = useRef<HTMLButtonElement | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const queryKey = JSON.stringify([route.selection, filters, sessionId, offset]);
  const key = JSON.stringify([queryKey, paused]);
  const currentKey = useRef(key);
  const scopeEpoch = useRef(0);
  if (currentKey.current !== key) scopeEpoch.current++;
  currentKey.current = key;
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    const sync = (event: HashChangeEvent) => {
      // An earlier route listener can render and canonicalize the current hash
      // before this listener runs. Keep the incoming event's exact filter values.
      const incoming = event.newURL ? new URL(event.newURL).hash : location.hash;
      const incomingHash = redesign ? canonicalHash(incoming) : incoming;
      if (incomingHash.slice(1).split('?')[0] !== 'history') return;
      const next = routeFilters(incomingHash);
      setDraft(next); setFilters(next); setOffset(0);
    };
    addEventListener('hashchange', sync);
    return () => removeEventListener('hashchange', sync);
  }, [redesign]);
  useEffect(() => {
    if (!selected || dialog.current?.open) return;
    returnFocus.current ??= document.querySelector<HTMLButtonElement>('[data-testid="usage-history"] tr[data-selected="true"] button');
    dialog.current?.showModal();
  }, [selected]);
  useEffect(() => {
    if (location.hash.slice(1).split('?')[0] !== 'history') return;
    const params = new URLSearchParams(location.hash.split('?')[1] ?? '');
    for (const field of FILTER_FIELDS) {
      params.delete(field);
      if (filters[field] !== undefined) params.set(field, filters[field]!);
    }
    params.delete('project_missing');
    if (filters.projectMissing) { params.delete('project'); params.set('project_missing', '1'); }
    params.delete('grain');
    if (filters.grain && filters.grain !== 'all') params.set('grain', filters.grain);
    const next = `#history?${params}`;
    if (location.hash !== next) history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }, [filters, route]);

  useLiveRefresh(async ({ live }) => {
    if (pausedRef.current) return;
    const requestedKey = key;
    const requestedEpoch = scopeEpoch.current;
    const current = () => mounted.current && !pausedRef.current && currentKey.current === requestedKey && scopeEpoch.current === requestedEpoch;
    if (!live) setLoading(true);
    try {
      const usage = await api.usage({ ...route.selection, bucket: route.selection.bucket ?? 'auto' });
      if (!current()) return;
      const scope = { from: usage.range.from, to: usage.range.to, sourceId: route.selection.sourceId, sessionId, ...filters };
      const [result, fullRange] = await Promise.all([api.usageEvents(scope, { limit: 50, offset }), redesign ? api.historySummary(scope) : Promise.resolve(null)]);
      if (!current()) return;
      if (result.total > 0 && offset >= result.total) { setOffset(0); return; }
      setSnapshot(result);
      setSummary(fullRange);
      // Refresh only the existing identity; an absent event retains the exact
      // snapshot scope from which it was selected for its related-record link.
      if (redesign) setSelection(selected => refreshedHistorySelection(selected, result));
      if (redesign && !initialSelection.current) {
        initialSelection.current = true;
        setSelection(result.rows[0] ? { row: result.rows[0], scope: result.scope } : null);
      }
      setSnapshotKey(queryKey);
      setError(null);
    } catch (err) {
      if (!current()) return;
      setError(String(err));
      setErrorKey(queryKey);
      setErrorEpoch(requestedEpoch);
      throw err;
    } finally { if (current()) setLoading(false); }
  }, [key, retryAttempt]);

  // Report the committed snapshot, never unapplied form controls. While a
  // replacement query loads the old table remains visible, but its counts must
  // not be presented as belonging to the newly applied scope.
  const displayedScope = paused || snapshotKey === queryKey ? snapshot?.scope ?? null : null;
  useLayoutEffect(() => { onScopeChange?.(displayedScope); }, [onScopeChange, displayedScope]);
  useLayoutEffect(() => { onPauseChange?.(paused); }, [onPauseChange, paused]);

  const togglePause = () => {
    pausedRef.current = !pausedRef.current;
    setPaused(pausedRef.current);
    setLoading(false);
    if (!pausedRef.current) setOffset(0);
  };
  const exportRows = async () => {
    if (!snapshot) return;
    setExporting(true);
    const exportEpoch = scopeEpoch.current;
    try {
      // Use the displayed snapshot's exact resolved range, never a newly moving "today".
      const result = await api.exportUsageEvents(snapshot.scope);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = result.filename ?? 'quotapulse-history.csv';
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { if (mounted.current) { setError(String(err)); setErrorKey(snapshotKey); setErrorEpoch(exportEpoch); } }
    finally { if (mounted.current) setExporting(false); }
  };
  const date = (ms: number) => new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'medium' }).format(ms);
  const basis = (row: UsageEventRow) => t(row.cost_usd === null || !['native', 'computed', 'estimated'].includes(row.cost_source) ? 'history.unknownCost' : `history.${row.cost_source as 'native' | 'computed' | 'estimated'}`);
  // Harness ownership comes from source/profile metadata, independently of the routed model.
  const harnessVendor = (row: UsageEventRow) => (harnesses.find(harness => harness.harness === row.harness && harness.source_ids.includes(row.source_id))
    ?? harnesses.find(harness => harness.harness === row.harness && harness.profile === row.profile))?.vendor;
  const currentError = errorKey === queryKey && errorEpoch === scopeEpoch.current ? error : null;
  const retry = () => {
    document.getElementById('history')?.focus();
    if (errorKey === queryKey && errorEpoch === scopeEpoch.current) setError(null);
    setLoading(true);
    setRetryAttempt(attempt => attempt + 1);
  };
  const initialState: InitialRegionState = {
    kind: paused ? 'paused' : currentError ? 'error' : 'loading',
    label: t(paused ? 'history.paused' : currentError ? 'app.couldNotLoad' : 'app.loading'),
    detail: currentError ?? undefined,
    retryLabel: t('app.retry'), retrying: paused,
    onRetry: retry,
  };
  const canExport = !!snapshot && snapshotKey === queryKey && !paused && !loading && !exporting && !currentError;
  const displayedRange = t('history.range', { from: snapshot?.total ? snapshot.offset + 1 : 0, to: snapshot ? Math.min(snapshot.offset + snapshot.rows.length, snapshot.total) : 0, total: snapshot?.total ?? 0 });
  const viewActions = <div className={redesign ? 'qp-history-view-actions' : 'flex flex-wrap items-center gap-2'}><Button onClick={togglePause} aria-pressed={paused}>{t(paused ? 'history.resume' : 'history.pause')}</Button><Button disabled={!canExport} onClick={() => void exportRows()}>{t(exporting ? 'history.exporting' : 'history.export')}</Button>{paused && <span role="status" className="text-xs text-muted-foreground">{t('history.paused')}</span>}</div>;
  const copyMetadata = async () => {
    if (!selected) return;
    const fields = ['event_id','timestamp_ms','grain','source_id','source_name','harness','project','session_key','provider','vendor','model','effort','service_tier','is_subagent','duration_ms','call_count','total_tokens','input_tokens','cached_input_tokens','cache_write_tokens','output_tokens','reasoning_tokens','cost_usd','cost_source','price_provider'] as const;
    try { await navigator.clipboard.writeText(JSON.stringify(Object.fromEntries(fields.map(field => [field, selected[field]])), null, 2)); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  };
  const relatedSession = historyRelatedSessionHref(selection);
  useHistoryMotion(motionTable, dialog, snapshot, queryKey, snapshotKey, selected ? historyRecordMotionKey(selected) : null, selectionSerial, redesign && !paused && snapshotKey === queryKey && !currentError);
  return <div className="flex min-w-0 flex-col gap-3.5" data-testid="usage-history">
    {sessionId !== undefined && <div className="flex items-center gap-3 text-xs" role="status"><span>{t('history.session')} #{sessionId}</span><a className="underline" href="#history?range=all">{t('history.clearSession')}</a></div>}
    <div className={redesign ? 'qp-history-heading' : undefined}>{redesign && <><div className="qp-history-heading-identity"><i aria-hidden="true"><History size={27}/></i><div><h1>{t('history.redesignTitle')}</h1><p>{t('history.redesignSubtitle')}</p></div></div>{viewActions}</>}<fieldset disabled={paused} className="min-w-0 border-0 p-0"><UsageRangeBar route={route} sources={sources} showBucket={false} showHeading={!redesign} onChange={next => { setOffset(0); updateRoute(next); }}/></fieldset></div>
    {summary ? <HistoryTimeline data={summary}/> : redesign && <section className="qp-panel qp-history-timeline qp-history-initial-timeline" aria-label={t('history.timeline')}>
      <h2><i aria-hidden="true"><History size={19}/></i>{t('history.timeline')}</h2>
      <p className="qp-footnote">{t('history.timelineNote')}</p>
      <div className="qp-history-summary">{(['col.total', 'col.calls', 'history.apiTotal', 'history.effortDistribution'] as const).map((label, index) => <InitialRegion key={label} id={`history-summary-${index}`} label={t(label)} state={initialState} slots={1}/>)}</div>
      <InitialRegion id="history-timeline" label={t('history.timeline')} state={initialState} className="qp-history-initial-plot" heading={<span className="sr-only">{t('history.timeline')}</span>} status/>
    </section>}
    <form onSubmit={event => { event.preventDefault(); setOffset(0); setFilters({ ...draft, project: draft.projectMissing ? undefined : draft.project }); }}>
      <fieldset disabled={paused} className="grid min-w-0 grid-cols-1 gap-3 rounded-lg border p-3 sm:grid-cols-2 xl:grid-cols-3">
        {FILTER_FIELDS.map(field => <label key={field} className="grid min-w-0 gap-1 text-xs text-muted-foreground"><span>{t(field === 'q' ? 'history.search' : `history.${field}`)}</span><input className="min-w-0 rounded-md border bg-background px-2 py-2 text-foreground" placeholder={redesign ? t(field === 'q' ? 'history.search' : `history.${field}`) : undefined} value={draft[field] ?? ''} disabled={field === 'project' && draft.projectMissing} onChange={event => setDraft({ ...draft, [field]: event.target.value || undefined })} maxLength={field === 'q' ? 256 : 4096}/></label>)}
        <Select label={t('history.kind')} value={draft.grain ?? 'all'} onChange={event => setDraft({ ...draft, grain: event.target.value as UsageGrain })}>{(['all', 'call', 'session_aggregate', 'unknown'] as const).map(grain => <option key={grain} value={grain}>{t(`history.${grain}`)}</option>)}</Select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={draft.projectMissing ?? false} onChange={event => setDraft({ ...draft, projectMissing: event.target.checked })}/>{t('history.missing')}</label>
        <Button type="submit">{t('history.apply')}</Button>
      </fieldset>
    </form>
    {!redesign && viewActions}
    {currentError && (!redesign || snapshot) && <ErrorBox>{currentError}{snapshot && <p>{t('history.stale')}</p>}{redesign && <Button onClick={retry} disabled={paused || loading}>{t('app.retry')}</Button>}</ErrorBox>}
    {redesign && !snapshot ? <InitialRegion id="history-records" label={t('history.records')} state={initialState} className="qp-history-initial-records" slots={6}/> : <Card aria-busy={loading} className={redesign ? 'qp-history-records' : undefined}>
      <CardHeader className={redesign ? 'qp-history-records-heading' : undefined}><CardTitle as="h2" id="history-records-title">{t('history.records')}</CardTitle>{!redesign && <span className="text-xs text-muted-foreground" aria-live="polite">{displayedRange}</span>}</CardHeader>
      <div ref={motionTable} className={redesign ? 'qp-history-table' : undefined} role={redesign ? 'region' : undefined} aria-labelledby={redesign ? 'history-records-title' : undefined} tabIndex={redesign && snapshot?.rows.length ? 0 : undefined}>
      {!snapshot?.rows.length ? !currentError && <Empty>{t(loading ? 'app.loading' : 'history.empty')}</Empty> : <Table>
        <TableHeader><TableRow><TableHead>{t('history.recordedAt')}</TableHead><TableHead>{t('history.kind')}</TableHead><TableHead>{t('col.harness')}</TableHead><TableHead>{t('col.project')}</TableHead><TableHead>{t('history.provider')}</TableHead><TableHead>{t('col.model')}</TableHead><TableHead>{t('col.total')}</TableHead><TableHead>{t('history.basis')}</TableHead><TableHead>{t('history.detail')}</TableHead></TableRow></TableHeader>
        <TableBody>{snapshot.rows.map(row => <TableRow key={row.event_id} data-history-record={redesign ? historyRecordMotionKey(row) : undefined} data-selected={redesign && selected?.event_id === row.event_id ? 'true' : undefined}>
          <TableCell className="whitespace-nowrap">{date(row.timestamp_ms)}</TableCell><TableCell>{t(`history.${row.grain}`)}</TableCell><TableCell>{redesign ? <span className="qp-history-harness" data-harness={row.harness} title={row.source_name}><HarnessIcon harness={row.harness} vendor={harnessVendor(row)} label={row.harness}/>{row.source_name}</span> : row.source_name}</TableCell><TableCell className="max-w-48 break-all">{redesign ? <span className="qp-history-project"><Folder size={16} aria-hidden="true"/>{row.project ?? t('redesign.unassigned')}</span> : row.project ?? t('redesign.unassigned')}</TableCell><TableCell>{redesign ? <span className="qp-history-provider"><VendorIcon vendor={row.provider ?? 'unknown'}/>{row.provider ?? '—'}</span> : row.provider ?? '—'}</TableCell><TableCell className={redesign ? "qp-history-model" : undefined} title={row.model ?? undefined}>{redesign ? <span className="qp-history-model-identity"><i className="qp-history-model-maker" data-vendor={row.vendor} aria-hidden="true"><VendorIcon vendor={row.vendor}/></i><span className="qp-history-model-name">{row.model ?? '—'}</span></span> : row.model ?? '—'}</TableCell><TableCell><span className={redesign ? "qp-history-token-value" : undefined} title={String(row.total_tokens)} aria-label={String(row.total_tokens)}>{redesign ? f.tokens(row.total_tokens) : row.total_tokens.toLocaleString(lang)}</span></TableCell><TableCell><span>{basis(row)}</span><br/><span title={f.explain(row.cost_usd) ?? undefined}>{row.cost_usd !== null && ['native', 'computed', 'estimated'].includes(row.cost_source) ? f.money(row.cost_usd) : '—'}</span></TableCell><TableCell><Button onClick={event => { returnFocus.current = event.currentTarget; setCopyState('idle'); setSelectionSerial(serial => serial + 1); setSelection({ row, scope: snapshot!.scope }); }} aria-label={`${t('history.detail')} ${row.event_id}`}>#{row.event_id}</Button></TableCell>
        </TableRow>)}</TableBody>
      </Table>}
      </div>
      <div className={redesign ? 'qp-history-pagination' : 'flex flex-wrap justify-between gap-2 p-3'}>{redesign && <span className="text-xs text-muted-foreground" aria-live="polite">{displayedRange}</span>}<Button disabled={paused || loading || !snapshot || snapshot.offset === 0} onClick={() => setOffset(Math.max(0, offset - 50))}>{t('history.previous')}</Button><Button disabled={paused || loading || !snapshot || snapshot.offset + snapshot.limit >= snapshot.total} onClick={() => setOffset(offset + 50)}>{t('history.next')}</Button></div>
    </Card>}
    <p className="text-xs leading-relaxed text-muted-foreground">{t('history.coverage')}</p>
    {redesign && !snapshot && <InitialRegion id="history-detail" label={t('history.detail')} state={initialState} className="qp-history-initial-detail" slots={6}/>}
    <dialog ref={dialog} onClose={() => { setSelection(null); returnFocus.current?.focus(); }} aria-labelledby="history-detail-title" className="m-auto max-h-[85vh] w-[min(640px,92vw)] overflow-auto rounded-xl border bg-background p-5 text-foreground backdrop:bg-black/60">
      <div className={redesign ? 'qp-history-detail-heading' : 'flex items-center justify-between gap-3'}><h2 id="history-detail-title">{t('history.detail')} <span>#{selected?.event_id}</span></h2><Button autoFocus onClick={() => dialog.current?.close()}>{t('history.close')}</Button></div>
      {!redesign && <p className="my-3 text-xs text-muted-foreground">{t('history.coverage')}</p>}
      {selected && redesign && <HistoryRecordDetails row={selected} harnessVendor={harnessVendor(selected)} basis={basis(selected)} date={date(selected.timestamp_ms)}/>}
      {selected && !redesign && <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[
        [t('history.recordedAt'), date(selected.timestamp_ms)], [t('history.kind'), t(`history.${selected.grain}`)],
        [t('col.source'), selected.source_name], [t('history.session'), selected.session_key ?? '—'],
        [t('col.project'), selected.project ?? t('redesign.unassigned')], [t('history.provider'), selected.provider ?? '—'],
        [t('history.vendor'), selected.vendor], [t('col.model'), selected.model ?? '—'],
        [t('history.effortDistribution'), selected.effort ?? '—'], [t('history.serviceTier'), selected.service_tier ?? '—'],
        [t('history.duration'), selected.duration_ms !== null ? `${selected.duration_ms.toLocaleString(lang)} ms` : '—'],
        [t('history.priceProvider'), selected.price_provider ?? '—'],
        [t('col.calls'), selected.call_count], [t('col.total'), selected.total_tokens.toLocaleString(lang)],
        [t('col.freshIn'), selected.input_tokens.toLocaleString(lang)], [t('col.cacheRead'), selected.cached_input_tokens.toLocaleString(lang)],
        [t('col.output'), selected.output_tokens.toLocaleString(lang)], [t('col.reasoning'), selected.reasoning_tokens.toLocaleString(lang)],
        [t('history.basis'), basis(selected)], [t('col.value'), selected.cost_usd !== null && ['native', 'computed', 'estimated'].includes(selected.cost_source) ? f.money(selected.cost_usd) : '—'],
      ].map(([label, value]) => <div key={String(label)}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="break-all text-sm">{value}</dd></div>)}</dl>}
      {redesign && <section className="qp-history-detail-actions" aria-label={t('history.relatedRecords')}><h3>{t('history.relatedRecords')}</h3><Button onClick={() => void copyMetadata()}>{t('history.copyMetadata')}</Button>{copyState !== 'idle' && <span role="status">{t(copyState === 'copied' ? 'history.copied' : 'history.copyFailed')}</span>}{relatedSession && <a className="underline" href={relatedSession} onClick={() => dialog.current?.close()}>{t('history.relatedSession')}</a>}</section>}
    </dialog>
  </div>;
}
