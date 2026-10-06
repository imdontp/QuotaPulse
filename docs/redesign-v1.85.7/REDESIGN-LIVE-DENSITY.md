# QuotaPulse redesign fidelity checkpoint v1.85.7

**Status: implementation in progress; visual sign-off not reached.** This checkpoint changes only the in-memory visual-test timestamps so recorded call-grain rows cover more of the Live chart's 30-minute window. Production rendering and user data are unchanged from v1.85.6.

## Evidence

- Blueprint: [Live concept](../redesign-v1.85.5/live-concept.png), 1672 × 941.
- Before: [v1.85.6 Live capture](../redesign-v1.85.6/live-after-en-dark.png).
- After: [v1.85.7 Live capture](live-after-en-dark.png).
- [Live capture verification](live-capture-verification.json).
- [Overview Runtime Map capture](overview-runtime-layout-en-dark.png) and [runtime-layout verification](runtime-layout-verification.json).

## Change

- The six Codex and Claude Code session fixtures keep their latest event within four minutes. Their older call records now span approximately 5–26.5 minutes, so the 30-minute Live chart and minute matrix show recorded points across more of the visible interval.
- Hermes events remain session aggregates and keep their existing timestamps. The chart still reports aggregates separately instead of treating them as individual calls.
- The in-memory fixture retains 721M total tokens, 42% cached-input share, 12 recent sessions, three reporting sources, 23 included call-grain records, and 19 excluded aggregate records. No persistent or production event data was added or rewritten.

## Validation

- `QUOTAPULSE_CAPTURE_SCOPE=live npm run test:stable` passed in English/Thai and dark/light: four screenshot pairs, all four byte-identical on repeat, no masks. The 31-minute bucket table, chart values, refresh behavior, keyboard reachability, and responsive checks passed.
- `QUOTAPULSE_CAPTURE_SCOPE=runtime-layout` with English/dark passed twice with byte-identical captures. Runtime Map geometry stayed at zero connector endpoint error; its 12 active sessions remained Codex 4, Claude Code 2, Hermes 6, OpenCode 0.
- No web source changed in this checkpoint. The tests used the production build that passed in v1.85.6; its existing 532.87 kB `App` chunk warning remains.
- The local 11×11-window luminance SSIM diagnostic measured **0.45572** for Live (mean absolute RGB delta 18.48), versus **0.45594** for the previous capture. The trace now occupies more of the chart by visual inspection, but the global diagnostic did not improve. SSIM is not a percentage of design likeness and is not the blueprint-approved comparator; the requested 99–100% likeness has not been demonstrated.

## Remaining work

Continue the per-reference styling and composition repairs. Actual daemon data may have sparse call records and session-aggregate events; production must retain that grain and display honest gaps instead of presenting aggregates as live calls. This checkpoint improves the occupied test capture, not the whole-page fidelity result.
