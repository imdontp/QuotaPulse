import type { UsageRecord } from './model';
import type { RedesignTranslate } from './shell';

/** Counts must use the same unit as total: weighted calls in production, records in preview. */
export function costValue(amount: number, priced: number, total: number, money: (amount: number) => string, unknown: string) {
  return total === 0 ? money(0) : priced === 0 ? unknown : `${money(amount)}${priced < total ? '+' : ''}`;
}

export function recordCostCoverage(records: readonly UsageRecord[]) {
  const native = records.filter(record => record.cost !== null && record.costSource === 'native').length;
  const api = records.filter(record => record.cost !== null && ['computed', 'estimated'].includes(record.costSource)).length;
  return { native, api, total: records.length };
}

export function CostValue({ amount, priced, total, money, t, unit = 'calls' }: {
  amount: number; priced: number; total: number; money: (amount: number) => string;
  t: RedesignTranslate; unit?: 'calls' | 'records';
}) {
  const description = `${t('redesign.pricedCoverage')}: ${priced} / ${total} ${t(unit === 'calls' ? 'redesign.modelsCalls' : 'redesign.records')}. ${t('redesign.partialCostNote')}`;
  return <span className="qp-cost-value" title={description}><span>{costValue(amount, priced, total, money, t('redesign.unknownValue'))}</span><span className="qp-visually-hidden"> ({description})</span></span>;
}
