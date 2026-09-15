import type { PetCharacterId, PetMood } from '../presence/types.js';

/** Display windows in the authored sheets, normalized to a 2048 × 683 canvas.
 * Gutters are deliberately excluded: poses do not occupy equal-width cells.
 * Keep a common scale and ground line per character, including the crouching fox.
 */
export const CONCEPT_LAYOUTS: Record<PetCharacterId, { edges: number[]; top: number; height: number }> = {
  orbit_bot: { edges: [0, 425, 830, 1215, 1620, 2048], top: 120, height: 450 },
  pulse_fox: { edges: [0, 370, 835, 1195, 1635, 2048], top: 150, height: 405 },
  flux_blob: { edges: [0, 415, 835, 1225, 1615, 2048], top: 150, height: 380 },
  capsule_cat: { edges: [0, 410, 850, 1230, 1600, 2048], top: 150, height: 405 },
  nova: { edges: [0, 410, 805, 1210, 1630, 2048], top: 145, height: 420 },
  byte: { edges: [0, 415, 800, 1215, 1630, 2048], top: 135, height: 425 },
  mochi: { edges: [0, 425, 825, 1220, 1610, 2048], top: 185, height: 400 },
  kuro: { edges: [0, 415, 805, 1200, 1650, 2048], top: 150, height: 420 },
};

const POSE: Record<PetMood, number> = {
  healthy: 0, working: 1, warning: 2, critical: 3, reset: 4, unknown: 0,
};

export function conceptAssetPath(character: PetCharacterId): string {
  return `pets/${character.replace(/_/g, '-')}/concept-states.png`;
}

/** SVG is only a viewport over the raster artwork, never a redrawn mascot.
 * The caller supplies a local asset URL or embedded data URL for the web popup.
 */
export function renderConceptPet(character: PetCharacterId, mood: PetMood, href: string): string {
  const { edges, top, height } = CONCEPT_LAYOUTS[character];
  const index = POSE[mood];
  const x = edges[index]!;
  const width = edges[index + 1]! - x;
  const canvas = 480;
  const neutral = mood === 'unknown';
  const safeHref = href.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 ${canvas} ${canvas}" data-concept-pose="${mood}"><g class="qp-sprite"${neutral ? ' style="filter:grayscale(1)"' : ''}><svg x="${(canvas - width) / 2}" y="${canvas - height - 24}" width="${width}" height="${height}" viewBox="${x} ${top} ${width} ${height}" overflow="hidden"><image href="${safeHref}" width="2048" height="683" preserveAspectRatio="none"/></svg></g></svg>`;
}
