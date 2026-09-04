import { useMemo } from 'react';
import { CURRENCIES, useI18n, type CurrencyCode } from './index';
import * as raw from '@/format';

export interface Formatter {
  /** Token counts and percentages never convert -- only money does. */
  tokens: (n: number) => string;
  tokensParts: (n: number) => { value: string; unit: string };
  pct: (n: number | null | undefined) => string;
  age: (seconds: number | null | undefined) => string;
  countdown: (toMs: number | null | undefined, now?: number) => string;
  clock: (ms: number | null | undefined) => string;

  /** Converts from USD into the selected currency at the user's rate. */
  money: (usd: number | null | undefined, unknownCalls?: number) => string;
  /**
   * A total for a group of calls. When EVERY call in the group is on an unpriced model
   * the answer is not zero, it is unknown -- so this returns a dash where `money` would
   * return a misleading `$0.0000+`. Live, Cost and Models all show the same kind of
   * total and must agree; Live did not, and reported Codex as $0.0000+ for a day.
   */
  moneyTotal: (usd: number | null | undefined, unknownCalls: number, calls: number) => string;
  /** The rate as displayed, e.g. "1 USD = ฿36". Empty when no conversion applies. */
  rateLabel: string;
  /** True when figures on screen are not in their source unit. */
  isConverted: boolean;
  currency: CurrencyCode;
  /** Explains a single converted figure, for a tooltip. Null when nothing was converted. */
  explain: (usd: number | null | undefined) => string | null;
}

export function useFormat(): Formatter {
  const { currency, rate, t } = useI18n();

  return useMemo<Formatter>(() => {
    const meta = CURRENCIES[currency];
    const isConverted = currency !== 'USD';

    const money = (usd: number | null | undefined, unknownCalls = 0): string => {
      if (usd == null) return '--';
      const v = usd * (isConverted ? rate : 1);
      const sym = meta.symbol;
      let s: string;
      if (v >= 1000) s = `${sym}${Math.round(v).toLocaleString()}`;
      else if (v >= 100) s = `${sym}${v.toFixed(0)}`;
      else if (v >= 1) s = `${sym}${v.toFixed(meta.decimals === 0 ? 1 : 2)}`;
      else s = `${sym}${v.toFixed(meta.decimals === 0 ? 2 : 4)}`;
      // A trailing + marks totals that exclude calls on unpriced models, so a figure is
      // never quietly understated.
      return unknownCalls > 0 ? `${s}+` : s;
    };

    const moneyTotal = (usd: number | null | undefined, unknownCalls: number, calls: number) =>
      calls > 0 && unknownCalls >= calls ? '--' : money(usd, unknownCalls);

    return {
      tokens: raw.tokens,
      tokensParts: raw.tokensParts,
      pct: raw.pct,
      age: raw.age,
      countdown: raw.countdown,
      clock: raw.clock,
      money,
      moneyTotal,
      currency,
      isConverted,
      rateLabel: isConverted ? `1 USD = ${meta.symbol}${rate}` : '',
      explain: (usd) =>
        !isConverted || usd == null
          ? null
          : t('cost.converted', { rate: `1 USD = ${meta.symbol}${rate}` }) +
            ` (${raw.money(usd)})`,
    };
  }, [currency, rate, t]);
}
