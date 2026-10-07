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
    { title: 'history.eventSummary', fields: [] },
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
    <h3 className={group.title === 'history.eventSummary' || group.title === 'history.tokenBreakdown' ? 'qp-history-detail-accessible-heading' : undefined}>{t(group.title)}</h3>
    {group.title === 'history.eventSummary' ? <>
      <dl className="qp-history-detail-record-meta">
        <div data-field="1"><dt>{t('history.kind')}</dt><dd className="qp-history-record-kind">{t(`history.${row.grain}`)}</dd></div>
        <div data-field="7"><dt>{t('col.calls')}</dt><dd title={count(row.call_count)} aria-label={String(row.call_count)}>{count(row.call_count)}</dd></div>
        <div data-field="0"><dt>{t('history.recordedAt')}</dt><dd><time dateTime={new Date(row.timestamp_ms).toISOString()}>{date}</time></dd></div>
      </dl>
      <dl className="qp-history-detail-identities">
        <div data-field="2" className="qp-history-detail-identity"><i aria-hidden="true"><Folder size={21}/></i><dt>{t('col.project')}</dt><dd>{row.project ?? t('redesign.unassigned')}</dd></div>
        <div data-field="3" data-harness={row.harness} className="qp-history-detail-identity"><i aria-hidden="true"><HarnessIcon harness={row.harness} vendor={harnessVendor} label={row.harness}/></i><dt>{t('col.harness')}</dt><dd>{row.harness}</dd></div>
        <div data-field="4" className="qp-history-detail-identity"><i aria-hidden="true"><VendorIcon vendor={row.provider ?? 'unknown'}/></i><dt>{t('history.provider')}</dt><dd>{row.provider ?? unknown}</dd></div>
        <div data-field="6" className="qp-history-detail-identity qp-history-detail-model"><i aria-hidden="true"><VendorIcon vendor={row.vendor}/></i><dt>{t('col.model')}</dt><dd>{row.model ?? unknown}</dd><dt className="qp-history-detail-maker-label">{t('history.vendor')}</dt><dd className="qp-history-detail-maker-value"><span aria-hidden="true">{t('history.vendor')}: </span>{row.vendor}</dd></div>
      </dl>
    </> : <dl>{group.fields.map(([label, value], index) => {
      const token = group.title === 'history.tokenBreakdown' && typeof value === 'number';
      const tokenIcons = [BarChart3, ArrowDown, Database, Database, ArrowUp, Zap];
      const TokenIcon = tokenIcons[index];
      return <div key={String(label)}>
        <dt>{label}</dt><dd title={token ? count(value) : undefined} aria-label={token ? String(value) : undefined}>{token ? <><TokenIcon size={12} aria-hidden="true"/><span>{f.tokens(value)}</span></> : value}</dd>
      </div>;
    })}</dl>}
    {group.title === 'history.pricingSource' && <p className="qp-history-detail-coverage">{t('history.coverage')}</p>}
    {group.title === 'history.tokenBreakdown' && row.total_tokens !== row.input_tokens + row.cached_input_tokens + row.cache_write_tokens + row.output_tokens && <p className="qp-footnote">{t('history.partialBreakdown')}</p>}
  </section>)}</div>;
}
