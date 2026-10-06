# QuotaPulse redesign fidelity checkpoint v1.85.6

**Status: implementation in progress; visual sign-off not reached.** This checkpoint improves the Live chart's dark-theme line treatment and makes the isolated capture fixture exercise a populated 30-minute input/output series. It does not certify concept parity.

## Evidence

- Blueprint reference: [Live concept](../redesign-v1.85.5/live-concept.png), 1672 × 941.
- Before: [v1.85.5 Live capture](../redesign-v1.85.5/live-after-en-dark.png).
- After: [v1.85.6 Live capture](live-after-en-dark.png).
- [Live capture verification](live-capture-verification.json).
- [Overview Runtime Map capture](overview-runtime-layout-en-dark.png) and [runtime-layout verification](runtime-layout-verification.json).

## Change

- Dark-theme input and output series now use a restrained glow to match the reference chart's luminous treatment. Light theme is unchanged.
- The **in-memory test fixture only** now spreads older calls across the 30-minute chart and gives input and output separate non-zero values. Each of the 12 recent sessions still has a record within four minutes; the fixture retains its 721M monthly token total, 42% cached-input share, and three reporting sources. No production event or user data was changed.
- The product continues to label and render this as recorded usage per minute. The reference depicts streaming session data, which the local usage ledger does not provide.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports the existing 532.87 kB `App` chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=live npm run test:stable` passed for English/Thai and dark/light: all four screenshot pairs were byte-identical on repeat, without masks. The 30-minute matrix, chart states, refresh behavior, keyboard reachability, and responsive checks passed.
- `QUOTAPULSE_CAPTURE_SCOPE=runtime-layout` with English/dark passed twice with byte-identical captures. It verified 44 nodes, 50 edges, zero connector endpoint error, and 12 active sessions (Codex 4, Claude Code 2, Hermes 6, OpenCode 0).
- `git diff --check` passed. The full Overview suite did not finish within six minutes, so this checkpoint relies on the narrower Runtime Map suite for fixture/layout evidence; Overview period, quota, and insight interactions were not revalidated here.
- A local, unapproved 11×11-window luminance SSIM diagnostic measured **0.4559** against the Live concept (mean absolute RGB delta 18.47). This does not demonstrate a whole-page parity improvement. SSIM is not a percentage of design likeness and is only diagnostic, not the blueprint-approved comparator; the requested 99–100% likeness has not been demonstrated.

## Remaining work

Continue matching each reference's colors, imagery, content hierarchy, interactions, and layout while preserving real daemon-backed data. Keep this redesign marked in progress until the complete reference set has been reviewed against an agreed comparison method and the requested likeness is actually demonstrated.
