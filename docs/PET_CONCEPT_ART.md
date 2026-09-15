# Pet concept artwork

## Source and scope

The visual references are `01_concepts/*_concept.png` in
`docs/quotapulse_pet_mode_v2_starter_asset_pack.zip`. Waves 2/3 carry this
starter pack as a nested dependency. Wave 4 includes a separate bonus character
board. At the user's explicit request, Nova, Byte, Mochi and Kuro now join the
runtime roster as selectable Beta companions, overriding Wave 4's preview-only
restriction. Beta describes this concept-pose delivery; it is not a claim that
the original animation promotion/soak criteria have all been completed.

The previous runtime used the older PulsePet Orbit Bot assets and SVG placeholders
for the other three characters. The desktop, quota popup and gallery now share
the five concept-derived raster poses for all eight characters. Unknown data
uses a grayscale healthy pose. The gallery displays actual character and state previews.

## Delivered assets

- `packages/tray/assets/pets/orbit-bot/concept-states.png`
- `packages/tray/assets/pets/pulse-fox/concept-states.png`
- `packages/tray/assets/pets/flux-blob/concept-states.png`
- `packages/tray/assets/pets/capsule-cat/concept-states.png`
- `packages/tray/assets/pets/nova/concept-states.png`
- `packages/tray/assets/pets/byte/concept-states.png`
- `packages/tray/assets/pets/mochi/concept-states.png`
- `packages/tray/assets/pets/kuro/concept-states.png`

Bonus references: `07_bonus_incubation/assets/bonus_character_direction_board.png`
in `docs/quotapulse_pet_mode_v2_wave4_pack.zip`. Each bonus has a validated manifest,
the shared settings/placement/motion path, and the existing accessory skins.
Bonus manifests declare a static concept sheet; the presentation layer selects
the pose viewport. The generic cat SVG is a last-resort fallback for missing art.

## Companion Studio and popup

The gallery now has original/bonus collections, a large character stage, personality
details, five mood previews, skin choices, movement options and keyboard-accessible
switches. Placement and notification options are grouped in expandable sections.
The layout adapts from the 1080px desktop window to the 560px compact check.
Previewing a mood does not change the live pet's quota state; selecting a character
does persist the character. Compatible skins refresh after character changes.

The popup and speech bubble use navy surfaces, cyan accents, soft borders and
the same artwork. The popup retains localized labels, actual quota readings and
its existing actions. The studio remains English, as the previous gallery was.

These PNGs were produced with the built-in image generation/editing tool using
the original boards as edit targets. They are AI-derived cutouts, not pixel-identical
extractions. Keep the reference boards as the visual acceptance standard.

Each sheet has healthy, working, warning, critical and reset in that order.
`packages/tray/src/pet/concept-art.ts` describes the unequal pose windows in a
normalized coordinate system. An SVG viewport displays the PNG; it does not
redraw the mascot. Sheets are copied into the runtime package. Desktop/gallery
load local URLs; the HTTP popup receives embedded artwork cached in the main process.
If a sheet is missing, the previous renderer remains available as fallback.

## Limits of this delivery

- These are static mood poses with the existing whole-body CSS reactions. They
  are not a complete production animation set for the later waves.
- The raster poses have no independently rigged eyes, ears, mouth or tail.
  Those former SVG-part animations do not animate the raster artwork. Walking
  still moves/bobs the body; authored walk/turn/sleep clips remain outstanding.
- Quota rings in the illustration communicate the drawn mood, not a live numeric
  percentage. The bubble/popup retains the actual quota reading.
- Fine cutout edges, the fox reset tail at the sheet edge and pose proportions
  need art review against the originals before claiming exact visual acceptance.
- Native Electron lifecycle, desktop click-through and multi-monitor behavior
  were not exercised by the headless browser check.

## Verification

```powershell
npm run build -w @quotapulse/tray
npm run test -w @quotapulse/tray
node scripts/check-pet-art.mjs
npm run build -w @quotapulse/web
node scripts/check-pet-popup.mjs
```

The tray tests also run the existing packaging checks. The browser check verifies
the packaged sheets, PNG alpha format, 48 character/state combinations, local asset
loading, reduced motion, stable image nodes on repeated frames, unknown-state
recovery, all bonus selections, skin preferences and gallery keyboard controls.
The popup check covers the built app at 380×520 in English/Thai using local
fixtures and a mock Electron bridge. It writes screenshots under
`screens/pet-concept/` (ignored by Git). No daemon or accounts are needed.

## Final prompts used with the built-in tool

### Orbit Bot

Use case: background-extraction. Edit target: supplied Orbit Bot concept board. Extract the FIVE SMALL robot poses from the bottom row into a transparent PNG sprite sheet. Keep exact robot design, metallic materials, face, pose and colors from each reference pose. One horizontal row ordered healthy, working with laptop, amber warning, red critical, teal reset waving with sparkles. Remove board background, cards, labels and floor entirely. Real alpha transparency. All five entire characters must fit with clear EMPTY transparent gutters between them and generous outside margins (no clipped edges). Consistent ground baseline, same robot scale. No text or annotations. Do not simplify or redesign. Save local PNG.

### Pulse Fox (selected revision)

