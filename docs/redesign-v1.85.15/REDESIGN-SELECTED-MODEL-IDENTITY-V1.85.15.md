# Selected model identity v1.85.15

**Status: implementation in progress; visual sign-off not reached.** The selected-model panel now gives the recorded provider mark the same prominent identity role used in the supplied concept.

## Evidence

- Blueprint source: `C:\Users\TH12367283\Downloads\quotapulse_build_blueprint\refs\models.png` (1672 x 941; original unchanged).
- After captures: [English/dark](models-en-dark.png), [English/light](models-en-light.png), [Thai/dark](models-th-dark.png), and [Thai/light](models-th-light.png).
- [Models capture verification](models-capture-verification.json).

## Changes

- A 46px vendor tile sits beside the selected model name and provider/maker labels. The mark comes from the recorded provider, with the recorded maker or unknown mark as fallback.
- Calls, sessions, priced-call coverage, API value, quota-independent metadata, and model selection remain unchanged.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite retains the existing 532.87 kB `App` chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=models npm run test:stable` passed in English/Thai and dark/light: four pairs within the existing raster tolerance, no masks.
- The browser test checks the selected provider mark against the API response, alongside six model rows, exact ratio values, keyboard selection, unknown/tiny/zero ratio boundaries, and 390/900/1280 overflow.
- Repeatability checks are not a comparison score against the concept. No whole-page likeness percentage is claimed.

## Remaining work

The reference contains six additional model rows and quality, speed, and context-capacity fields that the app's usage ledger does not provide. Keep those as genuine data differences. Shared chrome, chart density, lower provider strip and the remaining references still need comparison; the 99 to 100 percent target remains open.
