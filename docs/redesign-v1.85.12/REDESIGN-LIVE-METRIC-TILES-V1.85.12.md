# Live metric tiles v1.85.12

**Status: implementation in progress; visual sign-off not reached.** This checkpoint refines the Live summary cards against the supplied Live reference while keeping their values and meanings tied to the daemon.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\live.png` (1672 x 941; original unchanged).
- Before: [v1.85.8 Live capture](../redesign-v1.85.8/live-after-en-dark.png).
- After: [English/dark](live-en-dark.png), [English/light](live-en-light.png), [Thai/dark](live-th-dark.png), and [Thai/light](live-th-light.png).
- [Live capture verification](live-capture-verification.json).

## Changes

- On desktop, the four summary tiles now use 44px circular marks, a 78px minimum height, and a restrained gradient, border tint, and inset highlight. Their colors follow the existing accent, success, warning, and danger tokens.
- The tile labels and counts remain the existing real values: recent sessions, reporting sources, stale sources, and reader errors. No trends, percentages, session states, or other values were added.
- The narrow-screen rules are unchanged.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports the existing 532.87 kB `App` chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=live npm run test:stable` passed for English and Thai in dark and light themes: four screenshot pairs were byte-identical on repeat, with no masks. The run also passed the existing refresh, chart-data, keyboard, and 390/900/1280 overflow checks.
- The capture harness reports the Live content bottom at 937.375px for English and 940.672px for Thai within the 941px viewport. No page overflow was reported.
- The capture is a repeatability and behavior check, not a comparison score against the concept. No whole-page similarity percentage is claimed.

## Remaining work

The Live screen still differs in its session status/runtime columns, alert count, and streaming-style chart. The daemon does not provide the reference's session-state breakdown or streaming telemetry, so these remain genuine content differences. Continue with reference-measured color, spacing, and panel treatments that can be matched without inventing data. The requested 99 to 100 percent likeness remains open.
