import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CircleHelp, X } from 'lucide-react';
import { api, type PricingCoverage, type PricingScope } from '@/api';
import { pricingState, formatValue, type ValueTotal } from '@/lib/pricing';
import { useLiveRefresh } from '@/lib/use-live';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { Hint } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

export function ValueDisplay({ total, scope, label }: { total: ValueTotal; scope?: PricingScope; label?: string }) {
  const t = useT();
  const f = useFormat();
  const state = pricingState(total);
  const [opened, setOpened] = useState<PricingScope | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const explanation = [t(`pricing.${state}`), t('pricing.coverage', {
    known: Math.max(0, total.calls - total.cost_unknown_calls), calls: total.calls, unknown: total.cost_unknown_calls,
  }), total.cost_estimated_calls ? t('pricing.estimated', { n: total.cost_estimated_calls }) : '', t('pricing.note')].filter(Boolean).join('. ');
  return <span className="inline-flex max-w-full flex-wrap items-center gap-1.5" data-pricing-state={state}>
    <Hint text={explanation}><span tabIndex={0} className="rounded" aria-label={`${formatValue(total, f.money)}. ${explanation}`} data-value-number>{formatValue(total, f.money)}</span></Hint>
    {state !== 'complete' && <span className="text-muted-foreground text-[10px] leading-snug font-normal">{t(`pricing.${state}`)}</span>}
    {!!total.cost_estimated_calls && <span className="text-warn text-[10px] leading-snug font-normal">{t('pricing.estimated', { n: total.cost_estimated_calls })}</span>}
    {scope && <button ref={trigger} type="button" aria-label={`${t('pricing.details')} — ${label ?? t('col.value')}`} aria-haspopup="dialog"
      className="text-brand inline-flex min-h-8 min-w-8 items-center justify-center rounded hover:bg-accent" onClick={() => setOpened({ ...scope })}><CircleHelp className="size-4" /></button>}
    {opened && createPortal(<PricingDetails scope={opened} label={label} onClose={() => { setOpened(null); trigger.current?.focus(); }} />, document.body)}
  </span>;
}

function PricingDetails({ scope, label, onClose }: { scope: PricingScope; label?: string; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const mounted = useRef(false);
  const sequence = useRef(0);
  const [data, setData] = useState<PricingCoverage | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    mounted.current = true;
    const el = dialog.current!;
    el.showModal();
    return () => { mounted.current = false; sequence.current++; if (el.open) el.close(); };
  }, []);
  useLiveRefresh(async () => {
    const request = ++sequence.current;
    setLoading(true);
    try {
      const next = await api.pricingCoverage(scope);
      if (mounted.current && sequence.current === request) { setData(next); setError(false); }
    } catch (err) {
      if (mounted.current && sequence.current === request) setError(true);
      throw err;
    } finally {
      if (mounted.current && sequence.current === request) setLoading(false);
    }
  }, [retry]);
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-note`} onClose={() => { if (!dialog.current?.open) onClose(); }}
    onKeyDownCapture={event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); dialog.current?.close(); }
      if (event.key !== 'Tab') return;
      const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')]
        .filter(el => el.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }}
    className="bg-card text-foreground fixed inset-0 m-auto max-h-[90dvh] w-[min(44rem,calc(100vw-2rem))] overflow-y-auto rounded-2xl border p-5 shadow-2xl backdrop:bg-black/60 sm:p-7">
    <div className="flex items-start justify-between gap-3">
      <h2 id={`${id}-title`} className="text-xl font-semibold">{t('pricing.details')}{label ? ` — ${label}` : ''}</h2>
      <Button autoFocus aria-label={t('pricing.close')} onClick={() => dialog.current?.close()}><X className="size-4" /></Button>
    </div>
    <p id={`${id}-note`} className="text-muted-foreground mt-3 text-sm">{t('pricing.note')}</p>
    <p className="mt-3 text-sm">{scope.from === 0 ? t('pricing.allTime') : f.clock(scope.from)} · {t('pricing.through', { time: f.clock(scope.to) })}</p>
    <div aria-live="polite" className="my-3 text-sm">
      {loading && <p role="status">{t('app.loading')}</p>}
      {error && <div role="alert" className="text-warn"><p>{t('pricing.error')}</p><Button className="mt-2" disabled={loading} onClick={() => setRetry(n => n + 1)}>{t('pricing.retry')}</Button></div>}
    </div>
    {data && <div className="space-y-5">
      <section className="rounded-xl border p-4">
        <h3 className="mb-2 font-medium">{scope.sourceId == null ? t('pricing.allSources') : data.sourceName ?? label ?? String(scope.sourceId)}</h3>
        <ValueDisplay total={data.totals} />
        <p className="mt-2 text-sm" data-testid="pricing-coverage">{t('pricing.coverage', { known: data.totals.calls - data.totals.cost_unknown_calls, calls: data.totals.calls, unknown: data.totals.cost_unknown_calls })}</p>
      </section>
      <section><h3 className="mb-3 font-medium">{t('pricing.models')}</h3>
        {data.models.length === 0 ? <p className="text-muted-foreground text-sm">{t('pricing.noModels')}</p> : <ul className="divide-y">
          {data.models.map((m, i) => <li key={i} className="space-y-1 py-3 text-sm break-words">
            <p className="font-mono font-semibold">{m.model || t('pricing.missingName')}</p>
            <p className="text-muted-foreground">{t('pricing.provider', { provider: m.provider || t('pricing.missingName') })}</p>
            <ValueDisplay total={m} />
            {m.cost_unknown_calls > 0 && <p>{t('pricing.coverage', { known: m.calls - m.cost_unknown_calls, calls: m.calls, unknown: m.cost_unknown_calls })}</p>}
            {m.cost_estimated_calls > 0 && <p>{t('pricing.reference', { provider: m.price_provider || t('pricing.missingName') })}</p>}
          </li>)}
        </ul>}
      </section>
      {data.hasHermes && <p className="rounded-xl border p-3 text-sm">{t('pricing.hermes')}</p>}
      <section className="text-muted-foreground space-y-2 border-t pt-4 text-sm">
        <p>{t('pricing.catalog', { n: data.catalog.pricedModels, time: f.clock(data.catalog.loadedAt) })}</p>
        <p>{data.catalog.catalogPresent ? t('pricing.catalogFile', { age: f.age(data.catalog.catalogAgeMs == null ? null : data.catalog.catalogAgeMs / 1000), owner: t(data.catalog.catalogOwn ? 'pricing.own' : 'pricing.borrowed') }) : t('pricing.noCatalog')}</p>
        <p>{t('pricing.update')}</p>
      </section>
    </div>}
  </dialog>;
}
