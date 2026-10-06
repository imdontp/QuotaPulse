# Provider brand tile v1.85.14

**Status: implementation in progress; visual sign-off not reached.** This checkpoint adds the reference's purple OpenCode identity tile using the actual provider key already attached to each quota-owner card.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\providers.png` (1672 x 941; original unchanged).
- After captures: [English/dark](providers-en-dark.png), [English/light](providers-en-light.png), [Thai/dark](providers-th-dark.png), and [Thai/light](providers-th-light.png).
- [Providers capture verification](providers-capture-verification.json).

## Changes

- Provider cards expose the existing provider metadata as a data attribute. The OpenCode tile now uses a purple gradient, border, and glow similar to the source image; the white mark stays legible in both themes.
- The style depends on the subscription provider or source vendor returned by the API. It does not infer provider type from display names and does not change quota values, account state, or reader health.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=providers npm run test:stable` passed in English/Thai and dark/light: four capture pairs within the existing tolerance, two byte-identical, no masks.
- A browser assertion verifies every provider card's selector matches its actual subscription/source vendor. Quota bars, all five published quota-window rows, reader health, owner selection, diagnostics, theme contrast, and 390/900/1280 overflow checks passed.
- These checks do not establish whole-image likeness. The reference shows eight provider cards and service-health details; the live application currently has four quota-owner cards and reports reader freshness instead of provider latency. Those counts and semantics remain data-backed.

## Remaining work

Continue tuning provider-specific visual treatments and the comparison/reader panel balance against the source. Preserve the available account and reader data, and keep the 99 to 100 percent whole-reference goal open until a reviewed image comparison supports it.
