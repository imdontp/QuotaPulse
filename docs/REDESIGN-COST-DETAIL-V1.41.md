# Cost detail refinement v1.41

Continue the original eight-page dashboard and Settings redesign goal using real
application data. This checkpoint refines Cost after directly comparing the
current production capture with the supplied `refs/cost.png`.

## Changes

- The desktop trend now occupies seven of twelve columns; models occupy five.
  The reference's wider monetary/token plot is restored to 190px height instead
  of the previous 125px. The independent axes, exact token bucket positions and
  monetary column values retain their existing meanings.
- Coverage moves into the trend footer. Monetary basis remains in the visible
  selector, total summary and full native chart table caption. Other-basis and
  reference-priced call counts remain available; unknown values stay Unknown.
- Model and project tables gain actual amount-share bars, alternating subtle
  row backgrounds and tinted headers. A zero total produces no filled share bar.
  Project links gain a folder identity tile; provider marks retain recorded data.
- Desktop project/session cards use a bounded table scroll area rather than
  extending the entire page. Every loaded row remains present and the scroll
  containers can receive keyboard focus. All links retain their actual filters.
- Insights use side-by-side labels/values and cyan/violet surface treatment,
  matching the reference composition while retaining recorded coverage facts.
  No unsupported savings recommendations or forecasts are introduced.

The first geometry check exposed excess vertical space. Measurements identified
the inherited grid gaps and insight label/value stacking. Those were corrected
without reducing the 190px plot or changing the existing viewport assertion.

## Validation

Web TypeScript/Vite production build passed, with the existing large-chunk
warning. The final Cost browser run passed English/Thai and dark/light:
four pairs, all byte-identical, without masks. API/native collapsed content
bottoms were 927.28125px in the 941px reference viewport; the unpriced native
scope was also within bounds. The rendered 190px plot was visually inspected.
The gate independently checks API/native/unpriced scopes, amount/token axes,
share bar fractions against daemon aggregates, every session row, the last
session link's keyboard reachability and visibility within its scroll container,
full chart tables and 390/900/1280 overflow.

[Browser evidence](redesign-v1.41/verification.json) records Cost scope only.
No other page or shared renderer changed in this checkpoint. The
[reference viewer](redesign-v1.41/reference-review.html) labels Cost v1.41 and
the seven unchanged pages' v1.40 captures separately; those pages were not
recaptured here. Source images are unmodified copies of the original eight refs.

Version tag: `redesign-cost-detail-v1.41.0` on `design/redesign-foundation`,
using the original QuotaPulse origin. Runtime bundle/archive results follow below.

## Review bundle

- `tmp/review-bundles/QuotaPulse-v1.41-Uig1YK.zip`, 199851258 bytes, 3132 files.
  Every ZIP entry was decompressed and SHA256-compared with the source bundle;
  no application profile is included. The production index hash matches the
  Cost-tested build recorded in the browser manifest.
- SHA256: `a91a910716d96ce0b509a7f8dde36c479bb14761df4e510c4417f127c8229b3c`.
- Existing 87 runtime packages were copied without dependency installation or
  native rebuild. Requires Windows x64 and installed Node ABI 127 (built using
  Node 22.13.1). Extract to a new dedicated folder; use
  `./scripts/start-review.ps1` and `./scripts/stop-review.ps1`.
- Readers and account probes are disabled; a fresh review database is empty.
  This is an unsigned review bundle. Extracted runtime/installer and broader
  release gates were not rerun in this Cost styling checkpoint.
- Scoped process inspection found no remaining test Node/Chromium processes.
  The original checkout remains clean at
  `be8e145039247958992fa7673a9c77e1bff35db1`.

[Bundle build](redesign-v1.41/bundle-build.json) and
[archive verification](redesign-v1.41/archive-verification.json).

## Remaining goal

This checkpoint does not establish the requested 99–100% visual likeness. Cost
summary-card trends/height, finer typography and identity decoration still need
comparison; History, Alerts, other per-page details, Settings and the broader
release acceptance remain part of the complete goal. Repeatability evidence is
not source-reference similarity. The original checkout remains preserved.
