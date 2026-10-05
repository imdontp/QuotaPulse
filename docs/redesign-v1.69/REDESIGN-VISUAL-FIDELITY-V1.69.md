# QuotaPulse dashboard fidelity candidate v1.69

## Changes

- Rebuilt the Overview metric rail with four compact, icon-led rows to match the source hierarchy: Token Usage, Average token pace, Known cost, and Cached input share. The line traces use the selected `/api/usage` timeline; missing cache observations remain unknown rather than drawing a fabricated zero.
- Keep metric values tied to the selected scope and real daemon APIs. Token Usage is the actual selected-period total; the meter is shown only for a fresh selected quota reading and is labeled as quota use, not a token allowance. Average token pace is the selected-period daily average, not a short-term burn forecast. Known cost combines source-reported and priced API amounts, retaining incomplete-price disclosure. Cache share uses recorded input, cache-read, and cache-write tokens.
- Keep `/api/usage` optional for this rail: if that request fails, the rest of Overview still renders and the affected pace/trend data remains unavailable.
- Increase the metric column to 210px at the desktop capture size, align the icon tiles and traces, and retain the current responsive behavior.
- Extend the production-browser gate to check API range/source parameters, metric values, quota percentage, bucket traces, and Thai/English labels against daemon results.

The production app continues to display actual daemon data. The browser review capture uses the existing synthetic in-memory fixture and does not write concept values to a user database.

## Validation

- `npm run build -w @quotapulse/web` passed. The existing Vite warning remains: the `App` chunk is 532.87 kB, above its 500 kB advisory threshold.
- `npm test -w @quotapulse/web`: **141 passed**.
- Overview repeatability gate: **4 image pairs** across English/Thai and dark/light, all within the unchanged max-channel-2 / 0.0001 pixel-fraction tolerance, with no masks. Three pairs are byte-identical; `overview-en-dark` has 86 changed pixels (0.00547% of the 1,573,312 pixels), maximum channel delta 2.
- One earlier `en/light` replay exceeded the pixel-fraction threshold at 187 pixels. A single-pair rerun and the complete four-pair matrix did not reproduce it (`en/light` was byte-identical). Root cause for that isolated replay remains unconfirmed; no tolerance or application visual was changed to hide it.
- The gate checks actual `/api/usage` values/traces for all four period selections, selected quota data, the complete Runtime Map and quota-history access, keyboard/focus behavior, and 390/900/1280px overflow. This is a repeatability/behavior check, not a source-image similarity score.
- The v1.69 viewer contains fresh Overview captures and repeats. Secondary page screenshots are explicitly carried forward from v1.68 because this checkpoint changed only the Overview metric rail. Source PNG hashes remain recorded in [reference-hashes.json](reference-hashes.json). Open [the side-by-side/overlay viewer](reference-review.html).

The requested **99–100% source-image likeness is not yet achieved**. The metric hierarchy and treatment now follow the concept more closely, but the source labels describe burn rate, estimated cost and ROI while the app can truthfully show selected-period average pace, known cost and cache share. The quota column, globe effects, Runtime Map details, insights and activity contents still differ in visible ways. Do not treat a passing repeated-capture gate as visual acceptance.

## Next fidelity pass

Continue against the supplied reference PNGs region by region, with the Overview quota cards and remaining Overview content as the next target. Preserve actual daemon values and status semantics; align spacing, card proportions, icon treatment, color, and hierarchy where the source supports them. Keep pet/popup redesign out of scope.

## Local review package

- Review ZIP: C:\Users\TH12367283\Projects\QuotaPulse\tmp\worktrees\redesign-foundation\tmp\review-bundles\QuotaPulse-v1.69-twmInI.zip
- SHA-256: ff61e566cc22cd3e3295644cfe877ef3752f758ede7dec76bd9c7f5250d3026b
- Archive verification passed for all **3135 files**; compressed size is 192.2 MiB. The package has no user application profile and is a local review build, not a production installer. Readers/probes are disabled and a new review database starts empty.
- Build/archive manifests are in [bundle-build.json](bundle-build.json) and [archive-verification.json](archive-verification.json). The package requires external Node ABI 127 and was built with v22.13.1.
