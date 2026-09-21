import { GitBranch, Radio, TriangleAlert } from 'lucide-react';
import type { HarnessStatus, Overview, SourceStatus } from '@/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Empty } from '@/components/primitives';
import { HarnessIcon } from '@/components/harness-icon';
import { age } from '@/format';
import { useFormat } from '@/i18n/format';
import { useT } from '@/i18n';

function sourceFreshness(source: SourceStatus, now: number): { label: string; variant: 'ok' | 'outline' | 'warn' } {
  if (source.telemetry.gap) return { label: 'usage newer', variant: 'warn' };
  switch (source.telemetry.freshness) {
    case 'live':
      return { label: 'live', variant: 'ok' };
    case 'recent':
      return { label: 'recent', variant: 'outline' };
    case 'stale':
      return { label: source.telemetry.reason === 'cached_only' ? 'cached' : 'stale', variant: 'warn' };
    case 'expired':
      return { label: 'expired', variant: 'warn' };
    default:
      return { label: source.telemetry.reason === 'reader_error' ? 'reader error' : 'no quota', variant: 'warn' };
  }
}

function lastSeen(source: SourceStatus, now: number): string {
  return source.last_event_ts == null ? '--' : age(Math.max(0, (now - source.last_event_ts) / 1000));
}

function linkedNames(source: SourceStatus, ov: Overview): string {
  const harness = (ov.harnesses ?? []).find((entry) => entry.source_ids.includes(source.source_id));
  if (!harness || harness.subscription_keys.length === 0) return '—';
  return harness.subscription_keys
    .map((key) => ov.subscriptions.find((subscription) => subscription.subscription_key === key)?.subscription_display_name ?? key)
    .join(', ');
}

function DelegateRoutes({ ov }: { ov: Overview }) {
  const t = useT();
  const f = useFormat();
  const delegates = (ov.harnesses ?? []).filter((harness) => harness.parent_harness_key != null);
  if (delegates.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1">
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          {t('sources.routesTitle')}
        </CardTitle>
        <CardDescription className="note">{t('sources.routesBlurb')}</CardDescription>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {delegates.map((delegate) => {
          const parent = (ov.harnesses ?? []).find((harness) => harness.harness_key === delegate.parent_harness_key);
          const subscriptions = delegate.subscription_keys
            .map((key) => ov.subscriptions.find((subscription) => subscription.subscription_key === key)?.subscription_display_name ?? key)
            .join(', ');
          return (
            <div key={delegate.harness_key} className="border-border/70 bg-muted/15 rounded-md border px-3 py-2.5">
              <div className="flex items-center gap-2">
                <HarnessIcon
                  harness={delegate.harness}
                  vendor={delegate.vendor}
                  label={delegate.display_name}
                  className="text-[14px]"
                />
                <span className="text-[12px] font-medium">{delegate.display_name}</span>
                <div className="flex-1" />
                <Badge variant={delegate.usage_attributed ? 'ok' : 'outline'}>
                  {delegate.usage_attributed ? t('sources.attributed') : t('sources.parentOnly')}
                </Badge>
              </div>
              <div className="text-muted-foreground/75 mt-1.5 text-[11px] leading-relaxed">
                {parent?.display_name ?? t('sources.unknownParent')}
                {subscriptions ? ` · ${subscriptions}` : ` · ${f.tokens(delegate.total_tokens)} tokens`}
              </div>
              {!delegate.usage_attributed && (
                <div className="text-muted-foreground/70 mt-1 text-[10.5px]">{t('sources.parentOnlyHint')}</div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function SourcesSection({ ov }: { ov: Overview }) {
  const t = useT();
  const now = ov.now;
  const sources = ov.sourceStatus ?? [];

  return (
    <div className="flex flex-col gap-3.5">
      <Card>
        <CardHeader className="flex-col items-start gap-1">
          <CardTitle className="flex items-center gap-2">
            <Radio className="size-4 text-muted-foreground" />
            {t('sources.title')}
          </CardTitle>
          <CardDescription className="note">{t('sources.blurb')}</CardDescription>
        </CardHeader>
        {sources.length === 0 ? (
          <Empty>{t('sources.empty')}</Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>{t('sources.source')}</TableHead>
                <TableHead>{t('sources.subscription')}</TableHead>
                <TableHead>{t('sources.quota')}</TableHead>
                <TableHead>{t('sources.lastUsage')}</TableHead>
                <TableHead className="text-right">{t('col.calls')}</TableHead>
                <TableHead className="text-right">{t('sources.samples')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => {
                const status = sourceFreshness(source, now);
                return (
                  <TableRow key={source.source_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <HarnessIcon
                          harness={source.harness}
                          vendor={source.vendor}
                          label={source.display_name}
                          className="text-muted-foreground text-[15px]"
                        />
                        <div className="min-w-0">
                          <div className="truncate text-[12.5px] font-medium">{source.display_name}</div>
                          <div className="text-muted-foreground/65 font-mono text-[10.5px]">
                            {source.harness}/{source.profile}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[11.5px]">
                      {linkedNames(source, ov)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={status.variant}>{status.label}</Badge>
                        {source.telemetry.origins.slice(0, 2).map((origin) => (
                          <Badge key={origin} variant="origin">
                            {origin}
                          </Badge>
                        ))}
                      </div>
                      {source.telemetry.reason === 'usage_newer_than_quota' && (
                        <div className="text-warn mt-1 inline-flex items-center gap-1 text-[10.5px]">
                          <TriangleAlert className="size-3" />
                          {t('sources.usageNewerThanQuota')}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-[11.5px]">
                      {lastSeen(source, now)}
                    </TableCell>
                    <TableCell className="tabular text-right font-mono">{source.calls.toLocaleString()}</TableCell>
                    <TableCell className="tabular text-muted-foreground text-right font-mono">
                      {source.limit_samples.toLocaleString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <DelegateRoutes ov={ov} />
    </div>
  );
}
