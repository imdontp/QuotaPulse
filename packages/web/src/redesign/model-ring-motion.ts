import { DURATION, EASE } from '../lib/motion';
import type { modelTokenDistribution } from './model-token-distribution';
import type { ModelSelectionIntent } from './model-selection-motion';

type Distribution = ReturnType<typeof modelTokenDistribution>;
interface RingObservation {
  contextKey: string;
  pairKey: string;
  value: Distribution;
  intent: ModelSelectionIntent | null;
  eligible: boolean;
}
export interface ModelRingMotionState {
  contextKey: string | null;
  pairKey: string | null;
  value: Distribution | null;
  consumedSerial: number;
}
export const initialModelRingMotion = (): ModelRingMotionState => ({ contextKey: null, pairKey: null, value: null, consumedSerial: 0 });
const geometry = (value: Distribution) => JSON.stringify([value.available, value.valid, value.gap, value.parts.map(part => [part.start, part.paintedSweep])]);

/** Only an explicit selection in the same scope may interpolate. No mount/refresh replay. */
export function observeModelRingMotion(state: ModelRingMotionState, next: RingObservation) {
  const changed = state.value !== null && geometry(state.value) !== geometry(next.value);
  const sameContext = state.contextKey === next.contextKey;
  const fresh = next.intent !== null && next.intent.serial > state.consumedSerial;
  const animate = next.eligible && sameContext && state.pairKey !== next.pairKey && changed && fresh
    && next.intent!.key === next.pairKey && next.intent!.contextKey === next.contextKey
    && state.value!.valid && state.value!.available && state.value!.total > 0
    && next.value.valid && next.value.available && next.value.total > 0;
  return { animate, cancel: !next.eligible || !sameContext || state.pairKey !== next.pairKey || changed,
    state: { contextKey: next.contextKey, pairKey: next.pairKey, value: next.value,
      consumedSerial: Math.max(state.consumedSerial, next.intent?.serial ?? 0) } };
}

export function ringFrame(value: Distribution, key: 'input' | 'output') {
  const part = value.parts.find(part => part.key === key)!;
  return { strokeDasharray: `${part.paintedSweep} ${360 - part.paintedSweep}`, strokeDashoffset: `${-(part.start + value.gap / 2)}` };
}

/** Native finite interpolation; final factual attributes already belong to the new selection. */
export function playModelRingMotion(root: HTMLElement, before: Distribution, after: Distribution) {
  const active = new Set<Animation>();
  const dispose = (animation: Animation) => {
    if (!active.delete(animation)) return;
    animation.removeEventListener('finish', finished); animation.removeEventListener('cancel', finished);
    animation.cancel();
  };
  const finished = (event: Event) => dispose(event.currentTarget as Animation);
  for (const key of ['input', 'output'] as const) for (const target of root.querySelectorAll<SVGCircleElement>(`[data-ring-sector=${key}],[data-ring-highlight=${key}]`)) {
    if (typeof target.animate !== 'function') continue;
    const animation = target.animate([ringFrame(before, key), ringFrame(after, key)],
      { duration: DURATION.fast, easing: `cubic-bezier(${EASE.motion.join(',')})`, iterations: 1, fill: 'none' });
    active.add(animation); animation.addEventListener('finish', finished); animation.addEventListener('cancel', finished);
  }
  return () => { for (const animation of [...active]) dispose(animation); };
}
