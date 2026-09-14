import type { PetCharacterId, PetMood } from '../presence/types.js';

/**
 * Selectable Pet Mode mascots.
 *
 * One shared state engine, four interchangeable renderers. Identity/anchors/motion style
 * mirror the character manifests in `assets/pets/<id>/manifest.json`, so adding a mascot
 * never touches focus, mood, events or the tray.
 *
 * The Wave 1 production clips (animated WebP, WAVE1_PRODUCTION_ASSET_BIBLE.md) are the
 * asset agent's deliverable and are not in the tree yet. Until they land, every character
 * renders through this inline-SVG placeholder — the same vector path the original
 * PulsePet spec recommended — driven by the resolved `PetAnimationId`. When a real `src`
 * exists the renderer prefers the raster clip; this vector renderer is the safe fallback
 * the manifests point at (`fallback: healthy_static`).
 *
 * The SVG emits stable part classes (`qp-sprite`, `qp-head`, `qp-eye`, `qp-look`,
 * `qp-mouth`, `qp-tail`, `qp-ear`, `qp-antenna`, `qp-leg`, `qp-live`, `qp-ring`) so the
 * renderer's expression layer can animate parts without re-resolving the frame.
 */

export interface PetCharacterDef {
  id: PetCharacterId;
  name: string;
  motionStyle: string;
  anchors: readonly string[];
  /** `raster` prefers a shipped asset set; `vector` is the inline SVG placeholder. */
  art: 'raster' | 'vector';
}

export const PET_CHARACTERS: readonly PetCharacterDef[] = [
  {
    id: 'orbit_bot',
    name: 'Orbit Bot',
    motionStyle: 'soft_mechanical',
    anchors: ['chest_quota_ring', 'usage_bars', 'antenna_live_dot', 'screen_face'],
    art: 'raster',
  },
  {
    id: 'pulse_fox',
    name: 'Pulse Fox',
    motionStyle: 'organic_expressive',
    anchors: ['collar_quota_ring', 'tail_usage_ring', 'collar_live_dot'],
    art: 'vector',
  },
  {
    id: 'flux_blob',
    name: 'Flux Blob',
    motionStyle: 'float_squash_stretch',
    anchors: ['embedded_quota_ring', 'usage_bars', 'live_orb', 'fluid_body'],
    art: 'vector',
  },
  {
    id: 'capsule_cat',
    name: 'Capsule Cat',
    motionStyle: 'robotic_cat',
    anchors: ['chest_quota_ring', 'screen_face', 'led_ears', 'smart_tail', 'live_dot'],
    art: 'vector',
  },
];

const BY_ID = new Map<PetCharacterId, PetCharacterDef>(PET_CHARACTERS.map((c) => [c.id, c]));

export function isPetCharacter(value: unknown): value is PetCharacterId {
  if (typeof value !== 'string') return false;
  if (BY_ID.has(value as PetCharacterId)) return true;
  // Pre-Wave-1 files stored hyphenated ids; accept them so settings never silently reset.
  const migrated = value.replace(/-/g, '_');
  return BY_ID.has(migrated as PetCharacterId);
}

/** Coerce any stored value (including the old hyphen form) to a valid character id. */
export function coercePetCharacter(value: unknown): PetCharacterId | null {
  if (typeof value !== 'string') return null;
  const migrated = value.replace(/-/g, '_') as PetCharacterId;
  return BY_ID.has(migrated) ? migrated : null;
}

export function petCharacter(id: PetCharacterId): PetCharacterDef {
  return BY_ID.get(id) ?? BY_ID.get('orbit_bot')!;
}

export function petCharacterName(id: PetCharacterId): string {
  return petCharacter(id).name;
}

/**
 * True when the character has no shipped raster clip and must be drawn by this renderer.
 * With Wave 1 assets absent this is the placeholder path for every character.
 */
export function isVectorCharacter(id: PetCharacterId): boolean {
  return petCharacter(id).art === 'vector';
}

/* ------------------------------------------------------------------ SVG renderer */

export interface PetSvgOptions {
  /** Mood/accent colour, resolved from the frame (`MOOD_COLORS`). */
  color: string;
  /** Focused provider's worst live window, for the quota ring; null draws an empty ring. */
  percent: number | null;
}

const INK = '#0b0f14';
const BODY = '#eef3f8';
const BODY_SHADE = '#d3dce6';
const BODY_EDGE = '#26313d';
const TRACK = '#2a3543';

