import type { HistorySummaryResponse } from '@/api';
import { useI18n, useT } from '@/i18n';
import { useFormat } from '@/i18n/format';
import './history.css';

export function HistoryTimeline({ data }: { data: HistorySummaryResponse }) {
  const t = useT();
  const f = useFormat();
  const { lang } = useI18n();
  const totals = data.totals;
  const count = (value: number) => value.toLocaleString(lang);
  const entries = new Map(data.timeline.map(row => [row.at, row]));
  const buckets = Array.from({ length: Math.ceil((data.scope.to - data.scope.from) / data.bucketMs) }, (_, index) => {
    const at = data.scope.from + index * data.bucketMs;
    return { at, inputTokens: entries.get(at)?.inputTokens ?? 0, outputTokens: entries.get(at)?.outputTokens ?? 0 };
  });
  const max = Math.max(1, ...buckets.flatMap(row => [row.inputTokens, row.outputTokens]));
  const x = (index: number) => 40 + 920 * index / Math.max(1, buckets.length - 1);
  const y = (value: number) => 174 - 144 * value / max;
  const points = (key: 'inputTokens' | 'outputTokens') => buckets.map((row, index) => `${x(index)},${y(row[key])}`).join(' ');
  const date = (at: number) => new Intl.DateTimeFormat(lang === 'th' ? 'th-TH' : 'en-US', { dateStyle: 'short', timeStyle: 'short' }).format(at);
  const priced = totals.computed_calls + totals.estimated_calls;
  const value = (amount: number, calls: number) => totals.records === 0 ? f.money(0) : calls ? `${f.money(amount)}${calls < totals.calls ? '+' : ''}` : t('redesign.unknownValue');
  return <section className="qp-history-timeline qp-panel" data-testid="history-timeline">
    <h2>{t('history.timeline')}</h2>
    <p className="qp-footnote">{t('history.timelineNote')}</p>
    <div className="qp-history-summary">
      <article><span>{t('col.total')}</span><strong data-testid="history-total-tokens">{count(totals.tokens)}</strong></article>
      <article><span>{t('col.calls')}</span><strong>{count(totals.calls)}</strong><small>{count(totals.records)} {t('history.records')} · {count(totals.sessions)} {t('redesign.sessions')}</small></article>
      <article><span>{t('history.apiTotal')}</span><strong>{value(totals.api_value_usd, priced)}</strong><small>{t('history.nativeTotal')}: {value(totals.reported_native_usd, totals.native_calls)}</small><small>{count(priced)} / {count(totals.calls)} {t('col.calls')}</small></article>
      <article><span>{t('history.effortDistribution')}</span><ul>{data.effort.map(row => <li key={JSON.stringify(row.effort)}>{row.effort ?? t('redesign.unknownValue')}: {count(row.calls)}</li>)}</ul>{!data.effort.length && <strong>—</strong>}</article>
    </div>
    <div className="qp-history-legend"><span>{t('history.inputCombined')}</span><span>{t('col.output')}</span></div>
    <svg viewBox="0 0 1000 208" role="img" aria-label={`${t('history.timeline')}: ${count(totals.tokens)}`}>
      {[0, .5, 1].map(fraction => <g key={fraction}><line x1="40" x2="960" y1={y(max * fraction)} y2={y(max * fraction)} stroke="currentColor" opacity=".15"/><text x="0" y={y(max * fraction)} fill="currentColor" fontSize="11">{f.tokens(max * fraction)}</text></g>)}
      <polyline points={points('inputTokens')} fill="none" stroke="var(--history-input)" strokeWidth="2"/>
      <polyline points={points('outputTokens')} fill="none" stroke="var(--history-output)" strokeWidth="2"/>
      {buckets.map((row, index) => <g key={row.at}><title>{date(row.at)} · {t('history.inputCombined')}: {count(row.inputTokens)} · {t('col.output')}: {count(row.outputTokens)}</title><circle cx={x(index)} cy={y(row.inputTokens)} r="2" fill="var(--history-input)"/><circle cx={x(index)} cy={y(row.outputTokens)} r="2" fill="var(--history-output)"/></g>)}
      <text x="40" y="202" fill="currentColor" fontSize="11">{date(data.scope.from)}</text><text x="960" y="202" textAnchor="end" fill="currentColor" fontSize="11">{date(data.scope.to)}</text>
    </svg>
    {totals.tokens !== totals.inputTokens + totals.cachedInputTokens + totals.cacheWriteTokens + totals.outputTokens && <p className="qp-footnote">{t('history.partialBreakdown')}</p>}
  </section>;
}
