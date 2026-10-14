# Offline visual priorities after checkpoint 70

## Scope and provenance

Read-only comparison of all eight original images in `docs/redesign-v1.85.69/refs/` with all eight compiled native screenshots in `docs/redesign-v1.85.70/after/`. Baseline commit supplied by parent: `285b3ff`, tag `redesign-visual-fidelity-v1.85.70`. This is not a screenshot or acceptance claim for the uncommitted 71 implementation. Original and current viewport dimensions match: Overview 1586 x 992; other seven screens 1672 x 941; DPR 1.

Viewed every pair and enlarged the relevant art regions. Read blueprint v1.1 Reference Overrides and Design/Motion contracts, actual current shell/Overview/Alerts/Cost source, historical header v1.52 notes, and v1.85.47 source changes. No browser, build, daemon, Git operation, or application edit was performed. `tmp/visual71-*.png` are offline side-by-side derivatives for inspection only.

The facts-related differences are substantial but explicitly required: owner/provider inventory, percentage, call counts, history record kind, model capacity/effort metadata, unknown projections, observed rather than invented curves, missing owner subscriptions, and absent executable budget/rule controls. These do not justify inserting concept figures, extra rows, extra subscriptions, or benchmark claims. History's default unselected rail is not a missing selected-state implementation. Previous rejected title font trials were not reopened.

## 1. Shared waveform shape and blue tone

High confidence: the two header marks have different geometry and hue, independently of all figures and labels. Source has a blue, rounded, multi-lobe waveform with a large central vertical loop and small endpoint marks. Current `shell.tsx:62` and footer at line 101 use the same straight polyline: `M1 22h6l3-10 4 22 5-31 5 34 4-25 4 16 3-8h4`. Current has a visibly cyan angular zigzag. `overview.css:108` sets `color:var(--qp-accent)`; dark wordmark itself already uses source blue `#0094ff` at line 107.

Reproducible isolated region: Overview `[16,11,60,54)` in original pixel coordinates; contains waveform and its glow, no text or changing data. Threshold diagnostics on RGB pixels: cyan `(G>100 and B>140 and G>0.7*B and R<0.8*G)` gives Source 11 / current 379; blue `(B>100 and B>1.3*G and R<0.6*B)` gives Source 452 / current 132. These are regional hue diagnostics, not an overall likeness score. Clip is deliberately fixed and omits a few outer glow pixels; enlarged derivative `tmp/visual71-crop-brand.png` establishes the shape difference directly.

Prior work is compatible with this finding. `docs/REDESIGN-HEADER-BRAND-V1.52.md` explicitly retained the existing vector waveform while changing size/insets/type/status; it did not claim exact waveform reconstruction. v1.85.47 changed the dark wordmark blue and Overview caption, not the waveform path. This is remaining art work rather than a regression in those measurements.

Bounded trial: retain SVG bounds, flex geometry, wordmark, all semantics and light fallback; try source-measured curved SVG path/endpoints plus dark mark tone `#1285fb` or `#0094ff` and measured blue glow separately. Compare path-only, tone-only, and combined trials against Source before selecting one. Header and footer should share the same approved mark. Do not generate a bitmap or alter a font to solve this shape mismatch. Recheck all eight header/footer placements, focus behavior, light/Thai/narrow states, and the actual unaffected text geometry after a winner is implemented.

## 2. Alerts forecast sphere texture

High confidence: Source's forecast interior has a dark curved geographic sphere/network surface; current uses evenly repeated dot fields and crossing straight stripes, producing a flat star/grid disc. Ring circumference and current forecast number are separate from this finding. `alerts.css:117` currently creates this interior using two radial dot tiles sized `9px 11px` / `13px 7px`, two repeating-linear-gradients at 27 and 117 degrees, and an elliptical glow. No Earth/geographic asset is used there.

Inspect Alerts `[1239,117,1434,306)` via `tmp/visual71-crop-alertring.png`; restrict quantitative trials to the interior mask, excluding readable number/label and all ring segments. A safe current image-only diagnostic patch is `[1327,161,1347,178)` near the top inner surface, above both labels. Source mean RGB `[2.87,16.25,37.61]`, channel std `[1.41,3.99,8.80]`; current mean `[5.45,16.03,35.07]`, std `[1.25,1.52,3.30]`. This patch supports a texture difference; it does not prove an exact replacement or a complete regional score. Avoid the lower caption patch, because mandated labels differ there.

Bounded trial: reuse the existing approved `/redesign/pulse-earth-v4.png` decorative surface used by Overview (`overview.tsx:160`) inside a circular clipped Alerts inner surface, at a separately measured dark opacity/registration; compare it with a small SVG curved mesh alternative if geographic registration remains wrong. Preserve actual forecast text, numeric semantics, outer ring shape, quota selection, warning state, reduced motion, and light fallback. First demonstrate source-only texture gain with a text-excluded mask and unchanged component geometry. The source Earth remains decorative; no extra health, geography, or factual meaning should be introduced.

## 3. Cost donut surface depth, conditional on a measured trial

High confidence that a surface difference remains; lower confidence about the corrective parameters. Source segments have a lit inner/outer bevel and more surface variation; current conic-gradient bodies are largely flat, despite the existing edge circles and separator lines. Current `cost.tsx:40-48` supplies flat per-provider body/rim colors, and `CostDonutEdges` at lines 54-73 already preserves real shares. CSS at `cost.css:187-192` supplies 1.4px edge strokes, a 3px dark separator, a 1px seam light and glow. This is not a request to remove those existing improvements or restore Source provider ranking.

Whole donut art ROI is Cost `[1207,126,1431,330)`, enlarged in `tmp/visual71-crop-costring.png`. Source and current segment angles/colors differ because facts and provider ordering differ: raw ROI MAE/SSIM is not a valid shading verdict. A small upper-left gray body patch `[1296,137,1314,146)` avoids text and the top seam and remains in the gray segment in both images: Source mean RGB `[80.71,95.22,115.36]`, std `[2.68,2.87,3.67]`; current mean `[80.04,92.14,111.14]`, std `[0.19,0.34,0.38]`. This verifies near-flat current paint versus varied Source surface; Source raster variation alone does not imply noise should be copied.

Bounded trial: an annular radial light/shade layer clipped to the real donut body, with at most 2-3 opacity/width variants. Preserve row order, angular shares, zero/no-priced behavior, center amount/basis/scope text, hole dimensions and all existing rim geometry. Compare provider-normalized radial profiles away from seams and text; inspect the gray patch plus equivalent blue/violet/orange segment interiors registered in polar coordinates. Reject a variant that changes categorical identification, hides real shares, or worsens the approved rim. Do not move segments to Source angles, fake a provider, or claim success from repeated screenshots.

## Suggested order

Finish current 71 action/scope verification and the contract motion/loading repairs first. For the next source-art pass, the waveform gives a small shared eight-screen improvement with the clearest fact-independent measurement; the Alerts interior is the next larger art gap. Cost body shading is a bounded experiment, not an immediately approved CSS change. Existing upper Globe ring phase/bevel gaps remain known from parent checkpoint 70 trials and were not independently reopened here.

These findings do not establish 99-100% completion or an approved implementation baseline. Current combined functionality, native lifecycle, performance, packaging/rollback, and manual source acceptance remain separate requirements.