const round = (n: number): string => (Math.round(n * 100) / 100).toString();

/** The contact shadow every mascot shares so the pivot point reads as stable. */
const shadow = (): string => `<ellipse cx="32" cy="60.5" rx="15" ry="3.2" fill="rgba(0,0,0,0.28)"/>`;

/** A quota ring: a dim track plus a mood-coloured arc that follows the used percentage. */
function quotaRing(cx: number, cy: number, r: number, percent: number | null, color: string, width = 3): string {
  const track = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${TRACK}" stroke-width="${width}"/>`;
  if (percent == null) return `<g class="qp-ring">${track}</g>`;
  const frac = Math.min(1, Math.max(0, percent / 100));
  const circumference = 2 * Math.PI * r;
  if (frac <= 0) return `<g class="qp-ring">${track}</g>`;
  const len = round(circumference * frac);
  const gap = round(circumference - circumference * frac);
  return (
    `<g class="qp-ring">` +
    track +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${width}" ` +
    `stroke-linecap="round" stroke-dasharray="${len} ${gap}" transform="rotate(-90 ${cx} ${cy})"/>` +
    `</g>`
  );
}

/** One eye at (x, y); the mood changes its shape, the accent supplies its colour. */
function eye(mood: PetMood, x: number, y: number, color: string): string {
  switch (mood) {
    case 'critical':
      // Spent, crossed eyes; the spec asks for tired/urgent, not a permanent alarm.
      return (
        `<path d="M${x - 3} ${y - 3}L${x + 3} ${y + 3}M${x + 3} ${y - 3}L${x - 3} ${y + 3}" ` +
        `stroke="${color}" stroke-width="2" stroke-linecap="round" fill="none"/>`
      );
    case 'reset':
      // Closed, happy arcs.
      return `<path d="M${x - 3.2} ${y + 1}Q${x} ${y - 4.2} ${x + 3.2} ${y + 1}" stroke="${color}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
    case 'working':
      // Focused, narrowed eyes.
      return `<rect x="${x - 2.4}" y="${y - 3.4}" width="4.8" height="6.8" rx="2.2" fill="${color}"/>`;
    case 'warning':
      // Round eyes with a worried brow.
      return (
        `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>` +
        `<path d="M${x - 3.4} ${y - 4.8}L${x + 3.4} ${y - 3.2}" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`
      );
    case 'unknown':
      // Blank, low-contrast eyes; the state is "no data", not sleepy.
      return (
        `<circle cx="${x}" cy="${y}" r="3" fill="none" stroke="${color}" stroke-width="1.6"/>` +
        `<path d="M${x - 3.4} ${y - 4.6}L${x + 3.4} ${y - 4.6}" stroke="${color}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>`
      );
    default:
      return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
  }
}

/** Look (outer group) wraps blink (inner group) so the two transforms never fight. */
function eyeGroup(mood: PetMood, x: number, y: number, color: string): string {
  return `<g class="qp-look"><g class="qp-eye">${eye(mood, x, y, color)}</g></g>`;
}

