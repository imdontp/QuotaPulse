/**
 * Wave 4 local runtime diagnostics (LOCAL_RUNTIME_DIAGNOSTICS_SPEC.md).
 *
 * In-memory counters only: nothing is persisted, nothing leaves the machine, no
 * conversation or prompt content is recorded. They exist to expose restart
 * storms, broken fallback chains, and notification noise in an optional debug
 * panel — never as part of the normal pet UI.
 */

export interface PetHealthCounters {
  animationSwitches: number;
  fallbackCount: number;
  decodeFailures: number;
  bubbleScenesShown: number;
  notificationDedupes: number;
  roamingMoves: number;
  movementCancellations: number;
  monitorRecoveries: number;
  rendererRestarts: number;
}

export interface PetRuntimeHealth extends PetHealthCounters {
  characterId: string | null;
  skinId: string | null;
  animationId: string | null;
  /** Cached animation Switches/min, sampled by the caller once per minute. */
  switchesPerMinute: number;
}

/**
 * Crash-loop rule (CRASH_RECOVERY_SPEC.md §6): three or more renderer crashes
 * inside ten minutes. Pure so persistence tests can drive it.
 */
export function isCrashLoop(recentCrashTimestamps: number[], now: number = Date.now()): boolean {
  return recentCrashTimestamps.filter((t) => now - t <= 600_000).length >= 3;
}

export class PetDiagnostics {
  private counters: PetHealthCounters = {
    animationSwitches: 0,
    fallbackCount: 0,
    decodeFailures: 0,
    bubbleScenesShown: 0,
    notificationDedupes: 0,
    roamingMoves: 0,
    movementCancellations: 0,
    monitorRecoveries: 0,
    rendererRestarts: 0,
  };

  private switchWindow: number[] = [];
  private lastSwitchAt = 0;
  private lastObservedNow = 0;
  private lastAnimationId: string | null = null;

  count<K extends keyof PetHealthCounters>(key: K, by = 1): void {
    if (by <= 0) return;
    this.counters[key] += by;
  }

  /**
   * Track the animation currently driving the renderer; counts a switch only when
   * the id actually changed (ACCEPTANCE_TEST_MATRIX E: no restarts on equal state).
   */
  observeAnimation(animationId: string | null, now = Date.now()): void {
    this.lastObservedNow = now;
    // Only an id change after a prior observation counts as a restart; the very
    // first observation is a baseline, not a storm event.
    if (animationId && this.lastAnimationId !== null && animationId !== this.lastAnimationId) {
      this.counters.animationSwitches++;
      this.switchWindow.push(now);
      this.switchWindow = this.switchWindow.filter((t) => now - t <= 60_000);
      this.lastSwitchAt = now;
    }
    if (animationId !== null) this.lastAnimationId = animationId;
  }

  snapshot(characterId: string | null = null, skinId: string | null = null): PetRuntimeHealth {
    // prefers the caller's clock feed, so tests can drive the window
    // deterministically; production feeds a wall clock.
    const now = this.lastObservedNow || Date.now();
    const switchesPerMinute = this.switchWindow.filter((t) => now - t <= 60_000).length;
    return {
      ...this.counters,
      switchesPerMinute,
      characterId,
      skinId,
      animationId: this.lastAnimationId,
      /** `lastSwitchAt` is internal; expose nothing extra to keep the shape stable. */
    };
  }

  /** Coarse health verdict for a debug panel; terse and human-readable. */
  verdict(): string {
    const s = this.snapshot();
    const flags: string[] = [];
    if (s.switchesPerMinute > 90) flags.push('animation restart storm');
    if (s.fallbackCount > 20) flags.push('heavy fallback use');
    if (s.decodeFailures > 0) flags.push('asset decode failures');
    if (s.rendererRestarts > 3) flags.push('renderer restart loop');
    if (s.movementCancellations > s.roamingMoves) flags.push('roaming churn');
    return flags.length ? flags.join('; ') : 'ok';
  }

  get lastSwitch(): number {
    return this.lastSwitchAt;
  }
}
