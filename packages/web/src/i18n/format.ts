import { useMemo } from 'react';
import { CURRENCIES, useI18n, type CurrencyCode } from './index';
import * as raw from '@/format';
import { formatValue } from '@/lib/pricing';

export interface Formatter {
  /** Token counts and percentages never convert -- only money does. */
  tokens: (n: number) => string;
  tokensParts: (n: number) => { value: string; unit: string };
  pct: (n: number | null | undefined) => string;
  age: (seconds: number | null | undefined) => string;
  countdown: (toMs: number | null | undefined, now?: number) => string;
  clock: (ms: number | null | undefined) => string;
  /**
   * A date, in the language the reader chose.
   *
   * Six call sites were formatting dates with `toLocaleDateString()` and no locale, which
   * means `Intl` used the *operating system's* language. Someone running the app in Thai on
   * a machine set to English read English dates, and the reverse read Thai dates in an
   * otherwise English page -- in a bilingual app that is not a cosmetic slip, because the
   * reader has told us which language they read in and we ignored it for one kind of value.
   *
   * There is no year unless the date is not in the current year, matching the compact style
   * the rest of the app uses for `clock`. A range crossing into another year has to show it,
   * or "Dec 28 – Jan 3" reads as eight months rather than six days.
   */
  day: (ms: number | null | undefined) => string;
  window: (kind: string) => string;

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
  const { currency, rate, t, lang } = useI18n();

  return useMemo<Formatter>(() => {
    const meta = CURRENCIES[currency];
    const isConverted = currency !== 'USD';
    const locale = lang === 'th' ? 'th-TH' : 'en-US';

    /**
     * A date in the chosen language, with the year only when it is not the current one.
     *
     * `Intl.DateTimeFormat` instances are cached by the engine, and this is called once per
     * rendered date across the page, so the formatter is built once per language rather than
     * per call.
     */
    const dayFormatter = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' });
    const dayWithYear = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' });
    const day = (ms: number | null | undefined): string => {
      if (ms == null) return '--';
      const date = new Date(ms);
      return (date.getFullYear() === new Date().getFullYear() ? dayFormatter : dayWithYear).format(date);
    };

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
      formatValue({ cost_usd: usd, cost_unknown_calls: unknownCalls, calls }, money);

    return {
      tokens: raw.tokens,
      tokensParts: raw.tokensParts,
      pct: raw.pct,
      age: raw.age,
      countdown: raw.countdown,
      clock: (ms) => ms == null ? '--' : new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ms),
      day,
      window: (kind) => {
        const names: Record<string, string> = { '5h': t('gauge.5h'), weekly: t('gauge.weekly'), weekly_opus: t('gauge.weeklyOpus'), weekly_sonnet: t('gauge.weeklySonnet'), monthly: t('gauge.monthly') };
        return names[kind] ?? kind;
      },
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
  }, [currency, rate, t, lang]);
}
