import type { Overview } from '../api';
import { isExpired, severityOf } from '../format';
import { quotaSummaries, type Readiness } from './quota-summary';

/**
 * The mood of the whole dashboard, derived from the data rather than chosen.
 *
 * ## Why this exists
 *
 * Every expressive visual in this app was mounted by `pulse-hero.tsx` alone. The other ten
 * surfaces got a flat `--card` on a two-gradient shell, which is correct and completely
 * forgettable -- and the Live page is the page a person sees for three seconds on launch and
 * then leaves. The craft was in the wrong place.
 *
 * The instinct is to put a canvas on every tab. That is the expensive, wrong answer: a
 * per-frame animation per surface, a second one on top of the aurora, and an ambient effect
 * that fights the numbers for attention on a page whose entire job is to be read. The
 * cheaper and better answer is one gradient layer whose colour and weight follow the data.
 *
 * ## The rule that matters
 *
 * This must not be able to disagree with the quota rings. If a window is 90% full, the ring
 * is red and the backdrop must not be calmly cyan. So the tone here is not a separate
 * judgement: it reuses `severityOf`, the one threshold function the rings, the gauges, the
 * badges and the tray icon all already share. If that threshold moves, the backdrop moves
 * with it, because it is the same call.
 *
 * And it is capped low. A backdrop that competes with the content is a backdrop that has
 * made the numbers harder to read, which is a worse outcome than no backdrop at all.
 */

export type AmbientTone = 'idle' | 'ok' | 'warn' | 'crit';

export interface Ambient {
  tone: AmbientTone;
  /** 0-1, never above `MAX_INTENSITY`. Drives gradient weight, not opacity of text. */
  intensity: number;
  /** The window that set the tone, for the `title` a sighted hover can read. */
  reason: string | null;
}

/**
 * A backdrop should be felt, not read. Even a dashboard in real trouble tops out here, so
 * that a full ring and a full bar are still the two highest-contrast things on the screen.
 */
export const MAX_INTENSITY = 0.55;

/**
 * A reading this old is not describing the present, so it must not colour the present.
 *
 * Six hours is where this stops being a stale picture of a busy afternoon and starts being
 * a stale picture of yesterday. Below that the number still says something true about how
 * this machine has been behaving.
 */
export const STALE_AFTER_MS = 6 * 3_600_000;

/**
 * The tone for one window, using the shared severity thresholds.
 *
 * `check` is handled first and separately, because it is the case that matters most and the
 * easiest to get wrong. It is the app's word for "I could not establish this" -- a dead feed,
 * an expired reading, a gap -- and painting the backdrop calm green when the truth is that
 * nothing could be measured is the single most dishonest thing this component could do, since
 * a calm backdrop is the one thing on screen a reader is most likely to trust without
 * checking. An unknown window gets no colour at all.
 *
 * `attention` is already a decision that something needs attention, so it never goes below
 * `warn` no matter what percentage triggered it -- a window that will exhaust before it
 * resets is a problem at 20%.
 */
function toneForReading(used: number, readiness: Readiness): AmbientTone {
  if (readiness === 'check') return 'idle';
  const bySeverity: AmbientTone = used >= 85 ? 'crit' : used >= 60 ? 'warn' : 'ok';
  if (readiness === 'attention') return bySeverity === 'crit' ? 'crit' : 'warn';
  return bySeverity;
}

const TONE_RANK: Record<AmbientTone, number> = { idle: 0, ok: 1, warn: 2, crit: 3 };

/**
 * Reduce an `Overview` to one mood.
 *
 * Pure, and therefore testable without a DOM: the rules about which reading wins and what a
 * stale number is allowed to do are the part worth pinning, and they are much easier to be
 * sure about in a unit test than by looking at a gradient.
 */
export function ambientOf(ov: Overview, hidden: string[] = []): Ambient {
  const summaries = quotaSummaries(ov, hidden).filter(s => s.status !== 'inactive');
  if (summaries.length === 0) {
    return { tone: 'idle', intensity: 0, reason: null };
  }

  let tone: AmbientTone = 'idle';
  let peak = 0;
  let reason: string | null = null;

  for (const summary of summaries) {
    for (const limit of summary.limits) {
      /*
       * A reading is only allowed to colour the present if it is still a reading: a number
       * with a percentage attached, not expired, and young enough to mean now. Everything
       * else is skipped, so a dashboard whose feeds are all dead is idle rather than calm.
       */
      if (limit.used_percent == null || isExpired(limit, ov.now)) continue;
      if (limit.ageSeconds != null && limit.ageSeconds * 1000 > STALE_AFTER_MS) continue;

      const candidate = toneForReading(limit.used_percent, summary.status);
      if (TONE_RANK[candidate] > TONE_RANK[tone]) {
        tone = candidate;
        reason = limit.subscription_display_name ?? limit.display_name ?? null;
      }
      if (limit.used_percent > peak) peak = limit.used_percent;
    }
  }

  if (tone === 'idle') return { tone, intensity: 0, reason };

  /*
   * Intensity is the peak reading, softened. A linear ramp to the cap would mean a machine
   * at 10% of one window already shows 18% of the full effect, which reads as "something is
   * happening" when nothing is. This keeps the quiet end quiet, and it uses the peak rather
   * than the mean for the same reason the Live backdrop does: one window filling up is
   * worth more than an average of many empty ones.
   */
  const shaped = 1 - Math.exp(-(peak / 100) * 2.2);
  return { tone, intensity: Math.min(MAX_INTENSITY, shaped * MAX_INTENSITY), reason };
}
