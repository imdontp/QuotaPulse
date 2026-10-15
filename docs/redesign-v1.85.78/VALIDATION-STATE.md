# v1.85.78 — Source-shaped Overview filaments

## Status and scope

Bounded implementation validated by current build, web tests, compatibility and all-eight captures; original Overview gate passed (four EN/TH dark/light repeat pairs). Overall blueprint/concept acceptance remains open. Base commit5a5e922; branch design/redesign-foundation; intended tag redesign-visual-fidelity-v1.85.78.

The dark production Overview now draws six static filaments using traced Source coordinates in the existing760x320 ambient viewBox, with four existing junctions following their corresponding curves. Light theme and development preview retain the old component behavior. No usage values or quota state are represented by these decorative paths. All actual figures continue to come through application APIs.

## Evidence

- Current production build exit0; existing >500kB bundle advisory remains. Web tests205 passed,0 failed.
- Compatibility:12 cases, EN/TH dark/light at1586/390 plus900/901 boundaries. Main foreground paired controls are pixel exact; full-frame comparisons retain maxChannelDelta10 / changed fraction0.00005. Light/hidden normal main images are exact. Default SSR component markup equals the previous implementation exactly. All12 preserve factual text, metric/model boxes, and globe structure/styles. Six waves, four junctions and58 stars remain decorative and pointer-inert.
- All-eight native EN/dark production capture succeeded, with responsive/overflow assertions. Six other pages are pixel identical to77. History differs by2 pixels/max1 at[247,451,556,479]; no cause established. Overview changes63282 pixels including30 sidebar icon pixels and intended ambient compositing. See diagnostics/native-diff.json; these are not whole-screen likeness scores.
- The frozen Source mask includes5408 pixels in two wing regions; it was defined before candidates were opened and was not regenerated. Initial tone/registration/irregularity trials and the first trace were rejected. The selected refined trace improves both wings for all9 paired registrations and support thresholds80/90/110. Left MAE10.191→6.517, recall within2px0.3045→0.6318, p9543→6.617. Right MAE21.250→17.170, recall0.5346→0.8088, p959.450→3.606. These small clean regions do not measure overall concept likeness.
- Compiled current output equals the selected trial in every frozen-mask pixel. The trial used the77 build index; compatibility/all-eight/current canonical gate use the new78 index. Provenance keeps these identities separate.

- Original Overview gate exit0: four native repeat pairs across EN/TH dark/light: three byte-identical, Thai dark differs9 pixels/max1; original raster tolerance and no masks retained. Includes existing project selector identity/API transitions, real scope and model navigation, quota-history expansion, keyboard and390/900/1280 layout checks. See overview/verification.json for each check and raster result. Same-build repeatability does not certify whole-screen Source likeness or actual Electron lifecycle.

## Compositing and retained failures

The wave glow underpaints the transparent globe/ring limb. Normal trial comparisons changed5062 pixels inside radius110px (max3), and7189 inside radius118px (max79), centered at native viewport coordinates(734.546875,243). This is disclosed rather than treated as unchanged globe paint. Main foreground images with ambient hidden are exact; actual globe markup, masks, gradients, progress, orbit and factual boxes remain fixed. Metric glyph support was unchanged; small core/model glyph antialias differences and quota-ridge overlap from normal underpainting were recorded during diagnostics.

Retained harness failures: serialized local arrow helpers produced __name errors; evaluating static arrays fixed that fixture. SSR probe initially used the wrong JSX transform; installed tsx --tsconfig packages/web/tsconfig.json fixes the harness without changing app source. One prior ambient-hidden full-frame pair differed4 pixels/max1 at QuickStats corner. The final probe requires exact main foreground while separately applying the original full-frame tolerance; the failing run log is retained. This change of foreground acceptance scope is explicit, not a pixel mask silently introduced into the canonical raster gate.

## Limits and next work

Source atmosphere/glints and fine filament texture remain different. No99–100% score or full-goal completion is claimed. Per-region API loading/error geometry on seven other routes, action/state inventory, first-resume motion caveats, performance/high-cardinality, production-equivalent Electron lifecycle, packaging/rollback and manual acceptance remain. No new pet work is included. Original checkout/user files and unrelated.zed content are outside this change.

Reproduction scripts are archived with original worktree-relative paths. Run from this isolated worktree; they use a synthetic in-memory daemon fixture, not the live user database. Browser checks must run sequentially. Review images in review.html.
