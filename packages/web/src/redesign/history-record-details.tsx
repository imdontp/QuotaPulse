import type { UsageEventRow } from '@/lib/usage-events';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';

/** Render recorded, allowlisted metadata; never request prompt or source payloads. */
export function HistoryRecordDetails({ row, basis, date }: { row: UsageEventRow; basis: string; date: string }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const unknown = t('redesign.unknownValue');
  const count = (value: number) => value.toLocaleString(lang);
  const groups = [
    { title: 'history.eventSummary', fields: [
      [t('history.recordedAt'), date], [t('history.kind'), t(`history.${row.grain}`)],
      [t('col.project'), row.project ?? t('redesign.unassigned')], [t('col.harness'), row.harness],
      [t('history.provider'), row.provider ?? unknown], [t('history.vendor'), row.vendor],
      [t('col.model'), row.model ?? unknown], [t('col.calls'), count(row.call_count)],
    ] },
    { title: 'history.tokenBreakdown', fields: [
      [t('col.total'), count(row.total_tokens)], [t('col.freshIn'), count(row.input_tokens)],
      [t('col.cacheRead'), count(row.cached_input_tokens)], [t('col.cacheWrite'), count(row.cache_write_tokens)],
      [t('col.output'), count(row.output_tokens)], [t('col.reasoning'), count(row.reasoning_tokens)],
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
    <dl>{group.fields.map(([label, value]) => <div key={String(label)}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    {group.title === 'history.tokenBreakdown' && row.total_tokens !== row.input_tokens + row.cached_input_tokens + row.cache_write_tokens + row.output_tokens && <p className="qp-footnote">{t('history.partialBreakdown')}</p>}
  </section>)}</div>;
}
