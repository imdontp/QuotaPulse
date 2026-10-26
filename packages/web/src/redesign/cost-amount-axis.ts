/** Currency-axis precision follows the displayed quarter-step, after conversion.
 * Summary values/tooltips retain their existing monetary formatting. */
export function costAmountAxis(maximumUsd: number, language: 'en' | 'th', currency: 'USD' | 'THB', rate: number) {
  const convert = (usd: number) => currency === 'THB' ? usd * rate : usd;
  const maximum = Math.abs(convert(maximumUsd));
  const digits = maximum > 0 ? Math.max(2, Math.ceil(-Math.log10(maximum / 4))) : 2;
  // Avoid long strings of leading zeroes that consume a narrow chart's plot area.
  const scientific = digits > 6;
  const format = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', {
    style: 'currency', currency, maximumFractionDigits: scientific ? 2 : digits,
    ...(scientific ? { notation: 'scientific' as const } : {}),
  });
  const zero = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', { style: 'currency', currency });
  return { precise: digits > 2, format: (usd: number) => usd === 0 ? zero.format(0) : format.format(convert(usd)) };
}
