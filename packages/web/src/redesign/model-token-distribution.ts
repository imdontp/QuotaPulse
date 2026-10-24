import type { DetailedFacts } from '@/api';

export type ModelTokenFacts = Pick<DetailedFacts, 'inputTokens' | 'cachedInputTokens' | 'cacheWriteTokens' | 'outputTokens' | 'tokens'>;

/** Input/output shares describe recorded components, never an inferred remainder. */
export function modelTokenDistribution(facts: ModelTokenFacts) {
  const components = [facts.inputTokens, facts.cachedInputTokens, facts.cacheWriteTokens];
  const finiteValues = [...components, facts.outputTokens, facts.tokens].every(value => Number.isFinite(value) && value >= 0);
  const input = components.reduce((sum, value) => sum + value, 0);
  const total = input + facts.outputTokens;
  const valid = finiteValues && Number.isFinite(input) && Number.isFinite(total);
  const reconciles = valid && Math.abs(total - facts.tokens) <= Number.EPSILON * 16 * Math.max(1, total, facts.tokens);
  const available = valid && (total > 0 || facts.tokens === 0);
  const inputSweep = available && total > 0 ? input / total * 360 : 0;
  const outputSweep = available && total > 0 ? facts.outputTokens / total * 360 : 0;
  // A tiny real component keeps a tiny arc; a decorative gap cannot erase it.
  const gap = inputSweep > 0 && outputSweep > 0 ? Math.min(2, Math.min(inputSweep, outputSweep) / 4) : 0;
  return { valid, available, input, output: facts.outputTokens, total, recordedTotal: facts.tokens, reconciles,
    parts: [
      { key: 'input' as const, value: input, share: available && total > 0 ? input / total * 100 : null, start: 0, sweep: inputSweep, paintedSweep: Math.max(0, inputSweep - gap) },
      { key: 'output' as const, value: facts.outputTokens, share: available && total > 0 ? facts.outputTokens / total * 100 : null, start: inputSweep, sweep: outputSweep, paintedSweep: Math.max(0, outputSweep - gap) },
    ], gap };
}
