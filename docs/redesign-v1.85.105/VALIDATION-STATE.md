# Shared Search/header checkpoint v1.85.105

Status: partially validated. Functional/layout checks pass; strict outside-header raster control remains RED. Full dashboard concept acceptance is open.

## Implementation and original-reference evidence

The existing real command-palette button now follows the native concept Search plate: larger rounded frame, muted copy, inline parenthesized shortcut and a decorative lightning mark at the right. The mark belongs to the same button and opens the real palette; it is not a new unsupported action. Ctrl/Cmd+K behavior, accessible name, dialog ID/help, filtering, keyboard handling and route semantics are preserved. An explicit native focus outline keeps keyboard feedback visible over the custom rim paint. Compact and legacy layouts keep the previous flattened copy/shortcut layout and hide the decorative mark.

The original action area is measured independently on its two canvases:

| Canvas | Current Search x/y/width/height | Label x/width | Native text |
|---|---|---|---|
| Overview1586×992 | 907.109 / 11 / 386.188 / 34 | 949.109 / 84.484 | 10.5px Geist400 |
| Other refs1672×941 | 955 / 11 / 408 / 36 | 999 / 92.531 | 11.5px Geist400 |

Reference foreground column groups begin at x949/999; the observed label extents agree with bundled-Geist width measurements. This corrects the previous13px inherited button type and28px frame height. Clock/tool gaps and right inset follow the original action-group placement (including the different Overview spacing). The actual theme/language actions retain their meaning instead of simulating a profile menu.

Rim/surface colors follow RGB scans through x1200 in the original empty Search field. The local mean absolute channel error falls from6.21 to2.62 on Cost and4.35 to2.61 on Overview. These are one-line material diagnostics, not whole-image similarity or likeness percentages. The source glyph-column threshold and font measurements are retained. Computed Search text vs its declared solid fill has a minimum contrast4.89:1 across native route/locale/theme samples; this is not all rendered glyphs, gradients or full accessibility certification.

## Validation

- Final TypeScript/Vite build exit0; existing >500KB bundle warning remains.
- Ordinary Chrome, no deterministic renderer flags:324 header layout cases (9 routes ×EN/TH ×dark/light ×9 widths390/900/1100/1280/1500/1536/1586/1672/1920). Checks include previous Workspace bounds/read-only semantics, full scope text, Search text/hint/bolt separation, native reference anchors and no control/status overlap or page overflow.
- 36 Ctrl+K/Escape cases restore input/trigger focus.36 pointer/filter/navigation cases click the actual lightning area, type the real localized destination label and press Enter; real History/Settings routes load and the dialog closes. History may normalize its URL to #history?; the test verifies the exact route and empty query, not a guessed spelling of that empty suffix.
- Shared legacy component fallback:8 EN/TH dark/light ×390/1672 cases verify hidden bolt, display:contents copy layout, working Ctrl+K/Escape focus and no page overflow.
- Current all-eight canonical capture pairs are immediately byte-identical, with no browser errors or forbidden external/write requests. Overview1586×992; other seven1672×941. Native matrix, legacy gate and captures use the same compiled index hash.
- Full repository, native motion/performance/package/rollback gates were not repeated for this presentation change. Historical evidence stays attached to its own build.

Two early harness assumptions were corrected without a production workaround: the palette uses ordinary accessible destination buttons rather than aria-selected buttons; History itself normalizes to an empty query suffix. The failed attempt logs are retained. A final paint-only rim refinement was followed by a fresh full native matrix, legacy gate and captures; the archived final results match the current source/index.

## Retained outside-header control RED

All eight main/sidebar/headings/QuickStats DOM geometry snapshots are exactly equal to104. Every pixel is counted with no masks/tolerance. Overview,Live,Models,History,Alerts,Cost have zero changed pixels outside y<60. Projects has20 changed pixels/maxdelta35 on the unselected sidebar Bell; Providers has7/maxdelta1 on the header rounded corner x1652–1657,y73–75. The exact before/after RGB samples are retained in evidence/outside-header-controls-RED.json. These reverse the profiles already retained in103; the matching coordinates do not prove a cause or harmlessness. The strict control exits1 and remains RED. Passing immediate repeat/functional gates do not clear it.

## Review and continuation

[Open all-eight original/104/current viewer](review.html) for header-only/full-page, side-by-side, overlay and unmasked difference. Responsive Thai and legacy captures are linked. All review data is from isolated synthetic fixtures; production reads real data normally.

Continue measured page/section typography and remaining all-eight artwork/material/layout differences, project ranking-rail accents, Cost vertical chart alignment, retained rendering diagnostics, actual tested-host/build identification, native/package/performance/rollback and the full original requirement trace. See [full continuation obligations](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). No99–100% likeness or user visual acceptance is claimed.

## Reproduction

Build: npm run build -w @quotapulse/web. Extract archived .mts harnesses to tmp to preserve imports. Run check-search105-matrix.mts, check-search105-legacy.mts and capture-search105.mts sequentially with node --import tsx; they use isolated port7816. controls-search105.mts compares retained104/105 capture folders and correctly exits1 for the retained failures. Raw logs, harnesses,324-case observations, per-route geometry, source LF hashes and compiled index hash are retained. No user DB or main-branch source was modified.
