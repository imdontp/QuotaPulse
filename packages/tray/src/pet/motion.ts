import type { PetMood, Severity } from '../presence/types.js';

/**
 * Presentation constants for the Pet (docs/PET_MODE_V2_SPEC.md §27–§34).
 *
 * Colour and sprite values live here so the frame the renderer receives is fully resolved;
 * the CSS in pet.html only owns the motion curves, exactly as the tray icon owns its own
 * palette (see the note in icon.ts about mirroring the dashboard tokens by hand).
 */

/** Sprite order in `pulsepet_states_sprite.png`, left to right. */
export const SPRITE_INDEX: Record<PetMood, number> = {
  healthy: 0,
  working: 1,
  warning: 2,
  critical: 3,
  reset: 4,
};

/** Mirrors --ok / --brand / --warn / --crit from packages/web/src/index.css. */
export const MOOD_COLORS: Record<PetMood, string> = {
  healthy: '#22d3a7',
  working: '#00e5ff',
  warning: '#ffb020',
  critical: '#ff4d4f',
  reset: '#22d3a7',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  ok: '#22d3a7',
  warn: '#ffb020',
  crit: '#ff4d4f',
  unknown: '#8a939e',
};

/**
 * Desktop-motion speed per mood, CSS px per second. Critical is slow and working is fast
 * because speed itself carries the state (§31), not because faster looks better.
 */
export const moodSpeed = (mood: PetMood): number =>
  mood === 'working' ? 90 : mood === 'warning' ? 55 : mood === 'critical' ? 22 : mood === 'healthy' ? 36 : 0;
