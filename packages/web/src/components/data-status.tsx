import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, Database, Radio, WifiOff } from 'lucide-react';
import type { Overview } from '@/api';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { primaryLimits, willExhaust } from '@/format';
import { quotaSummaries } from '@/lib/quota-summary';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useRefreshStatus } from '@/lib/use-live';
import { cn } from '@/lib/utils';

type Tone = 'ok' | 'warn' | 'crit' | 'muted';

const toneClass: Record<Tone, string> = {
  ok: 'border-ok/25 bg-ok/6 text-ok',
  warn: 'border-warn/25 bg-warn/6 text-warn',
  crit: 'border-crit/25 bg-crit/6 text-crit',
  muted: 'border-border/70 bg-muted/20 text-muted-foreground',
};

function StatusIcon({ tone, kind }: { tone: Tone; kind: DataStatusItem['kind'] }) {
  const Icon = tone === 'crit' ? WifiOff : kind === 'quota' ? Radio : kind === 'pricing' ? CircleHelp : kind === 'ingest' ? Database : CheckCircle2;
  return <Icon className="size-3.5 shrink-0" />;
}

type Translate = ReturnType<typeof useT>;

export interface DataStatusItem {
  key: 'connection' | 'ingest' | 'quota' | 'pricing';
  kind: DataStatusItem['key'];
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}

/**
 * Transport, ingest, quota freshness and price coverage, as one list.
 *
 * Extracted so the collapsed summary of the disclosure and the expanded strip below it are
 * two views of one computation. Derived separately, the closed page would have been
 * reporting health from a second, quietly divergent copy of these rules.
 *
 * Named as a hook because it reads the refresh controller and the currency preference; the
 * `t` argument is passed in rather than taken from `useT` so a caller can render one view
 * of the list inside another component's existing translation context.
 */
export function useDataStatusItems(ov: Overview, t: Translate): DataStatusItem[] {
  const f = useFormat();
  const refresh = useRefreshStatus();
  const active = ov.sourceStatus ?? [];
  const quotaGap = active.some((s) => s.telemetry.gap);
  const quotaStale = active.some((s) => ['stale', 'expired', 'unknown', 'mixed'].includes(s.telemetry.freshness));
  const quotaTone: Tone = active.length === 0 || quotaGap || quotaStale ? 'warn' : 'ok';
  const connectionTone: Tone = refresh.state === 'unavailable' ? 'crit' : refresh.state === 'reconnecting' || refresh.state === 'stale' ? 'warn' : refresh.state === 'live' ? 'ok' : 'muted';
  const pass = ov.lastPass;
  const ingestTone: Tone = pass == null ? 'muted' : 'ok';
  const priceTone: Tone = ov.today.calls === 0 ? 'muted' : ov.today.cost_unknown_calls > 0 ? 'warn' : 'ok';
  const last = refresh.lastSuccessAt == null ? t('status.never') : f.clock(refresh.lastSuccessAt);
  const ingestLabel = pass == null ? t('status.waiting') : t('status.ok');
  const quotaLabel = active.length === 0 ? t('status.noQuota') : quotaGap ? t('status.quotaGap') : quotaStale ? t('status.quotaStale') : t('status.fresh');
  const pricingLabel = ov.today.calls === 0 ? t('status.noUsage') : ov.today.cost_unknown_calls > 0 ? t('status.pricingPartial', { n: ov.today.cost_unknown_calls }) : t('status.pricingComplete');

  return [
    { key: 'connection', kind: 'connection', label: t('status.connection'), value: refresh.state === 'live' ? t('status.connected') : refresh.state, detail: last, tone: connectionTone },
    { key: 'ingest', kind: 'ingest', label: t('status.ingest'), value: ingestLabel, detail: pass ? t('status.passDetail', { events: pass.newEvents, limits: pass.newLimits }) : t('status.waiting'), tone: ingestTone },
    { key: 'quota', kind: 'quota', label: t('status.quota'), value: quotaLabel, detail: active.length ? t('status.sourceCount', { n: active.length }) : t('status.checkSources'), tone: quotaTone },
    { key: 'pricing', kind: 'pricing', label: t('status.pricing'), value: pricingLabel, detail: t('status.valueDetail'), tone: priceTone },
  ];
}

