# v1.85.69: Overview and Models source artwork repair

Scoped visual implementation validated. Native desktop lifecycle partially validated. Whole-reference and release acceptance remain open.

Models initial repeat matrix failed EN light (124 pixels, max channel39), restricted to donut edges. An unchanged isolated EN light rerun passed byte-identically; cause remains unconfirmed. Full Models rerun passed all four pairs (three byte-identical); exact ring geometry/computed paint inputs are unchanged across both passes. One pair stays within the original tolerance. The initial failure remains unexplained and is preserved. Original tolerance is retained.

## Changes

- Overview dark: a lower atmosphere shade reduces the pale stacked annulus without changing quota progress math, states or labels.
- Overview dark: primary edges use 12px open chevrons and source-inspired cyan/blue/violet tones; resting active node rims use a quieter tone. Actual anchors, edge weights, node data and interaction states are retained.
- Models dark: four actual token component sectors and legends share source-inspired input blues and violet output. Light uses the original palette; no data or sector proportions are copied from the concept.
- Styling applies consistently to all production dark widths. Responsive layout is retained.
- Runtime regression resolves each edge's computed marker target, then verifies primary and fallback definitions.

## Current evidence

Production index: `4371ebf043748302ef259375e08c0dde6a1dccd3e1f7abc7cad72d69085a3c48`.

- Build passed; existing Vite chunk warning remains.
- Web unit tests:170 passed.
- Models EN/TH dark/light:four repeat pairs passed (three byte-identical); exact ring paint/geometry inputs invariant.
- Overview EN/TH dark/light: four repeat pairs, all byte-identical; existing data, keyboard, responsive and quota-state checks passed.
- Models actual API palette fixture: 45 combinations across normal/positive cache write/zero, three language/theme combinations and five widths passed.
- Native before/current: only Overview and Models have material changes. Live, Projects, Providers, Cost and Alerts are byte-identical. History differs in four pixels by one channel level, within the original unmasked tolerance.

## Source measurements and limits

Measured lower-globe crop MAE improves 48.972 to 29.756; full artwork 30.703 to 29.314. Corrected open-chevron map candidate crop MAE improves 20.808 to 17.655. These are local diagnostics, not similarity percentages. Source registration has uncertainty, the globe upper-right artwork remains different, and the actual weighted graph still differs from the illustrative network.

The donut preserves four actual components rather than copying the two illustrative source sectors. Exact lighting, ring geometry and whole-page glyph matching still need review. Current repeatability does not establish 99–100% concept fidelity. Installed app, packaged rollback, performance budgets and final manual acceptance remain open.

Use review.html to compare original concept, before and current images. Before is build68; Models fixture and Overview verification identify their own tested asset. Previous full40/repository474/desktop68 results are historical after this build changed.

## Actual desktop probe investigation

Prepared Playwright Electron probe did not pass: native hide left document.visibilityState visible in that automated host. Local Playwright loader injects background-throttling switches and focus emulation; turning off focus emulation on an additional CDP session did not resolve it. This is not yet attributed to production app behavior. A raw Electron process/parent-child IPC probe is being prepared to check default native behavior without Playwright/CDP overrides. Official expected visibility behavior: [Electron BrowserWindow documentation](https://www.electronjs.org/docs/latest/api/browser-window#page-visibility). No passing native visibility result is claimed yet.

### Native desktop result

Raw Electron (no Playwright/CDP/background flags) verifies real native hide, no Activity paint while hidden after SSE/theme/resize, and actual show refresh to the latest800-token API bucket. Default getBackgroundThrottling() istrue. Owned processes terminate0, remain off-monitor and record zero focus events.

Minimize returns native visiblefalse/minimizedtrue but document.hidden remainsfalse until timeout. showInactive→show and a guarded focusability control did not resolve this. Focusability hypothesis is unconfirmed; no production defect is inferred from this altered fixture. Restore/latest1700/unmount assertions were not reached. Original failures and controls are retained. This is **partial desktop validation**, not a passing minimize/recovery/installed app gate.

Next source experiment: independently isolate upper-right world-limb lighting and quota gradient phase, preserving actual percentages, mask, anchors and lower-globe repair. Full goal remains active.