Use case: background-extraction. Edit supplied Pulse Fox board. Extract FIVE SMALL bottom-row poses into one horizontal transparent PNG sprite sheet: healthy, working with laptop, amber worried warning, drooped red critical, teal joyful reset. Preserve the original fox design exactly, its blue fur, face, tail and posture. CRITICAL LAYOUT: leave a wide transparent gutter between EVERY fox, at least 5% canvas width between characters, AND outside margins. Scale characters down to ensure all five fit with large empty gaps. Each entire tail and laptop visible without touching neighboring character. No overlap, no clipping at edges. Use common ground baseline. Remove all background, labels, board elements and floor. True alpha transparent background. Do not redesign or simplify.

### Flux Blob

Use case: background-extraction. Edit target: supplied Flux Blob concept board. Extract the FIVE SMALL blob poses from the bottom row into a transparent PNG sprite sheet. Preserve exactly their glossy translucent blue fluid body, black face, embedded quota ring, floating bubbles, expressions, shape and pose. One horizontal row ordered healthy cyan smile, working blue bubbles, amber worried warning, red critical angry face, teal reset closed eyes with orbit trail and sparkles. Remove board background, panels, labels and floor entirely. Real alpha transparency. All five whole characters must fit with clear EMPTY transparent gutters between them and generous outside margins, no clipping. Consistent baseline and body scale. No text or annotations. Do not simplify or redesign. Save local PNG.

### Capsule Cat

Use case: background-extraction. Edit target: Capsule Cat reference board. Extract its FIVE SMALL state poses into one horizontal transparent PNG sprite sheet: healthy from upper left, working with laptop from middle left, amber concerned warning from upper right, red urgent critical from middle right, teal reset holding refresh orb from lower right. Preserve the exact original silver capsule shaped cat robot, glossy black screen face, tiny feet, segmented tail, LED ears, proportions, pose and materials. NOT the large hero center cat. Remove background panels, typography, floor and all annotations. Real alpha transparency. Five whole poses separated by EMPTY transparent gutters, generous transparent outside margins, no clipping, same physical character scale and aligned ground baseline. No text or labels. No redesign or simplification. Save local PNG.

## Bonus prompts used with the built-in tool

### Nova

Use case: background-extraction. Edit target: supplied QuotaPulse bonus character board. Extract NOVA ONLY, the white kitten-like companion with cyan headphones and white face, from its animation row. Produce transparent PNG sprite sheet in ONE horizontal row with FIVE whole-body poses ordered healthy/idle, working at laptop, warning worried with amber exclamation, critical concerned with red warning, reset/celebrate with cyan and gold sparkles. Use Nova's actual reference poses from the board; keep the exact white cat hood, small cyan accents, soft chibi face, headphones, paws, tail and proportions. No Orbit Bot, no Capsule Cat, no other characters. Remove all labels, panels, floor and background. Genuine alpha transparency. Clear empty gutters between poses, entire tails and laptops visible, no overlap or clipping. Same character scale and ground baseline. Do not redesign. Save PNG.

### Byte

Use case: background-extraction. Edit target: supplied bonus character board. Extract BYTE ONLY, the dark navy/black kitten companion with cyan headphones and cyan screen face. Make transparent PNG sprite sheet with FIVE poses in ONE horizontal row: healthy/idle, working at laptop, warning with amber exclamation, critical with red alarm, reset/celebrate with teal sparkles. Follow Byte's actual row of reference poses and its large top hero: black cat hood, cyan eyes, little cyan paws and tail, hoodie-like chibi body. Preserve exact face and materials, distinct from Nova, Mochi and Kuro. No white face. Remove board, labels, panels, floor. True alpha transparency. All poses fully visible with clear transparent gutters; identical scale and ground baseline. No clipping or overlapping, no redesign.

### Mochi

Use case: background-extraction. Edit supplied bonus character board. Extract MOCHI ONLY, cream and warm amber kitten companion with orange headphones, brown eyes and gentle white face. Make a transparent PNG sprite sheet, FIVE whole-body poses in ONE horizontal row: healthy idle, working at laptop, worried warning with amber exclamation, critical with red warning, joyful reset with golden sparkles. Match Mochi's actual reference row and top hero: cream cat hood, orange markings, round cheeks, tiny paws, cream/orange tail, soft chibi proportions. Keep exact identity and illustration style. Remove labels, panels, background and floor. True alpha. Empty gutters between all poses, common baseline and scale, entire silhouette visible, no overlaps or clipping. No redesign.

### Kuro

Use case: background-extraction. Edit supplied bonus character board. Extract KURO ONLY, dark charcoal kitten companion with deep red headphones, red eyes and black face. Produce transparent PNG sprite sheet in ONE horizontal row with FIVE poses: healthy idle with calm half-lidded red eyes, working at laptop, warning alert with amber exclamation, critical urgent with red alarm, reset cheerful with red and teal sparkles. Match Kuro's reference row and large top hero exactly: black cat hood with red ear interiors, dark hoodie body, tiny paws, segmented black/red tail, dramatic guardian personality. Keep chibi shape and rendering, distinct from Byte. Remove all board, labels, background panels and floor. Genuine alpha transparency. Whole silhouettes with transparent gutters, no clipping/overlap, consistent scale and baseline. Do not redesign.
