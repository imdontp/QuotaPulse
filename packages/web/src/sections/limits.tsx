import type { Overview } from '@/api';
import { useState } from 'react';
import { quotaSummaries, type Readiness } from '@/lib/quota-summary';
import { Gauge } from '@/components/gauge';
import { Empty, FreshnessBadge } from '@/components/primitives';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { age } from '@/format';
import { Hint } from '@/components/ui/tooltip';
import { isExpired, pct, primaryLimits, severityOf, willExhaust } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export function LimitsSection({ ov }: { ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const now = ov.now;
  const [subscription, setSubscription] = useState('all');
  const [status, setStatus] = useState<Readiness | 'all'>('all');
  const summaries = quotaSummaries(ov);
  const statuses = new Map(summaries.map(s => [s.subscription.subscription_key, s.status]));
  const allRows = primaryLimits(ov.limits, now);
  const rows = allRows.filter(({ primary: l }) => {
    const owner = l.subscription_key ?? l.account_key;
    return (subscription === 'all' || owner === subscription) &&
      (status === 'all' || ((owner ? statuses.get(owner) : undefined) ?? 'check') === status);
  });

  return (
    <div className="flex flex-col gap-3.5">
      {/*
        Three states, and the two empty ones used to be the same state rendered twice.

        "Nothing has been read yet" and "your filter matched nothing" are different
        sentences, and only one of them has a way out. The filter row stays mounted whenever
        there is anything to filter, so a reader who narrows to zero can widen it again;
        hiding the controls along with the results would strand them. With no readings at
        all the filters are hidden, because filtering an empty set is not a choice.

        The old version also rendered the empty message *and then* the mobile grid, the
        eight-column desktop table and its footnote over a zero-row body -- so a reader with
        no quota data was shown the full apparatus of a quota table with nothing in it.
      */}
      {allRows.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <Select
            label={t('quota.allSubscriptions')}
            value={subscription}
            onChange={e => setSubscription(e.target.value)}
          >
            <option value="all">{t('quota.allSubscriptions')}</option>
            {ov.subscriptions.map(s => <option key={s.subscription_key} value={s.subscription_key}>{s.subscription_display_name}</option>)}
          </Select>
          <Select
            label={t('quota.statusFilter')}
            value={status}
            onChange={e => setStatus(e.target.value as Readiness | 'all')}
          >
            <option value="all">{t('quota.all')}</option>
            {(['attention', 'available', 'check', 'inactive'] as const).map(s => <option key={s} value={s}>{t(`quota.${s}`)}</option>)}
          </Select>
        </div>
      )}
      {rows.length === 0 ? (
        <Empty>{allRows.length === 0 ? t('quota.noneYet') : t('quota.none')}</Empty>
      ) : (
        <>
        <div className="grid gap-4 md:hidden">
        {rows.map(({ primary: l, superseded }) => <Card key={`${l.subscription_key ?? l.account_key ?? l.source_id}-${l.window_kind}`}>
          <CardHeader><CardTitle as="h2">{l.subscription_display_name ?? l.account_display_name ?? l.display_name}</CardTitle></CardHeader>
          <CardContent>
            <Gauge limit={l} now={now} badge={<FreshnessBadge seconds={l.ageSeconds} />} />
            <details className="mt-4 border-t pt-3 text-xs text-muted-foreground"><summary className="cursor-pointer rounded">{t('quota.readers')}</summary>
              {[l, ...superseded].map(reader => <p className="mt-2 break-all" key={`${reader.source_id}-${reader.origin}`}>{reader.origin} · {pct(reader.used_percent)} · {age(reader.ageSeconds)}</p>)}
            </details>
          </CardContent>
        </Card>)}
      </div>
      <div className="hidden min-w-0 md:block">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle as="h2">{t('limits.title')}</CardTitle>
          <CardDescription className="note">{t('limits.blurb')}</CardDescription>
        </CardHeader>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>{t('col.source')}</TableHead>
              <TableHead>{t('col.window')}</TableHead>
              <TableHead className="text-right">{t('col.used')}</TableHead>
              <TableHead className="w-44">{t('col.level')}</TableHead>
              <TableHead>{t('col.resets')}</TableHead>
              <TableHead className="text-right">{t('col.burn')}</TableHead>
              <TableHead>{t('col.projectedFull')}</TableHead>
              <TableHead>{t('col.freshness')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {/*
              * One row per ACCOUNT/WINDOW, not per reader or origin. Codex and Hermes can
              * read the same OpenAI subscription, while Claude's live and cached feeds
              * are also separate origins. The reading in force is shown; the ones it
              * supersedes are on the freshness chip.
              */}
            {rows.map(({ primary: l, superseded }) => {
              const expired = isExpired(l, now);
              const tone = severityOf(l.used_percent);
              const exhausts = willExhaust(l, now);
              const forecast = l.forecast;
              const forecastReady = forecast?.status === 'ready';
              const rate = forecastReady ? forecast.percentPerHour : forecast == null ? l.burn?.percentPerHour : null;
              const projected = forecastReady ? forecast.projectedFullAt : forecast == null ? l.burn?.projectedFullAt : null;

              return (
                <TableRow key={`${l.subscription_key ?? l.account_key ?? `source:${l.source_id}`}-${l.window_kind}`}>
                  <TableCell>{l.subscription_display_name ?? l.account_display_name ?? l.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{f.window(l.window_kind)}</TableCell>

                  <TableCell className="tabular text-right font-mono font-semibold">
                    {expired ? (
                      <Hint text={t('limits.expiredHint', { pct: Math.round(l.used_percent ?? 0) + '%' })}>
                        <span className="text-muted-foreground/60 cursor-default">--</span>
                      </Hint>
                    ) : l.used_percent == null ? (
                      <span className="text-muted-foreground/60">--</span>
                    ) : (
                      <span
                        className={cn(
                          tone === 'crit' && 'text-crit',
                          tone === 'warn' && 'text-warn',
                        )}
                      >
                        {Math.round(l.used_percent)}%
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <div className="bg-track h-1.5 overflow-hidden rounded">
                      {!expired && l.used_percent != null && (
                        <div
                          className={cn(
                            'h-full rounded',
                            tone === 'crit' ? 'bg-crit' : tone === 'warn' ? 'bg-warn' : 'bg-ok',
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, l.used_percent))}%` }}
                        />
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-muted-foreground whitespace-nowrap">
                    {l.resets_at == null ? (
                      /* No reset timestamp at all: this is the cached config fallback,
                         which is void once it is older than the window it describes. */
                      <span className="text-muted-foreground/60">{t('limits.noReset')}</span>
                    ) : (
                      <>
                        {f.clock(l.resets_at)}
                        {l.resets_at <= now && (
                          <span className="text-muted-foreground/60"> {t('limits.passed')}</span>
                        )}
                      </>
                    )}
                  </TableCell>

                  <TableCell className="tabular text-muted-foreground text-right font-mono">
                    {!expired && rate != null ? `${rate.toFixed(1)}%/h` : '--'}
                  </TableCell>

                  <TableCell
                    className={cn('whitespace-nowrap', exhausts ? 'text-crit font-semibold' : 'text-muted-foreground')}
                  >
                    {expired
                      ? t('limits.rolledOver')
                      : projected
                        ? f.clock(projected)
                        : forecast?.status === 'insufficient'
                          ? t('limits.forecastNeed')
                          : forecast?.status === 'flat'
                            ? t('limits.forecastFlat')
                            : t('limits.notBeforeReset')}
                  </TableCell>

                  <TableCell>
                    <span className="inline-flex items-center gap-1">
                      <FreshnessBadge seconds={l.ageSeconds} origin={l.origin} />
                      {superseded.length > 0 && (
                        /* Its own trigger, not a tooltip nested inside the badge's. */
                        <Hint
                          text={
                            <span className="flex flex-col gap-1">
                              {superseded.map((o) => (
                                <span key={`${o.source_id}:${o.origin}`}>
                                  {t('limits.alsoVia', {
                                    pct: pct(o.used_percent),
                                    origin: o.origin,
                                    age: age(o.ageSeconds),
                                  })}
                                </span>
                              ))}
                            </span>
                          }
                        >
                          <Badge variant="origin" className="cursor-help" tabIndex={0}>
                            +{superseded.length}
                          </Badge>
                        </Hint>
                      )}
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <CardContent className="pt-3">
          <p className="text-muted-foreground/70 note text-[11.5px] leading-relaxed">
            {t('limits.footnote')}
          </p>
        </CardContent>
      </Card>
      </div>
        </>
      )}
    </div>
  );
}
