# Quota owner provider mark v1.85.9

**Status: implementation in progress; visual sign-off not reached.** This checkpoint restores the purple backing tile for the OpenCode Go mark in the Overview quota rail. Owner names, quota values, provider identity and status continue to come from application data.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\overview.png` (1586 x 992; original unchanged).
- Before: [v1.85.8 Overview capture](../redesign-v1.85.8/overview-after-en-dark.png).
- After dark: [Overview capture](overview-after-en-dark.png).
- After light: [Overview capture](overview-after-en-light.png).
- [Dark Runtime Map verification](runtime-layout-en-dark-verification.json) and [light verification](runtime-layout-en-light-verification.json).
- The [before](parity-before/reference-parity.json) and [after](parity-after/reference-parity.json) region reports and heatmaps use the repository's local, unapproved 11-by-11 luminance SSIM diagnostic.

## Change

- The quota owner heading wraps the existing offline `VendorIcon` in a provider-keyed visual tile. OpenCode receives the purple gradient backing and a smaller white mark seen in the concept; other providers retain their existing appearance.
- The provider key comes from the quota window's existing provider field. This changes only presentation; it adds no provider inference, data, schema or daemon writes.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite still reports the existing 532.87 kB `App` chunk warning.
- `$env:QUOTAPULSE_CAPTURE_SCOPE='runtime-layout'; $env:QUOTAPULSE_CAPTURE_LANGUAGE='en'; $env:QUOTAPULSE_CAPTURE_THEME='dark'; npm run test:stable` passed: one capture pair, byte-identical, no masks.
- The same PowerShell command with `$env:QUOTAPULSE_CAPTURE_THEME='light'` passed with one byte-identical pair and no masks.
- These runtime-layout checks cover repeatability, app overflow and Runtime Map geometry/keyboard scenarios. They do not assert quota values or establish full-screen reference fidelity.
- The local diagnostic changed the subscriptions region SSIM from 0.4837426631 to 0.4838817310 and the global Overview SSIM from 0.5235010682 to 0.5235134202. This is a very small local diagnostic change. SSIM is not a percentage of visual likeness and this method is not an approved acceptance comparator.

## Remaining work

Continue comparing Overview regions and the other seven supplied pages against their source refs. Preserve real data, document honest unsupported/unknown states, and keep the requested 99 to 100 percent likeness target open until a reviewed comparison method supports visual acceptance.