/** A compact explanation of transport, ingest, quota freshness and price coverage. */
export function DataStatusStrip({ ov }: { ov: Overview }) {
  const t = useT();
  const items = useDataStatusItems(ov, t);
  return (
    <section aria-label={t('status.title')} className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.key} className={cn('min-w-0 rounded-xl border', toneClass[item.tone])}>
          <CardContent className="flex min-w-0 items-start gap-2.5 px-3.5 py-3">
            <StatusIcon tone={item.tone} kind={item.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider opacity-80">{item.label}</p>
                <Badge variant={item.tone === 'ok' ? 'ok' : item.tone === 'crit' ? 'crit' : item.tone === 'warn' ? 'warn' : 'outline'}>{item.value}</Badge>
              </div>
              <p className="mt-1 truncate text-[11px] opacity-75" title={item.detail}>{item.detail}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

interface AttentionItem {
  id: string;
  tone: 'warn' | 'crit' | 'muted';
  title: string;
  detail: string;
  action?: 'limits' | 'health' | 'cost';
}

function attentionItems(ov: Overview, t: Translate): AttentionItem[] {
  const items: AttentionItem[] = [];
  const primary = primaryLimits(ov.limits, ov.now).map((entry) => entry.primary);
  for (const limit of primary) {
    const owner = `${limit.subscription_key ?? limit.account_key ?? limit.source_id}:${limit.window_kind}`;
    if (willExhaust(limit, ov.now)) {
      items.push({ id: `exhaust-${owner}`, tone: 'crit', action: 'limits', title: t('attention.exhaustTitle', { name: limit.subscription_display_name ?? limit.display_name }), detail: t('attention.exhaustDetail', { window: limit.window_kind }) });
    } else if ((limit.used_percent ?? 0) >= 80 && (limit.ageSeconds == null || limit.ageSeconds < 3600)) {
      items.push({ id: `high-${owner}`, tone: 'warn', action: 'limits', title: t('attention.highTitle', { name: limit.subscription_display_name ?? limit.display_name }), detail: t('attention.highDetail', { pct: Math.round(limit.used_percent ?? 0), window: limit.window_kind }) });
    }
  }
  for (const source of ov.sourceStatus ?? []) {
    if (source.telemetry.reason === 'reader_error') {
      const id = `reader-${source.source_id}`;
      if (items.some((item) => item.id === id)) continue;
      items.push({ id, tone: 'crit', action: 'health', title: t('attention.readerTitle', { name: source.display_name }), detail: t('attention.readerDetail') });
      continue;
    }
    if (!source.telemetry.gap) continue;
    const id = `gap-${source.source_id}`;
    if (items.some((item) => item.id === id)) continue;
    items.push({ id, tone: 'muted', action: 'limits', title: t('attention.gapTitle', { name: source.display_name }), detail: t('attention.gapDetail') });
  }
  const check = quotaSummaries(ov).filter((item) => item.status === 'check');
  for (const item of check) {
    const id = `check-${item.subscription.subscription_key}`;
    if (items.some((entry) => entry.id === id)) continue;
    items.push({ id, tone: 'muted', action: 'limits', title: t('attention.checkTitle', { name: item.subscription.subscription_display_name }), detail: t('attention.checkDetail') });
  }
  if (ov.today.calls > 0 && ov.today.cost_unknown_calls > 0) {
    items.push({ id: 'pricing', tone: 'muted', action: 'cost', title: t('attention.pricingTitle'), detail: t('attention.pricingDetail', { n: ov.today.cost_unknown_calls }) });
  }
  return items.slice(0, 3);
}

/** The first actionable block on Live; empty means the current readings need no action. */
export function AttentionPanel({ ov, onOpenLimits, onOpenHealth, onOpenCost }: { ov: Overview; onOpenLimits: () => void; onOpenHealth: () => void; onOpenCost: () => void }) {
  const t = useT();
  const items = attentionItems(ov, t);
  const action = (kind?: AttentionItem['action']) => kind === 'health' ? onOpenHealth : kind === 'cost' ? onOpenCost : onOpenLimits;
  return (
    <Card className="min-w-0">
      <CardContent className="px-4 py-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><AlertTriangle className="text-warn size-4" /><h2 className="text-sm font-semibold">{t('attention.title')}</h2></div>
          <span className="text-muted-foreground text-[11px]">{items.length ? t('attention.count', { n: items.length }) : t('attention.none')}</span>
        </div>
        {items.length === 0 ? <p className="text-muted-foreground mt-2 text-xs">{t('attention.noneDetail')}</p> : (
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {items.map((item) => <button key={item.id} onClick={() => action(item.action)()} className={cn('min-w-0 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-accent/50', toneClass[item.tone])}>
              <p className="truncate text-xs font-semibold">{item.title}</p><p className="text-muted-foreground mt-1 line-clamp-2 text-[11px] leading-relaxed">{item.detail}</p>
            </button>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Everything about the *collection*, folded to the bottom of the page.
 *
 * This used to be the first thing on Live, and it was the wrong place. Connection state is
 * already on the sidebar, the attention items overlap the ring and the alert bell, and the
 * status strip is plumbing rather than quota -- so the page opened with four diagnostics
 * cards before showing a single percentage.
 *
 * The collapsed line has to earn its keep, though: a disclosure that only says "more" tells
 * the user nothing until they click, and a page that looks healthy while a quota feed has
 * gone stale is exactly the failure this is here to prevent. So the summary carries the
 * worst status, and a problem tone is enough reason to open it.
 */
export function DataHealthDisclosure({
  ov,
  onOpenLimits,
  onOpenHealth,
  onOpenCost,
}: {
  ov: Overview;
  onOpenLimits: () => void;
  onOpenHealth: () => void;
  onOpenCost: () => void;
}) {
  const t = useT();
  const items = useDataStatusItems(ov, t);
  const problems = items.filter((item) => item.tone === 'warn' || item.tone === 'crit');
  const worst: Tone = problems.some((p) => p.tone === 'crit') ? 'crit' : problems.length > 0 ? 'warn' : 'ok';
  const dot = { ok: 'bg-ok', warn: 'bg-warn', crit: 'bg-crit', muted: 'bg-muted-foreground' }[worst];

  return (
    <details className="rounded-2xl border" data-testid="data-health">
      <summary
        className="group flex cursor-pointer list-none items-center gap-2.5 rounded-2xl px-4 py-3"
        aria-label={t('dataHealth.title')}
      >
        <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', dot)} />
        <span className="text-[13px] font-semibold">{t('dataHealth.title')}</span>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-[11.5px]">
          {problems.length === 0
            ? t('dataHealth.ok')
            : t('dataHealth.attention', { n: problems.length })}
        </span>
        <span className="text-muted-foreground shrink-0 text-[11px]">{t('dataHealth.expand')}</span>
        {/* A bordered bar with text and no arrow does not read as something to click, and
            the whole point of moving this block is that it can be left closed. */}
        <ChevronDown className="text-muted-foreground size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180" />
      </summary>
      <div className="space-y-3 px-3 pb-3">
        <DataStatusStrip ov={ov} />
        <AttentionPanel ov={ov} onOpenLimits={onOpenLimits} onOpenHealth={onOpenHealth} onOpenCost={onOpenCost} />
      </div>
    </details>
  );
}
