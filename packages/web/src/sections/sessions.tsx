import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { api, type SessionRow, type UsagePeriod } from '@/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty, ErrorBox } from '@/components/primitives';
import { Hint } from '@/components/ui/tooltip';
import { VendorFilter, toggleIn, type VendorOption } from '@/components/vendor-filter';
import { VendorIcon } from '@/components/vendor-icon';
import { vendorLabel } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { ValueDisplay } from '@/components/value-display';
import { UsageRangeBar, useUsageRoute } from '@/components/usage-range';
import { SessionDetailDrawer } from '@/components/session-detail-drawer';

const PAGE_SIZES = [25, 50, 100];
export function SessionsSection({ sources = [] }: { sources?: Array<{ id: number; display_name: string }> }) {
  const t = useT();
  const f = useFormat();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [route, updateRoute] = useUsageRoute('sessions');
  const [period, setPeriod] = useState<UsagePeriod | null>(null);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);

  const vendorKey = useMemo(() => [...selected].sort().join(','), [selected]);

  useLiveRefresh(
    ({ live }) => {
      // A live refresh keeps the current table on screen: a spinner every few seconds
      // while you are reading a page is worse than a row arriving a moment late.
      if (!live) setLoading(true);
      return api.usage({
        range: route.selection.range,
        from: route.selection.from,
        to: route.selection.to,
        bucket: route.selection.bucket ?? 'auto',
        sourceId: route.selection.sourceId,
      }).then((window) => {
        setPeriod(window.range);
        return api.sessions({
          limit,
          offset,
          vendor: vendorKey,
          sourceId: route.selection.sourceId,
          from: window.range.from,
          to: window.range.to,
        });
      }).then((r) => {
          setRows(r.sessions);
          setTotal(r.total);
          setVendors(r.vendors.map((v) => ({ id: v.vendor, count: v.sessions })));
          setErr(null);
          setLoaded(true);
        })
        .catch((e) => {
          setErr(String(e));
          throw e;
        })
        .finally(() => setLoading(false));
    },
    [limit, offset, vendorKey, route.selection.range, route.selection.from, route.selection.to, route.selection.bucket, route.selection.sourceId],
  );

  // Any filter or page-size change invalidates the current offset: page 6 of the old
  // result set is meaningless in the new one.
  const changeFilter = (next: Set<string>) => {
    setSelected(next);
    setOffset(0);
  };

  if (err && !loaded) return <ErrorBox>{err}</ErrorBox>;

  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex flex-col gap-3.5">
      <UsageRangeBar route={route} sources={sources} onChange={(next) => { setOffset(0); updateRoute(next); }} />
      <VendorFilter
        vendors={vendors}
        selected={selected}
        onToggle={(id) => changeFilter(toggleIn(selected, id))}
        onClear={() => changeFilter(new Set())}
      />

      <Card>
        <CardHeader>
          <CardTitle as="h2">{t('sessions.title')}</CardTitle>
          {period && <span className="text-muted-foreground text-[11.5px]">{f.day(period.from)} – {f.day(period.to)}</span>}
          <span className="text-muted-foreground text-[11.5px]">
            {t('sessions.range', { from, to, total })}
          </span>
          <div className="flex-1" />
          <Select
            label={t('sessions.perPage')}
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setOffset(0);
            }}
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </Select>
        </CardHeader>

        {rows.length === 0 ? (
          <Empty>{loading ? t('app.loading') : t('sessions.none')}</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('col.lastActive')}</TableHead>
                <TableHead>{t('col.harness')}</TableHead>
                <TableHead>{t('col.project')}</TableHead>
                <TableHead>{t('col.model')}</TableHead>
                <TableHead className="text-right">{t('col.calls')}</TableHead>
                <TableHead className="text-right">{t('col.total')}</TableHead>
                <TableHead className="text-right">{t('col.value')}</TableHead>
                <TableHead className="text-right">{t('col.harnessSays')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((s) => (
                <TableRow key={s.id} tabIndex={0} className="cursor-pointer" onClick={() => setSelectedSession(s)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedSession(s); } }} aria-label={t('sessions.detail')}>
                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {f.clock(s.last_seen_at)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {s.display_name}
                    {s.is_subagent ? (
                      <Badge variant="outline" className="ml-1.5">
                        {t('sessions.sub')}
                      </Badge>
                    ) : null}
                  </TableCell>
                  <TableCell title={s.cwd ?? ''}>
                    {s.project ?? <span className="text-muted-foreground/60">--</span>}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-[12px]">
                    {s.model_default ? (
                      <span className="inline-flex items-center gap-1.5">
                        <VendorIcon
                          vendor={s.vendor}
                          label={vendorLabel(s.vendor)}
                          className="text-[14px]"
                        />
                        {s.model_default}
                      </span>
                    ) : (
                      <span className="text-muted-foreground/60">--</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular text-right font-mono">
                    {s.calls.toLocaleString()}
                  </TableCell>
                  <TableCell className="tabular text-right font-mono">
                    {f.tokens(s.total_tokens)}
                  </TableCell>
                  <TableCell className="tabular text-right font-mono">
                    <ValueDisplay total={s} />
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground text-right font-mono">
                    {s.native_cost_usd == null ? (
                      <span className="text-muted-foreground/50">--</span>
                    ) : (
                      <Hint text={t('sessions.nativeHint')}>
                        <span className="cursor-default">{f.money(s.native_cost_usd)}</span>
                      </Hint>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 0 && (
          <CardContent className="flex items-center gap-2 pt-3">
            <span className="text-muted-foreground text-[11.5px]">
              {t('sessions.range', { from, to, total })}
            </span>
            <div className="flex-1" />
            <Button
              size="sm"
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="gap-1"
            >
              <ChevronLeft className="size-3.5" />
              {t('sessions.prev')}
            </Button>
            <Button
              size="sm"
              disabled={!canNext}
              onClick={() => setOffset(offset + limit)}
              className="gap-1"
            >
              {t('sessions.next')}
              <ChevronRight className="size-3.5" />
            </Button>
          </CardContent>
        )}
      </Card>
      <SessionDetailDrawer summary={selectedSession} onClose={() => setSelectedSession(null)} />
    </div>
  );
}
