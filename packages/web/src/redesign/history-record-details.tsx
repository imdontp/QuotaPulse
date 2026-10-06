import type { UsageEventRow } from '@/lib/usage-events';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import { BarChart3, Database, Folder, ArrowDown, ArrowUp, Zap } from 'lucide-react';
import { HarnessIcon } from '@/components/harness-icon';
import { VendorIcon } from '@/components/vendor-icon';

/** Render recorded, allowlisted metadata; never request prompt or source payloads. */
export function HistoryRecordDetails({ row, harnessVendor, basis, date }: { row: UsageEventRow; harnessVendor?: string; basis: string; date: string }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const unknown = t('redesign.unknownValue');
  const count = (value: number) => value.toLocaleString(lang, { maximumFractionDigits: 20 });
  const groups = [
    { title: 'history.eventSummary', fields: [
      [t('history.recordedAt'), date], [t('history.kind'), t(`history.${row.grain}`)],
      [t('col.project'), row.project ?? t('redesign.unassigned')], [t('col.harness'), row.harness],
      [t('history.provider'), row.provider ?? unknown], [t('history.vendor'), row.vendor],
      [t('col.model'), row.model ?? unknown], [t('col.calls'), count(row.call_count)],
    ] },
    { title: 'history.tokenBreakdown', fields: [
      [t('col.total'), row.total_tokens], [t('col.freshIn'), row.input_tokens],
      [t('col.cacheRead'), row.cached_input_tokens], [t('col.cacheWrite'), row.cache_write_tokens],
      [t('col.output'), row.output_tokens], [t('col.reasoning'), row.reasoning_tokens],
    ] },
    { title: 'history.pricingSource', fields: [
      [t('history.basis'), basis],
      [t('col.value'), row.cost_usd !== null && ['native', 'computed', 'estimated'].includes(row.cost_source) ? f.money(row.cost_usd) : unknown],
      [t('history.priceProvider'), row.price_provider ?? unknown],
    ] },
    { title: 'history.runtimeMetadata', fields: [
      [t('col.source'), row.source_name], [t('history.session'), row.session_key ?? unknown],
      [t('history.effortDistribution'), row.effort ?? unknown], [t('history.serviceTier'), row.service_tier ?? unknown],
      [t('history.duration'), row.duration_ms !== null ? `${count(row.duration_ms)} ms` : unknown],
      [t('history.subagent'), row.is_subagent === null ? unknown : t(row.is_subagent ? 'history.yes' : 'history.no')],
    ] },
  ] satisfies Array<{ title: Parameters<typeof t>[0]; fields: Array<Array<string | number>> }>;
  return <div className="qp-history-detail-groups">{groups.map(group => <section key={group.title} data-group={group.title} aria-label={t(group.title)}>
    <h3>{t(group.title)}</h3>
    <dl>{group.fields.map(([label, value], index) => {
      const token = group.title === 'history.tokenBreakdown' && typeof value === 'number';
      const tokenIcons = [BarChart3, ArrowDown, Database, Database, ArrowUp, Zap];
      const TokenIcon = tokenIcons[index];
      const identity = group.title === 'history.eventSummary' && index >= 2 && index <= 6;
      const identityIcon = !identity ? null : index === 2 ? <Folder size={21} aria-hidden="true"/> : index === 3 ? <HarnessIcon harness={row.harness} vendor={harnessVendor} label={row.harness}/> : <VendorIcon vendor={index === 4 ? row.provider ?? 'unknown' : row.vendor}/>;
      return <div key={String(label)} data-field={group.title === 'history.eventSummary' ? index : undefined} data-harness={group.title === 'history.eventSummary' && index === 3 ? row.harness : undefined} className={identity ? 'qp-history-detail-identity' : undefined}>
        {identityIcon && <i aria-hidden="true">{identityIcon}</i>}
        <dt>{label}</dt><dd title={token ? count(value) : undefined} aria-label={token ? String(value) : undefined}>{token ? <><TokenIcon size={14} aria-hidden="true"/><span>{f.tokens(value)}</span></> : value}</dd>
      </div>;
    })}</dl>
    {group.title === 'history.tokenBreakdown' && row.total_tokens !== row.input_tokens + row.cached_input_tokens + row.cache_write_tokens + row.output_tokens && <p className="qp-footnote">{t('history.partialBreakdown')}</p>}
  </section>)}</div>;
}
