import { useEffect, useRef, useState } from 'react';

/**
 * A one-shot signal that a figure moved, and moved enough to be worth noticing.
 *
 * ## Why this exists
 *
 * A dashboard that repaints itself roughly once a second has a real problem with numbers:
 * almost every figure on it is always changing, by small amounts, forever. So "this number
 * moved" is not information -- it is the background noise of a live page. Which means the
 * usual treatments are both wrong. No signal at all and a person cannot tell a machine that
 * is working from one that is idle, because the text looks identical either way. A signal on
 * every change and the page strobes, which is worse than silence and is actively unpleasant
 * to look at.
 *
 * So it has to be a *material* change, and it has to be rare.
 *
 * ## What "material" means here
 *
 * Big enough that a person would notice it happened between two glances. Deliberately
 * expressed as a fraction of the previous value rather than an absolute count, because
 * "10,000 tokens more" means something very different on a figure showing 40,000 than on one
 * showing 40 million. An `absolute` floor covers the other end, where a figure that has just
 * started from zero would otherwise treat its first 50 calls as a 500% change.
 *
 * ## What it is not
 *
 * This does not animate the number. Counting up to a new value is `AnimatedNumber`'s job,
 * that component is dead, and it was arguably wrong: on a page that repaints every second a
 * number that is always counting is a number nobody can read. What happens here is a brief
 * tint on the figure, so the eye is drawn to the one that moved without the value becoming
 * unreadable while it moves.
 */

export interface ChangeSignalOptions {
  /** Ignore a change smaller than this fraction of the previous value. Default 0.02. */
  relative?: number;
  /** Ignore a change smaller than this, in the figure's own units. Default 0. */
  absolute?: number;
  /**
   * Minimum gap between two pulses, in ms.
   *
   * Not decoration. A figure that is climbing steadily crosses the relative threshold every
   * couple of seconds, and without a floor the tint comes back before the eye has finished
   * dismissing it -- which reads as something wrong with the page rather than with the data.
   */
  cooldown?: number;
  /**
   * Whether to watch at all.
   *
   * A tile whose value is a formatted string, or a node like the pricing dialog, has no
   * number to compare, and a hook cannot be called conditionally -- so it is always called
   * and this decides whether it does anything. Off by default: a pulse the caller did not ask
   * for is a flash nobody can account for.
   */
  enabled?: boolean;
}

const DEFAULTS = { relative: 0.02, absolute: 0, cooldown: 30_000 };

/**
 * Is this difference big enough to be worth interrupting someone for?
 *
 * Pure and exported so the threshold is testable on its own. The rules, in order:
 *
 * - A first observation is never a change. There is nothing to compare against, and treating
 *   the initial value as a jump would fire a pulse on every page that mounts.
 * - A move to zero from a real figure is always material: the data stopped, which is the
 *   single most important thing this signal can report.
 * - A rise from zero is judged on the absolute floor only. Dividing by zero, or treating the
 *   first value as an infinite increase, are both ways to make a starting number look like
 *   an event.
 * - Signs crossing over zero always count, in either direction.
 */
export function isMaterialChange(
  previous: number | null,
  next: number,
  { relative, absolute }: { relative: number; absolute: number },
): boolean {
  if (previous == null) return false;
  if (!Number.isFinite(next) || !Number.isFinite(previous)) return false;
  if (next === previous) return false;

  if (previous === 0) return Math.abs(next) > absolute;
  if (next === 0) return Math.abs(previous) > absolute;

  // Crossing zero is a change of sign, not a change of size, so the relative test does not
  // describe it: -0.5 -> 0.5 is +200% by ratio and looks enormous, but 5 -> -5 also reads as
  // +200% and is just a number going negative.
  if (Math.sign(previous) !== Math.sign(next)) return true;

  return Math.abs(next - previous) > Math.max(Math.abs(previous) * relative, absolute);
}

/**
 * Returns a counter that increments once per material change.
 *
 * The counter rather than a boolean is deliberate: a boolean that goes true and back to
 * false cannot retrigger without a key change, and the thing that actually needs to happen
 * is "play a one-shot animation", which is naturally a new instance each time.
 */
export function useChangePulse(value: number, options: ChangeSignalOptions = {}): number {
  const { relative, absolute, cooldown, enabled = true } = { ...DEFAULTS, ...options };
  const previous = useRef<number | null>(null);
  const lastPulse = useRef(0);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    // The first observation establishes the baseline and never pulses. On a value that is
    // legitimately zero from the start, later rises are judged on the absolute floor.
    if (previous.current === null) {
      previous.current = value;
      return;
    }
    const was = previous.current;
    previous.current = value;
    if (!enabled) return;
    if (!isMaterialChange(was, value, { relative, absolute })) return;
    const now = Date.now();
    if (now - lastPulse.current < cooldown) return;
    lastPulse.current = now;
    setPulse((id) => id + 1);
  }, [value, relative, absolute, cooldown, enabled]);

  return pulse;
}
