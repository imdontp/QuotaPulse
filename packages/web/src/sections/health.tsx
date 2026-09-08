import { useState } from 'react';
import { api, type Health } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarList, Empty, ErrorBox } from '@/components/primitives';
import { age, vendorColor, vendorLabel } from '@/format';
import { VendorIcon } from '@/components/vendor-icon';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { useLiveRefresh } from '@/lib/use-live';
import { cn } from '@/lib/utils';

export function HealthSection() {
  const t = useT();
  const f = useFormat();
  const [h, setH] = useState<Health | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useLiveRefresh(() =>
    api
      .health()
      .then((next) => {
        setH(next);
        setErr(null);
      })
      .catch((e) => {
        if (!h) setErr(String(e));
        throw e;
      }),
  []);

  if (err && !h) return <ErrorBox>{err}</ErrorBox>;
  if (!h) return <Empty>{t('app.loading')}</Empty>;

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{t('health.adapters')}</CardTitle>
          <CardDescription className="note">{t('health.adaptersBlurb')}</CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('col.source')}</TableHead>
              <TableHead className="text-right">{t('col.events')}</TableHead>
              <TableHead className="text-right">{t('col.targets')}</TableHead>
              <TableHead className="text-right">{t('col.errors')}</TableHead>
              <TableHead>{t('col.oldest')}</TableHead>
              <TableHead>{t('col.newest')}</TableHead>
              <TableHead>{t('col.lastIngest')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {h.sources.map((s) => (
              <TableRow key={String(s.source_id)}>
                <TableCell>
                  <div>{String(s.display_name)}</div>
                  <div className="text-muted-foreground/60 font-mono text-[10.5px]">
                    {String(s.root_path)}
                  </div>
                </TableCell>
                <TableCell className="tabular text-right font-mono">
                  {Number(s.events).toLocaleString()}
                </TableCell>
                <TableCell className="tabular text-muted-foreground text-right font-mono">
                  {Number(s.targets).toLocaleString()}
                </TableCell>
                <TableCell
                  className={cn(
                    'tabular text-right font-mono',
                    Number(s.targets_with_error) > 0 ? 'text-crit font-semibold' : 'text-muted-foreground',
                  )}
                >
                  {Number(s.targets_with_error)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {f.clock(s.oldest_event_ts as number)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {f.clock(s.newest_event_ts as number)}
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {s.last_ok_at
                    ? t('health.ago', { age: age((h.now - Number(s.last_ok_at)) / 1000) })
                    : '--'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{t('health.coverage')}</CardTitle>
          <CardDescription className="note">{t('health.coverageBlurb')}</CardDescription>
        </CardHeader>
        {h.coverage.length === 0 ? (
          <Empty>{t('health.noCoverage')}</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('col.source')}</TableHead>
                <TableHead className="text-right">{t('health.sessionsCompared')}</TableHead>
                <TableHead className="text-right">{t('health.harnessReports')}</TableHead>
                <TableHead className="text-right">{t('health.weDerived')}</TableHead>
                <TableHead className="text-right">{t('health.coveragePct')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {h.coverage.map((c) => {
                const ratio = c.native_cost > 0 ? (c.our_cost / c.native_cost) * 100 : 0;
                return (
                  <TableRow key={`${c.harness}/${c.profile}`}>
                    <TableCell>
                      {c.harness}/{c.profile}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">
                      {c.sessions_with_native}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">{f.money(c.native_cost)}</TableCell>
                    <TableCell className="tabular text-right font-mono">{f.money(c.our_cost)}</TableCell>
                    <TableCell
                      className={cn(
                        'tabular text-right font-mono font-semibold',
                        ratio < 85 ? 'text-warn' : 'text-ok',
                      )}
                    >
                      {ratio.toFixed(1)}%
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-col items-start gap-1">
              <CardTitle>{t('health.unpricedModels')}</CardTitle>
            <CardDescription className="note">{t('health.unpricedBlurb')}</CardDescription>
            <CardDescription>
              {t('health.catalogCount', { n: h.pricedModels.toLocaleString() })}
              {h.catalogPath && (
                <>
                  {' · '}
                  <span className={h.catalogAgeMs != null && h.catalogAgeMs > 30 * 86_400_000 ? 'text-warn' : undefined}>
                    {h.catalogAgeMs != null
                      ? t('health.catalogAge', { age: age(h.catalogAgeMs / 1000) })
                      : t('health.catalogUnknownAge')}
                  </span>
                  {!h.catalogOwn && <> · {t('health.catalogBorrowed')}</>}
                </>
              )}
              {!h.catalogPath && <> · {t('health.catalogMissing')}</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {h.unpriced.length === 0 ? (
              <Empty>{t('health.allPriced')}</Empty>
            ) : (
              <BarList
                rows={h.unpriced.map((u) => ({
                  label: u.model,
                  value: u.calls,
                  display: t('health.callsN', { n: u.calls.toLocaleString() }),
                  color: vendorColor(u.vendor ?? 'unknown'),
                  icon: <VendorIcon vendor={u.vendor ?? 'unknown'} label={vendorLabel(u.vendor ?? 'unknown')} />,
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start gap-1">
            <CardTitle>{t('health.ingestErrors')}</CardTitle>
            <CardDescription className="note">{t('health.errorsBlurb')}</CardDescription>
          </CardHeader>
          {h.errors.length === 0 ? (
            <Empty>{t('health.noErrors')}</Empty>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t('col.source')}</TableHead>
                  <TableHead>{t('health.target')}</TableHead>
                  <TableHead className="text-right">{t('health.count')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {h.errors.map((e, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      {String(e.harness)}/{String(e.profile)}
                    </TableCell>
                    <TableCell className="text-muted-foreground/70 font-mono text-[11px]">
                      {String(e.target_key)}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">
                      {Number(e.error_count)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
