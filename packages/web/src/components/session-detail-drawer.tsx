import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { SessionDetail, SessionEvent, SessionRow } from '@/api';
import { api } from '@/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Empty, ErrorBox } from '@/components/primitives';
import { ValueDisplay } from '@/components/value-display';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';

function eventTotals(events: SessionEvent[]) {
  return events.reduce((total, event) => ({
    calls: total.calls + 1,
    total_tokens: total.total_tokens + Number(event.total_tokens || 0),
    cost_usd: total.cost_usd + Number(event.cost_usd || 0),
    cost_unknown_calls: total.cost_unknown_calls + (event.cost_source === 'unknown' ? 1 : 0),
    cost_estimated_calls: total.cost_estimated_calls + (event.cost_source === 'estimated' ? 1 : 0),
  }), { calls: 0, total_tokens: 0, cost_usd: 0, cost_unknown_calls: 0, cost_estimated_calls: 0 });
}

export function SessionDetailDrawer({ summary, onClose }: { summary: SessionRow | null; onClose: () => void }) {
  const t = useT();
  const f = useFormat();
  const dialog = useRef<HTMLDialogElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastTrigger = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    const node = dialog.current;
    if (!summary) {
      if (node?.open) node.close();
      return;
    }
    setLoading(true);
    setError(null);
    setDetail(null);
    lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement.closest('tr') as HTMLTableRowElement | null : null;
    if (!node?.open) node?.showModal();
    requestAnimationFrame(() => closeButton.current?.focus());
    let active = true;
    void api.sessionDetail(summary.id).then((next) => {
      if (active) setDetail(next);
    }).catch((err) => {
      if (active) setError(String(err));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [summary]);

  const close = () => {
    if (dialog.current?.open) dialog.current.close();
    onClose();
    requestAnimationFrame(() => lastTrigger.current?.focus());
  };
  const events = detail?.events ?? [];
  const totals = eventTotals(events);
  const session = detail?.session;

  return <dialog ref={dialog} className="session-drawer bg-background text-foreground w-[min(780px,calc(100vw-1rem))] max-w-none rounded-2xl border p-0 shadow-2xl backdrop:bg-black/40" aria-label={t('sessions.detail')} onCancel={(event) => { event.preventDefault(); close(); }} onClose={() => { if (summary) onClose(); }}>
    <div className="flex max-h-[88vh] flex-col">
      <div className="flex items-start gap-3 border-b px-5 py-4"><div className="min-w-0 flex-1"><p className="text-muted-foreground text-[11px] uppercase tracking-wider">{t('sessions.detail')}</p><h2 className="mt-1 truncate text-lg font-semibold">{summary?.project ?? summary?.native_session_id ?? '--'}</h2><p className="text-muted-foreground mt-1 text-xs">{summary?.display_name} · {summary?.model_default ?? t('sessions.unknownModel')}</p></div><Button ref={closeButton} size="icon" aria-label={t('sessions.closeDetail')} onClick={close}><X className="size-4" /></Button></div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {loading && <Empty>{t('app.loading')}</Empty>}
        {error && <ErrorBox>{error}</ErrorBox>}
        {session && <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card><CardContent className="p-3"><p className="text-muted-foreground text-[11px]">{t('col.calls')}</p><p className="tabular mt-1 text-lg font-semibold">{summary?.calls.toLocaleString() ?? totals.calls.toLocaleString()}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-muted-foreground text-[11px]">{t('col.total')}</p><p className="tabular mt-1 text-lg font-semibold">{f.tokens(summary?.total_tokens ?? totals.total_tokens)}</p></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-muted-foreground text-[11px]">{t('col.value')}</p><div className="tabular mt-1 text-lg font-semibold"><ValueDisplay total={summary ?? totals} /></div></CardContent></Card>
            <Card><CardContent className="p-3"><p className="text-muted-foreground text-[11px]">{t('sessions.started')}</p><p className="mt-1 text-sm font-medium">{f.clock(session.started_at as number | null)}</p></CardContent></Card>
          </div>
          <div className="text-muted-foreground mt-4 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            <span>{t('sessions.cwd')}: {String(session.cwd ?? '--')}</span><span>{t('sessions.branch')}: {String(session.git_branch ?? '--')}</span><span>{t('sessions.agent')}: {String(session.agent ?? '--')}</span><span>{t('sessions.lastSeen')}: {f.clock(session.last_seen_at as number | null)}</span>
          </div>
          <div className="mt-6"><div className="mb-2 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t('sessions.events')}</h3><span className="text-muted-foreground text-xs">{t('sessions.eventsShown', { n: events.length })}</span></div>
            {events.length === 0 ? <Empty>{t('sessions.noEvents')}</Empty> : <div className="overflow-x-auto rounded-xl border"><table className="w-full text-xs"><thead><tr className="border-b text-left"><th className="px-3 py-2">{t('col.lastActive')}</th><th className="px-3 py-2">{t('col.model')}</th><th className="px-3 py-2 text-right">{t('col.total')}</th><th className="px-3 py-2 text-right">{t('col.value')}</th><th className="px-3 py-2">{t('col.effort')}</th></tr></thead><tbody>{events.map((event, i) => <tr key={`${event.ts}-${i}`} className="border-b last:border-0"><td className="text-muted-foreground whitespace-nowrap px-3 py-2">{f.clock(event.ts)}</td><td className="max-w-52 truncate px-3 py-2 font-mono">{event.model ?? '--'}</td><td className="tabular px-3 py-2 text-right">{f.tokens(event.total_tokens)}</td><td className="tabular px-3 py-2 text-right">{event.cost_source === 'unknown' ? <Badge variant="warn">--</Badge> : f.moneyTotal(event.cost_usd, 0, 1)}</td><td className="text-muted-foreground px-3 py-2">{event.effort ?? '--'}</td></tr>)}</tbody></table></div>}
          </div>
          {summary?.native_cost_usd != null && <p className="text-muted-foreground mt-4 text-xs">{t('sessions.nativeHint')} {f.money(summary.native_cost_usd)}</p>}
        </>}
      </div>
    </div>
  </dialog>;
}
