# QuotaPulse visual fidelity checkpoint v1.81

## Overview Insights with live data

Pulse Insights now uses the selected real usage and quota readings. High Burn Rate compares the selected period with the immediately preceding period of equal duration. Cache Efficiency uses observed input, cached-input, and cache-write token totals; it only shows a change when both periods have a valid cache share. Pace Comparison compares forecast burn per hour with the selected window's safe pace. Forecast pace is unavailable when the daemon marks the forecast insufficient or reset. Recommendation is deterministic from quota freshness, runway, risk, cache share, and pricing coverage.

No-call periods are marked as pricing unavailable and do not trigger a pricing warning. Partially priced periods can recommend checking pricing. These distinctions prevent empty or incomplete source data from looking like a measured signal.

## Visual refinements

- The dashboard metric label now matches the concept's “Burn Rate” label in English; Thai copy is localized.
- The quota-history disclosure moved into a compact accessible icon control in the Runway heading. The chart remains lazy-mounted. The duplicate safe-pace line was removed from the Runway panel because Insights already compares it.
- Runtime Map flow lines, nodes, and active paths use a brighter blue/purple glow closer to the concept.
- Desktop Insights cards have slightly tighter vertical padding. The Overview lower row now begins at y≈715 and is 176px high, compared with the source layout at y≈715 and 173px; Live Activity begins at approximately y≈899, close to the source at y≈898.

## Remaining concept gaps

This checkpoint does not claim 99–100% fidelity. The concept is a fixed image; the application intentionally renders current daemon values. The current data model also has no allowance denominator for the Pulse Core globe. The machine workspace label, the More navigation item, and Runtime Map project/data controls remain visible product controls that are absent from the concept image. Changing those requires a product or source-data decision, not substituting concept values.

The screenshots in this directory are repeatable review captures with a synthetic fixture, not approved visual baselines. The running app continues to use daemon data.

## Validation

- `npm run --workspace @quotapulse/web build`: passed (`tsc -b` and Vite). Vite retains the existing advisory that the `App` chunk is 532.87 kB, above 500 kB.
- `npm test`: passed across all workspaces — daemon 100 tests, web 152 tests, tray 198 tests; 450 total, 0 failed.
- `QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable`: passed for English/Thai × dark/light. All four repeated screenshot pairs stayed within the recorded tolerance (maximum channel delta 2; changed-pixel fraction at most 0.0001). No masks were used. See [overview-verification.json](overview-verification.json).
- `git diff --check`: passed. Git reported its usual CRLF-to-LF advisory for two edited files.
- Captures and overlay comparison are available in [reference-review.html](reference-review.html).

The overall visual-fidelity objective remains open. Next, continue comparing the header, Runtime Map controls, and remaining copy against the reference while preserving live data and existing dashboard access.
