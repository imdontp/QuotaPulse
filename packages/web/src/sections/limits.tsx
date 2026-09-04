import type { Overview } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FreshnessBadge } from '@/components/primitives';
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

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle>{t('limits.title')}</CardTitle>
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
              * One row per WINDOW, not per origin. A source can publish the same window
              * through several origins -- Claude reports one live and one from a cached
              * config that can be days old -- and listing each made a two-window source
              * fill four rows whose numbers openly disagreed. The reading in force is
              * shown; the ones it supersedes are on the freshness chip.
              */}
            {primaryLimits(ov.limits, now).map(({ primary: l, superseded }) => {
              const expired = isExpired(l, now);
              const tone = severityOf(l.used_percent);
              const exhausts = willExhaust(l, now);

              return (
                <TableRow key={`${l.source_id}-${l.window_kind}`}>
                  <TableCell>{l.display_name}</TableCell>
                  <TableCell className="text-muted-foreground">{l.window_kind}</TableCell>

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
                    {!expired && l.burn ? `${l.burn.percentPerHour.toFixed(1)}%/h` : '--'}
                  </TableCell>

                  <TableCell
                    className={cn('whitespace-nowrap', exhausts ? 'text-crit font-semibold' : 'text-muted-foreground')}
                  >
                    {expired
                      ? t('limits.rolledOver')
                      : l.burn?.projectedFullAt
                        ? f.clock(l.burn.projectedFullAt)
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
                                <span key={o.origin}>
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
  );
}
