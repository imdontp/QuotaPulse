# Projects/Models inspection and all-eight review123

Status: **Partially validated for the full redesign**. The new chart behavior passes scoped verification. Projects and Models pass their original four-combination gates, eight byte-identical pairs total, with masks and thresholds unchanged. This does not establish all-eight concept acceptance or resolve retained header raster differences.

## Changed

- Main Projects and Models charts now expose nearest-bucket pointer inspection and a single SVG keyboard focus stop. Left/Right, Home/End and Escape inspect actual buckets without changing scales, dates, points or the complete data table. Small sparklines keep their original noninteractive behavior.
- Tooltip values and units follow the actual metric: project tokens, model tokens or calls. They disclose the real bucket start, ISO timestamp and full-precision quantity, with localized instructions/status. No invented benchmark or lifecycle data is added.
- Tooltips dismiss on blur, pointer exit, scope/metric change, scroll and resize. They remain inside the containing panel horizontally, stay in the viewport and avoid covering the selected marker. Tab proceeds to the existing complete data disclosure.
- Fixed a reproduced click-focus defect: hovering and then clicking previously reset inspection to the first point. Focus now preserves the hovered point. The same handler correction is applied to History and covered by its native matrix.

## Current evidence

Final web TypeScript/Vite build passes; existing legacy chunk warning remains. Compiled index SHA256: `9e42c21cdaa816852361d4c652a37957d5021164d05a63ce49120d693409885f`.

- Native Chrome155 without renderer flags, DPR1 and reduced motion:16 Projects/Models cases, EN/TH × dark/light ×390/1672px. There are24 scoped API checks: project tokens in8 cases, model tokens and calls in8 cases. Independent daemon reads match every plotted/complete-table bucket, including zeros. Keyboard bounds/steps, pointer/click retention, metric invalidation, viewport/panel containment, marker visibility, resize/scroll dismissal and full-table Tab/open/close checks pass. No browser errors, forbidden writes/external requests or page overflow.
- Eight History native cases pass against the same final index, covering30-day/today scopes and the matching click-focus correction. This adds16 scoped History range checks. These are browser tests, not current Electron or physical native lifecycle proof.
- Projects original integration/repeatability gate: four exact pairs, existing project identity/selection/search/complete-data/tiny/zero/axis/keyboard/narrow assertions retained. New inspection checks run on independently queried points.
- Models original gate: four exact pairs, existing provider/model identity, selection, ratios, token components/ring paint, all-zero/tiny series, context, tables and narrow assertions retained. Inspection also runs for token/call/API-value comparison routes with the usage graph's actual token/call unit,12 scoped inspection checks total. An API-value comparison continues to show its explicitly labelled token usage trend; no monetary trend is fabricated.
- Fresh native captures cover all eight original reference viewports:1586×992 Overview,1672×941 others. All eight immediate repeats are exact. Before/after page geometry is identical. Seven whole frames are byte-identical; Providers differs by105 pixels/max4 solely in header bounds `(955,12)–(1363,47)`. Both newly interactive plot regions are pixel-identical when inactive, retaining30 points each. Every difference is retained. This comparison measures preservation of app122, not similarity to concept pixels. [Analysis](evidence/analysis.json).

All API fixtures use an isolated synthetic database and fixed Date with real timers. No customer profile, readers, credentials or account probes are used. Original reference hashes are checked. Existing accepted semantic substitutions remain authoritative.

## Investigation and limits

A test-only header transform intervention was evaluated across six independent Chrome processes at app122. All header geometry/non-transform paint facts matched. Unchanged controls had zero header difference in those sampled comparisons, with up to24 sidebar pixels/max35 elsewhere; the intervention introduced123 changed header pixels in two comparisons and543 changed pixels/max222 across the full frame. It was rejected and no header CSS change is shipped. This does not prove a browser-internal cause or resolve122's132-pixel/max7 History header failure. The current105-pixel Providers difference further remains open.

The initial metric-switch test kept the SVG focused while programmatically changing the selector. The product correctly removed the old tooltip; the test now explicitly blurs/refocuses before checking a new focus event. A separate actual click test reproduced the first-point reset before the production fix. Raw failure logs and the initial check are retained.

The [all-eight viewer](review.html) includes current frames, original references and actual inspected states. [Visual audit](VISUAL-AUDIT.md) records the next concrete work. [Requirement delta](REQUIREMENT-DELTA.md) supplements the approved20-row trace without closing any row wholesale. No updated desktop ZIP, signed release or production installation is produced here; ZIP121 still contains app120. Current native/settings/error/motion/resource coverage, retained raster controls, Models Thai-light table pixels from119 and final human visual acceptance remain open.
