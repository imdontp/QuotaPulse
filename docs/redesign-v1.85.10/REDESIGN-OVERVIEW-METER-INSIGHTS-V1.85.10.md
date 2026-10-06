# Overview Insights and token meter v1.85.10

**Status: implementation in progress; visual sign-off not reached.** This checkpoint refines the Pulse Insights cards and moves the real quota percentage beside the Token Usage progress bar.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\overview.png` (1586 x 992; original unchanged).
- Before: [v1.85.9 Overview capture](../redesign-v1.85.9/overview-after-en-dark.png).
- After dark: [Overview capture](overview-after-en-dark.png).
- After light: [Overview capture](overview-after-en-light.png).
- [Dark Runtime Map verification](runtime-layout-en-dark-verification.json) and [light verification](runtime-layout-en-light-verification.json).
- [Before](parity-before/reference-parity.json) and [after](parity-after/reference-parity.json) region reports use the same local, unapproved 11-by-11 luminance SSIM diagnostic. The [after heatmap](parity-after/reference-heatmap.png) is included for review.

## Changes

- Dark-theme Pulse Insights cards now use a neutral, low-contrast border and 1% category tint, closer to the subdued card surfaces in the ref. The light theme keeps its earlier border and tint so the cards retain their contrast.
- The Token Usage meter places the actual quota percentage beside its progress bar and hides the redundant "Monthly quota" caption visually. The meter's accessible label still identifies the quota owner and window. The UI continues to show the actual recorded token total and does not infer a token allowance that the quota API does not provide.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk warning.
- Runtime-layout stable captures passed in English/dark and English/light. Each produced one byte-identical pair with no masks. The checks include page overflow and Runtime Map geometry/keyboard scenarios; they do not assert full quota semantics or approve source likeness.
- In the local diagnostic, global Overview SSIM changed from 0.5235134202 to 0.5322643627 and Pulse Insights changed from 0.4190443935 to 0.5506043711. Pulse Core changed from 0.4746077233 to 0.4726221127 after repositioning the meter. This diagnostic is not a percentage of likeness and is not an approved acceptance comparator; the small Pulse Core movement is retained because the meter now follows the source's bar/percentage arrangement without adding unsupported data.

## Remaining work

Continue the region-by-region Overview comparison, then refine the seven other supplied dashboard refs. The requested 99 to 100 percent likeness remains open; stable capture and local SSIM results do not constitute visual acceptance.