/** One mouth at (x, y). `stroke` is the line colour, `fill` the open-mouth colour. */
function mouth(mood: PetMood, x: number, y: number, stroke: string, fill: string): string {
  const inner = (() => {
    switch (mood) {
      case 'critical':
        return `<ellipse cx="${x}" cy="${y + 1}" rx="2.4" ry="3" fill="${fill}"/>`;
      case 'warning':
        return `<path d="M${x - 3} ${y + 1.6}Q${x} ${y - 1.4} ${x + 3} ${y + 1.6}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
      case 'working':
        return `<path d="M${x - 2} ${y}L${x + 2} ${y}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round"/>`;
      case 'reset':
        return `<path d="M${x - 3.4} ${y}Q${x} ${y + 4} ${x + 3.4} ${y}Z" fill="${fill}"/>`;
      case 'unknown':
        return `<path d="M${x - 3} ${y + 0.5}L${x + 3} ${y + 0.5}" stroke="${stroke}" stroke-width="1.6" stroke-linecap="round" opacity="0.7"/>`;
      default:
        return `<path d="M${x - 3} ${y - 0.5}Q${x} ${y + 2.6} ${x + 3} ${y - 0.5}" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`;
    }
  })();
  return `<g class="qp-mouth">${inner}</g>`;
}

/** Dark visor face used by the screen-face mascots (Orbit Bot, Capsule Cat). */
function screenFace(mood: PetMood, x: number, y: number, w: number, h: number, color: string): string {
  const cx = x + w / 2;
  const cy = y + h / 2;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${round(h / 2)}" fill="${INK}"/>` +
    eyeGroup(mood, cx - 5, cy - 0.5, color) +
    eyeGroup(mood, cx + 5, cy - 0.5, color) +
    mouth(mood, cx, cy + 3.4, color, color)
  );
}

function orbitBot(mood: PetMood, color: string, percent: number | null): string {
  return (
    shadow() +
    `<g class="qp-sprite">` +
    `<g class="qp-head">` +
    `<g class="qp-antenna">` +
    `<path d="M32 16V9" stroke="${BODY_EDGE}" stroke-width="2" stroke-linecap="round"/>` +
    `<circle class="qp-live" cx="32" cy="7" r="3.2" fill="${color}"/>` +
    `<circle cx="32" cy="7" r="5.4" fill="none" stroke="${color}" stroke-width="1" opacity="0.35"/>` +
    `</g>` +
    `<rect x="17" y="13" width="30" height="19" rx="9" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    screenFace(mood, 22, 17, 20, 11, color) +
    `</g>` +
    `<g class="qp-body">` +
    `<rect x="19" y="31" width="26" height="22" rx="10" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    quotaRing(32, 41, 6.2, percent, color) +
    `<rect x="12.5" y="33" width="6.5" height="13" rx="3.2" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<rect x="45" y="33" width="6.5" height="13" rx="3.2" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `</g>` +
    `<rect class="qp-leg qp-leg-l" x="23" y="50" width="8" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<rect class="qp-leg qp-leg-r" x="33" y="50" width="8" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `</g>`
  );
}

function capsuleCat(mood: PetMood, color: string, percent: number | null): string {
  return (
    shadow() +
    `<g class="qp-sprite">` +
    // Segmented tail with an LED tip; the tail is the cat's second status surface.
    `<g class="qp-tail">` +
    `<path d="M45 47C54 47 57 40 54 34" stroke="${BODY_SHADE}" stroke-width="4" stroke-linecap="round" fill="none"/>` +
    `<circle class="qp-live" cx="54" cy="33" r="2.6" fill="${color}"/>` +
    `</g>` +
    `<g class="qp-body">` +
    `<rect x="19" y="31" width="26" height="22" rx="10" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    quotaRing(32, 41, 6.2, percent, color) +
    `</g>` +
    `<rect class="qp-leg qp-leg-l" x="23" y="50" width="8" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<rect class="qp-leg qp-leg-r" x="33" y="50" width="8" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<g class="qp-head">` +
    // LED ears.
    `<g class="qp-ear">` +
    `<path d="M21 14L18 6L28 11Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.5"/>` +
    `<path d="M21.5 12.5L20 8.4L25 11Z" fill="${color}"/>` +
    `</g>` +
    `<g class="qp-ear">` +
    `<path d="M43 14L46 6L36 11Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.5"/>` +
    `<path d="M42.5 12.5L44 8.4L39 11Z" fill="${color}"/>` +
    `</g>` +
    `<rect x="17" y="12" width="30" height="20" rx="9" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    screenFace(mood, 22, 16.5, 20, 11, color) +
    // Whiskers.
    `<path d="M15 24H21M15 28H21M43 24H49M43 28H49" stroke="${BODY_EDGE}" stroke-width="1" opacity="0.6" stroke-linecap="round"/>` +
    `</g>` +
    `</g>`
  );
}

function pulseFox(mood: PetMood, color: string, percent: number | null): string {
  return (
    shadow() +
    `<g class="qp-sprite">` +
    // Tail with the usage ring wrapped around it.
    `<g class="qp-tail">` +
    `<path d="M42 46C56 47 59 31 49 26C55 34 50 42 41 41Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.5"/>` +
    `<path d="M47 29C50 33 49 37 46 40" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `</g>` +
    `<g class="qp-body">` +
    `<ellipse cx="29" cy="43" rx="13.5" ry="12.5" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    // Collar ring with the live dot.
    `<g class="qp-ring">` +
    `<path d="M19 32.5Q29 37 39 32.5" stroke="${color}" stroke-width="3" stroke-linecap="round" fill="none"/>` +
    `</g>` +
    `<circle class="qp-live" cx="39" cy="32.5" r="2" fill="${color}"/>` +
    `</g>` +
    `<rect class="qp-leg qp-leg-l" x="20" y="52" width="7" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<rect class="qp-leg qp-leg-r" x="32" y="52" width="7" height="7" rx="3" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<g class="qp-head">` +
    // Ears and snout.
    `<g class="qp-ear">` +
    `<path d="M19 21L15 8L28 15Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.5"/>` +
    `<path d="M19.5 18.5L17.5 12L23.5 15.5Z" fill="${color}" opacity="0.55"/>` +
    `</g>` +
    `<g class="qp-ear">` +
    `<path d="M39 21L43 8L30 15Z" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.5"/>` +
    `<path d="M38.5 18.5L40.5 12L34.5 15.5Z" fill="${color}" opacity="0.55"/>` +
    `</g>` +
    `<circle cx="29" cy="26" r="12.5" fill="${BODY}" stroke="${BODY_EDGE}" stroke-width="1.6"/>` +
    `<path d="M23 31Q29 38 35 31Z" fill="${BODY_SHADE}" stroke="${BODY_EDGE}" stroke-width="1.3"/>` +
    `<circle cx="29" cy="33.5" r="1.8" fill="${INK}"/>` +
    eyeGroup(mood, 24.5, 25, color) +
    eyeGroup(mood, 33.5, 25, color) +
    mouth(mood, 29, 37, INK, INK) +
    `</g>` +
    `</g>`
  );
}

function fluxBlob(mood: PetMood, color: string, percent: number | null): string {
  const squash = mood === 'critical' ? 'scale(0.94 1.04)' : '';
  return (
    `<defs>` +
    `<radialGradient id="qpBlob" cx="38%" cy="30%" r="75%">` +
    `<stop offset="0%" stop-color="#bfe9ff" stop-opacity="0.95"/>` +
    `<stop offset="60%" stop-color="#4fb8e8" stop-opacity="0.85"/>` +
    `<stop offset="100%" stop-color="#1f6fa8" stop-opacity="0.9"/>` +
    `</radialGradient>` +
    `</defs>` +
    shadow() +
    `<g class="qp-sprite">` +
    `<g class="qp-body" transform="${squash}">` +
    `<path d="M32 8C46 8 55 18 53 32C51 45 44 54 32 54C20 54 13 45 11 32C9 18 18 8 32 8Z" ` +
    `fill="url(#qpBlob)" stroke="${color}" stroke-width="1.4" opacity="0.96"/>` +
    `<ellipse cx="24" cy="19" rx="6" ry="4" fill="#ffffff" opacity="0.38"/>` +
    quotaRing(32, 38, 7, percent, '#ffffff', 3.2) +
    eyeGroup(mood, 27, 26, INK) +
    eyeGroup(mood, 37, 26, INK) +
    mouth(mood, 32, 31, INK, INK) +
    `</g>` +
    // Orbiting live orb.
    `<g class="qp-live">` +
    `<circle cx="49" cy="15" r="4.2" fill="${color}"/>` +
    `<circle cx="49" cy="15" r="6.4" fill="none" stroke="${color}" stroke-width="1" opacity="0.35"/>` +
    `</g>` +
    `<circle cx="14" cy="20" r="1.8" fill="${color}" opacity="0.8"/>` +
    `<circle cx="52" cy="34" r="1.5" fill="${color}" opacity="0.65"/>` +
    `</g>`
  );
}

const RENDERERS: Record<Exclude<PetCharacterId, 'orbit_bot'>, (m: PetMood, c: string, p: number | null) => string> = {
  pulse_fox: pulseFox,
  flux_blob: fluxBlob,
  capsule_cat: capsuleCat,
};

/**
 * The inline SVG placeholder for one mascot in one mood. The renderer uses this whenever
 * the selected character has no shipped raster clip for the resolved animation.
 */
export function renderPetSvg(id: PetCharacterId, mood: PetMood, options: PetSvgOptions): string {
  const percent = options.percent ?? null;
  const color = options.color;
  const draw = id === 'orbit_bot' ? orbitBot : RENDERERS[id];
  const body = draw(mood, color, percent);
  return (
    `<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true" ` +
    `data-character="${id}" data-mood="${mood}">${body}</svg>`
  );
}
