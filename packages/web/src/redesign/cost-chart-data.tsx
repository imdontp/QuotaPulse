import type { CostAnalysisResponse } from '@/api';
import type { RedesignTranslate } from './shell';
import { CostValue } from './cost-value';
import './chart-data.css';

export function CostChartData({ points, basis, language, money, t }: {
  points: CostAnalysisResponse['points']; basis: 'api' | 'native';
  language: 'en' | 'th'; money: (amount: number) => string; t: RedesignTranslate;
}) {
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const number = (value: number) => new Intl.NumberFormat(locale).format(value);
  return <details className="qp-chart-data qp-cost-chart-data" data-basis={basis}>
    <summary>{t('redesign.chartData')} ({number(points.length)})</summary><div><table>
      <caption>{t('redesign.costTrend')} · {t(basis === 'api' ? 'redesign.costApiBasis' : 'redesign.costNativeBasis')}</caption>
      <thead><tr><th scope="col">{t('redesign.chartBucketStart')}</th><th scope="col">{t('redesign.costTotal')}</th><th scope="col">{t('redesign.costPricedTokens')}</th><th scope="col">{t('redesign.costCoverage')}</th></tr></thead>
      <tbody>{points.map(point => <tr key={point.start} data-at={point.start} data-amount={point.amount} data-priced-tokens={point.pricedTokens} data-priced-calls={point.pricedCalls} data-all-calls={point.allCalls}>
        <td><time dateTime={new Date(point.start).toISOString()}>{new Date(point.start).toLocaleString(locale)}</time></td>
        <td><CostValue amount={point.amount} priced={point.pricedCalls} total={point.allCalls} money={money} t={t}/></td>
        <td>{number(point.pricedTokens)}</td><td>{number(point.pricedCalls)} / {number(point.allCalls)} {t('redesign.modelsCalls')}</td>
      </tr>)}</tbody>
    </table></div>
  </details>;
}
