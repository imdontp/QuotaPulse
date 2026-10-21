# Cost plot/context checkpoint v1.85.108

Status: partially validated. Focused Cost checks pass; strict all-eight raster control remains RED. Full user visual/native/package/performance/rollback acceptance is open.

## Implemented reference alignment

At the original1672x941 canvas, the current chart moves from x298/y394.797/657.828x190 to x298/y411.797/657.828x190. Source estimate is x298/y410/658x192, ending near y602; current bottom601.797. The plot is now within2px of estimated top and1px of horizontal geometry/bottom. These are measured anchors, not a whole-image likeness percentage.

The complete pricing coverage and existing chart-data disclosure occupy the title-to-plot context row at native widths>=1536. The closed panel stays302px high at the EN reference canvas in both themes, retaining model/lower panel positions. The DOM now reads pricing context before the chart. Compact visual flow retains the chart before the disclosure; there are no interactive plot controls between them. The existing expanded data table naturally increases panel height and remains keyboard accessible. Nothing is hidden to make the panel fit.

Five DOM-only layout candidates were compared before source changes. Adding margin alone reaches y409.797 but grows the panel to316.797 and shifts lower content, so it was rejected. A2px context-to-plot margin reaches y409.797 but the first axis label box intersects the disclosure target; the chosen4px margin puts y411.797 with separated boxes. Sizes, plotted quantities, bucket timestamps, currency/basis semantics, API scopes and charts remain unchanged. No dependency or production bitmap changes.

## Final-build checks

- npm run build -w @quotapulse/web passes TypeScript/Vite; existing large-chunk warning remains.
- Native Chrome155.0.8059.80 with no renderer flags:28 cases = EN/TH x dark/light x390/900/1280/1536/1586/1672/1920. No horizontal page overflow; coverage, controls, plot/date/axis labels fit their panel. At native widths both first axis labels are below the disclosure target. Compact plot/disclosure visual order is preserved. All28 cases open/close via Enter, retain summary focus and disclose every plotted bucket row, with no expanded table/plot overlap or clipping. This checks these rectangles and keyboard behavior, not complete accessibility certification or performance.
- Existing Cost stable gate passes four EN/TH/theme pairs, all byte-identical, no masks. Twelve scoped checks retain API/native bases, unpriced scopes, actual zero/tiny/partial amounts, token bucket centers and complete chart disclosures. Existing monetary precision and heading/section-bound checks remain enabled.
- Final all-eight canonical EN dark captures have byte-exact immediate repeats and no browser errors or forbidden external/write requests. Overview1586x992; other seven1672x941. Main/sidebar/QuickStats/headings geometry is exactly equal to107, including all Cost main-region boxes. Canonical captures use recorded deterministic renderer arguments; the separate28-case native matrix does not.
- Current compiled index SHA256: 4f80a1c82fc10d521f7f48b131c22456ebb151c266bef13ad621778e8eb95f66. All final matrix/gate/capture evidence matches it. Full repository, native motion, packaged-host/performance and actual rollback suites were not repeated for this layout change; historical evidence remains attached to its own version.

## Retained strict controls RED

Every pixel is counted, with no masks/tolerance. Cost has44558 changed pixels inside the original trend panel and22 outside in its sidebar/maxdelta35. History has418 changed pixels in its record-kind select label/maxdelta222. Providers has17/maxdelta1 (7 on main rounded corner,10 sidebar). Overview,Live,Projects,Models,Alerts are byte-identical to107. The control exits1 and raw samples are retained. These unexplained differences are not called harmless or attributed to the Cost source edit.

The History issue received a bounded debug-failures investigation; see [diagnosis](HISTORY-PAINT-DIAGNOSIS.md). The first418px select profile did not reproduce in a cold current-build capture or a repeated original warm route order. Cold/warm repeat selects have identical values, text, rectangles and computed font/padding/border/appearance/transform. Other inter-run sidebar/header pixels remain. The failing first frame stays in the canonical viewer; it is not replaced with a better-looking recapture. No root-cause claim or History production fix is justified by these observations.

## Review and remaining work

[All-eight original/107/current viewer](review.html) includes full unmasked side-by-side/overlay/difference and native/compact Thai/light snapshots. Inspection data uses isolated in-memory synthetic fixtures; production reads real observations normally.

The specific Cost vertical alignment follow-up from103 now has measured source and native checks. Remaining Cost palette/art/legend/controls/typography and all-eight differences, historical raster diagnostics, actual tested-host/build identification, original requirement trace and native/package/performance/rollback remain open. [Full obligations](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). No99-100% likeness or human visual acceptance is claimed. Main and user databases remain untouched.

## Reproduction

Build the web workspace. Set QUOTAPULSE_CAPTURE_SCOPE=cost and run node --import tsx scripts/check-stable-captures.mts (isolated port7804). Extract archived .mts harnesses into tmp to preserve imports. Run check-cost108-matrix.mts, capture-cost108-all8.mts, cold/warm History capture harnesses sequentially (they share isolated port7816). check-cost108-controls.mts uses immutable107 images, current all-eight captures and the archived original panel bounds from layout-trials.json, and correctly exits1. First-run exact history-form geometry was not recorded; follow-up cannot retroactively prove it. Retained supplemental screenshots and comparisons are diagnostics, not accepted replacement baselines.
