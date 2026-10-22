# Models ring compositing v1.85.119

Status: partially validated for the whole redesign. The ring correction passes the original Models four-pair gate; its ring region is exact in all eight original/native pairs. The native full-page gate remains RED at two table pixels in Thai light. No whole-design or release acceptance is claimed.

## Diagnosis and correction

The retained118 failure has161 changed pixels/max34, with155 inside its recorded ring region. The largest differences lie near radius43px, the inner disc boundary, while outer radii also vary. Layout and recorded paint inputs match. Earlier controlled layer interventions show that compositing changes the ring's raster output, but do not identify a browser-internal cache or paint defect.

A fresh unchanged118 single EN-dark run fails at88 header pixels/max3 and has an exact ring. This demonstrates that the ring symptom is not reproduced in every run; that failure is retained and is not attributed to the ring.

The production correction is one property in [models.css](../../packages/web/src/redesign/models.css): `transform:translateZ(0)` on the existing selected-model ring. It composites the layered ring independently. Dimensions, actual conic sector fractions, colors, shadows, outline, pseudo-element border and text are preserved. Recorded transform changes from none to the identity matrix; it does not move or scale the ring. All recorded usage-trend points and axes are also identical before/after.

The intervention supports layer-dependent rasterization as the leading diagnosis. The underlying browser paint/cache mechanism remains unproven. Finite successful captures do not guarantee deterministic rendering on every device or future browser version.

## Validation

- Fresh web TypeScript/Vite build passes, retaining the existing large legacy App chunk warning.
- Original unchanged Models EN/TH × dark/light gate passes four pairs, all byte-identical. No mask or tolerance change is made. API-backed Tokens/Calls/API-value route semantics, actual quantities/dates, complete tables, proportional zero/tiny points, exact pair identities, selection/filtering, keyboard access and390/900/1280 overflow checks pass.
- A separate copy of the same complete gate removes its diagnostic renderer flags. All four first-pass functional sets complete. Native EN-dark and TH-dark pairs are exact. EN-light has one table pixel/max1 and passes. TH-light has two table pixels/max20 and fails the original full-page tolerance; its full gate is RED.
- Ring regions including20px surrounding space are byte-identical in all eight pairs. This is component analysis, not a mask or substitute for the failed native full-page result.
- Native TH-light differences are exactly x246/y424 (max20) and x717/y429 (max1), outside the ring. Raw first/repeat images and paint records are retained for both renderer modes, together with the native failure log.
- Canonical before/after differs by5074 pixels/max3, with unchanged ring geometry, semantic paint inputs, trend and axes. Raw unmasked data is recorded; these counts are not a whole-reference similarity score.

Current compiled index SHA256: `96e3bd8d0b466b9e062aa35d7b38efaf238bf652234e3642eee61d80cd466371`.

[Audited comparison](evidence/analysis.json), [original gate report](evidence/models-stable.json), [reference/current viewer](review.html). The native runner is an archived test copy with empty rendererArgs; all other behavior checks and thresholds are retained. It still uses the gate's reduced-motion and screenshot normalization, so this is not an exact-motion proof.

## Remaining

The native table boundary pixels, broader retained raster controls, full [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight source acceptance, production native/settings/error/motion/resource matrix and human visual review remain open. The old ring failure evidence is preserved; this checkpoint adds bounded correction evidence rather than rewriting it. Product114's655-test suite and real two-version rollback remain historical115 evidence. No current desktop ZIP is produced by this checkpoint.
