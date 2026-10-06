# Quota owner typography v1.85.11

**Status: implementation in progress; visual sign-off not reached.** This checkpoint formats subscription owner suffixes to follow the concept's heading hierarchy while preserving the exact API label for assistive technology.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\overview.png` (1586 x 992; original unchanged).
- Before: [v1.85.10 Overview capture](../redesign-v1.85.10/overview-after-en-dark.png).
- After dark: [full Overview capture](overview-after-en-dark.png).
- After light: [Overview capture](overview-after-en-light.png).
- [Full Overview English/dark verification](overview-en-dark-verification.json), [Runtime Map dark verification](runtime-layout-en-dark-verification.json), and [light verification](runtime-layout-en-light-verification.json).
- [Before](parity-before/reference-parity.json) and [after](parity-after/reference-parity.json) region reports use the same local, unapproved 11-by-11 luminance SSIM diagnostic. The [after heatmap](parity-after/reference-heatmap.png) is included for review.

## Changes

- Owner names ending in the actual `Subscription` suffix now render as `OpenAI (Subscription)` and `OpenCode Go (Subscription)`, with the suffix in a smaller muted style. Other owner labels remain unchanged.
- Each quota heading's accessible label retains the complete original API-provided name. The owner/provider and all quota values remain data-backed.
- The Overview capture harness asserts both the formatted visible heading and the unchanged accessible name. Its Activity renderer check now chooses a call-grain row with a known provider/model; the first row is an aggregate record and correctly has no per-call sparkline.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk warning.
- The full Overview English/dark suite passed: one byte-identical capture pair, no masks, two owners/eight quota windows, keyboard scrolling, quota-history identity, and Activity renderer accessible values, theme redraw, resize, single-point, and zero-baseline checks.
- Runtime-layout English/dark and English/light checks passed. The light pair was byte-identical; the dark pair changed 15 pixels with maximum channel delta 10, within the harness's recorded tolerance and with no masks.
- The local diagnostic changed the subscriptions region SSIM from 0.4838817310 to 0.4861256827 and global Overview from 0.5322643627 to 0.5324636695. These values are diagnostics, not percentages of likeness or an approved acceptance comparator.

## Remaining work

Continue comparing remaining Overview regions and the other seven supplied refs. The requested 99 to 100 percent likeness remains open; these checks do not establish visual acceptance.
