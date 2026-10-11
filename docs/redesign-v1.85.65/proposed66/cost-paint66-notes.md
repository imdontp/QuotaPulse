# Cost native dark chart paint proposal 66

Read-only review of frozen source/build65; proposal not applied. No browsers, services, builds, tests, or Git run by this agent.

## Inputs

- Original source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\cost.png`
  SHA-256 `f90cf0c904c8dcc7872032207ba4aebf849d9f891809e66884c4c7bf5689f88a`
- Existing real-data native capture: `docs/redesign-v1.85.64/native-en-dark/cost-default.png`
  SHA-256 `6a6b0fd70e45ac2d8cbb186eaf3cc9469db5d50f01e581c9ce32cc2f29adcab1`
- Capture production index from docs64 native geometry: `c118de8dec77029c9178d6cd633e2860640e32f86dafdd9a81811c9a3ea8a45d`
- CSS `packages/web/src/redesign/cost.css:25`: existing global `linear-gradient(#2bb8ef,#4c6df2)`.
- Real column height remains `point.amount / maxCost * 100` in `cost.tsx`. Proposal does not change points, scope, buckets, heights, width, axes, values, rows, coverage, labels, or data tables.

## Measured center samples

Chosen last nonzero bar center x933. Source vertical painted run y500–600; current y392–580. Interior sampling uses y501–600 versus392–580 to avoid source antialias cap; 3×3 median at x932–934. Normalized positions respect different real bar heights; no fake matching of series.

| Normalized depth | Source y | Source RGB | Current y | Current RGB |
|---|---:|---|---:|---|
| 0.10 | 511 | (11, 196, 253) | 411 | (46, 176, 239) |
| 0.25 | 526 | (9, 177, 251) | 439 | (51, 165, 240) |
| 0.50 | 550 | (8, 138, 241) | 486 | (60, 146, 241) |
| 0.75 | 575 | (7, 102, 209) | 533 | (68, 128, 241) |
| 0.90 | 590 | (6, 83, 186) | 561 | (73, 117, 242) |

Source sample edge at y550: x923=(11,180,251), center x933=(8,138,241), x945=(17,194,255). Halo outside at x919=(9,33,73); distant x917=(9,27,58). Source texture/antialias is nonuniform. Samples support a darker blue base, cyan center cap, bright vertical edges and restrained blue halo. They do not prove proposed browser pixels are exact.

## Minimal proposed change

`tmp/cost-paint66-proposed.patch` adds one override only at native desktop >=1536, production Cost, dark theme. Five vertical stops approximate the measured interior ramp; inferred endpoints #0bd3ff / #064eaf. Inset shadows provide painted edges without adding border dimensions. Drop-shadow supplies the halo from the painted silhouette. A zero-height box has no painted silhouette; this avoids an outer box-shadow showing a glowing horizontal mark for a real zero. Verify that behavior in browser before accepting.

No JS, series smoothing, invented points, background source assets, imagegen, API or translation change. Other pages, narrower widths and light theme retain current rules. Hover/focus interactions remain on existing elements; no overlays or pointer event change.

## Root verification after freeze/gates65 finish

1. Inspect/apply proposal and run web build; capture native Cost EN-dark at1672 and1536 plus fallback widths1280/900/390, TH-dark/native and TH-light. Confirm overflow and long/partial monetary value lines remain sound.
2. Run original scoped Cost repeat-capture gate with all4 language/theme contexts and unchanged tolerance/masks. Confirm actual API totals, priced versus unknown/zero/partial states, selected scope, table token counts, row ranks and accessible raw data remain correct.
3. Native compare affected Cost against64/65 using unmasked crop around actual last bar. Re-measure 3×3 medians at normalized depths after rendered bounds are known. Compare edge/glow samples; iterate only paint if necessary.
4. Verify zero amount columns do not acquire visible glow marks, including a zero-height column adjacent to nonzero; verify no-priced/unknown condition still renders the existing no-priced state instead of bars.
5. Compare all8 native screenshots: only Cost chart paint should change (65 Overview already differs intentionally from64). Do not claim other7 identical unless compared to65, not64.
6. No new implementation-mirroring unit tests required for this bounded CSS paint edit. Current scoped checks plus actual zero/native visual proof are meaningful gates.
