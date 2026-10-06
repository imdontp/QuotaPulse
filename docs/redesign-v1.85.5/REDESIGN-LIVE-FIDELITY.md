# QuotaPulse redesign fidelity checkpoint v1.85.5

**Status: implementation in progress; not approved visual sign-off.** This checkpoint fixes clipped provider/model names in the Live minute matrix. It does not certify overall concept parity.

## Reference and visual evidence

- Blueprint reference: `live.png`, 1672 × 941. The original v1.1 Overview reference manifest is verified in the v1.85.4 report.
- [Concept reference](live-concept.png)
- Before: [Live production capture](live-before-en-dark.png)
- After: [Live production capture](live-after-en-dark.png)
- Full test evidence: [live-capture-verification.json](live-capture-verification.json)
- Captures use an isolated synthetic in-memory database. The running app continues to display daemon-backed data.

## Change

The provider/model matrix gave its model-name column a 74px minimum while allowing minute bars to grow to 180px. At the concept-sized desktop viewport this left too little room for names such as “DeepSeek V4.1”. The desktop grid now gives labels a 104px minimum and caps the minute strip at 150px. The compact container layout still moves the strip below the label and total.

The production capture check now measures model text width directly and fails if any canonical desktop label is clipped. It records these measurements at 390px, 900px, 1280px, and the 1672px reference viewport.

## Validation

- `npm run build -w @quotapulse/web` passed. Vite reports the existing 532.87 kB App chunk warning.
- `QUOTAPULSE_CAPTURE_SCOPE=live npm run test:stable` passed across English/Thai and dark/light: four screenshot pairs, all four byte-identical on repeat, no masks.
- All six canonical model labels fit at 1672px in every language/theme combination (`scrollWidth` equals `clientWidth`). Responsive overflow, Live density, refresh behavior, and token-flow checks passed. The owned diagnostic state also exercises unknown and empty names.
- `git diff --check` passed.

## Remaining work

Continue the measured redesign against all eight blueprint references. The v1.85.4 local 11×11-window Overview SSIM diagnostic remains 0.5245, well below the blueprint's 0.985 target; that local metric is diagnostic and is not the blueprint-approved comparator. Keep the project in progress until the full reference set and production-data behavior have been reviewed.
