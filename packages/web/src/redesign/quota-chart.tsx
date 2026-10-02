import { useEffect, useRef, useState } from 'react';
import type { QuotaHistoryResponse } from '@/api';
import { useFormat } from '@/i18n/format';
import type { RedesignTranslate } from './shell';

/** Observed values only. Reset boundaries and unknown samples break the series. */
export function QuotaChart({ history, t, language }: { history: QuotaHistoryResponse; t: RedesignTranslate; language: 'en' | 'th' }) {
  const f = useFormat();
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const samples = history.segments.flatMap(segment => segment.samples);
  const first = samples.reduce((value, sample) => Math.min(value, sample.observedAt), Infinity);
  const last = samples.reduce((value, sample) => Math.max(value, sample.observedAt), -Infinity);
  const height = 112;
  const left = 34;
  const right = width - 6;
  const x = (at: number) => first === last ? (left + right) / 2 : left + (at - first) / (last - first) * (right - left);
  const y = (percent: number) => 6 + (100 - Math.min(100, Math.max(0, percent))) / 100 * (height - 14);
  const stamp = (at: number | null) => at === null ? t('redesign.unknownValue') : new Date(at).toLocaleString(language === 'th' ? 'th-TH' : 'en-US');
  const value = (percent: number | null) => percent === null ? t('redesign.unknownValue') : f.pct(percent);
  return <div className="qp-quota-chart" ref={container}>
    <div className="qp-quota-chart-label">{t('redesign.alertQuotaPercent')}</div>
    <svg className="qp-alert-segments" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${t('redesign.alertRiskChart')}. ${history.segments.map(segment => `${t('redesign.alertReset')}: ${stamp(segment.resetAt)}. ${segment.samples.map(sample => `${stamp(sample.observedAt)}: ${value(sample.usedPercent)}`).join('; ')}`).join('. ')}`}>
      {[0, 25, 50, 75, 100].map(percent => <g key={percent}><line x1={left} x2={right} y1={y(percent)} y2={y(percent)} className="qp-quota-grid"/><text x={left - 5} y={y(percent)} textAnchor="end" dominantBaseline="middle">{percent}%</text></g>)}
      {history.segments.map((segment, index) => <g key={`${segment.resetAt}-${index}`} data-reset={segment.resetAt ?? 'unknown'}>
        {index > 0 && segment.samples[0] && <line x1={x(segment.samples[0].observedAt)} x2={x(segment.samples[0].observedAt)} y1={6} y2={height - 8} className="qp-quota-reset"/>}
        {segment.samples.map((sample, i) => {
          if (sample.usedPercent === null) return null;
          const previous = segment.samples[i - 1];
          return <g key={`${sample.observedAt}-${i}`}>
            {previous?.usedPercent != null && <line className="qp-quota-series" x1={x(previous.observedAt)} x2={x(sample.observedAt)} y1={y(previous.usedPercent)} y2={y(sample.usedPercent)}/>}
            <circle className="qp-quota-point" cx={x(sample.observedAt)} cy={y(sample.usedPercent)} r={3}><title>{stamp(sample.observedAt)} · {value(sample.usedPercent)}</title></circle>
          </g>;
        })}
      </g>)}
    </svg>
    <div className="qp-quota-chart-dates"><span title={stamp(first)}>{f.clock(first)}</span><span title={stamp(last)}>{f.clock(last)}</span></div>
    <details className="qp-quota-samples"><summary>{t('redesign.alertObservedSamples')} ({samples.length})</summary><div><table><thead><tr><th>{t('redesign.alertObservedSamples')}</th><th>{t('redesign.alertQuotaPercent')}</th><th>{t('redesign.alertReset')}</th></tr></thead><tbody>{history.segments.flatMap((segment, index) => segment.samples.map((sample, i) => <tr key={`${index}-${i}`}><td>{stamp(sample.observedAt)}</td><td>{value(sample.usedPercent)}</td><td>{stamp(segment.resetAt)}</td></tr>))}</tbody></table></div></details>
  </div>;
}
