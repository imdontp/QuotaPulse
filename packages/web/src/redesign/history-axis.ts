import { tokens } from '../format';

/** Axis labels must distinguish real quarter-scale positions, including tiny counts. */
export function historyAxis(maximum: number, language: 'en' | 'th') {
  if (!Number.isFinite(maximum) || maximum < 0) return { scaleMaximum: 1, ticks: [] };
  if (maximum === 0) {
    return { scaleMaximum: 1, ticks: [{ fraction: 0, value: 0, label: '0' }] };
  }
  const fractions = [0, .25, .5, .75, 1];
  const values = fractions.map(fraction => maximum * fraction);
  let labels = values.map(tokens);
  if (new Set(labels).size !== labels.length) {
    const formatter = new Intl.NumberFormat(language === 'th' ? 'th-TH' : 'en-US', {
      notation: maximum < .001 ? 'scientific' : 'compact', maximumSignificantDigits: 3,
    });
    labels = values.map(value => value === 0 ? '0' : formatter.format(value));
  }
  // An extreme subnormal can underflow when divided into quarters. Endpoints
  // still truthfully describe its scale without duplicating zero labels.
  const indices = new Set(labels).size === labels.length ? [0, 1, 2, 3, 4] : [0, 4];
  return { scaleMaximum: maximum, ticks: indices.map(index => ({ fraction: fractions[index], value: values[index], label: labels[index] })) };
}
