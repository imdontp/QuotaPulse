# Providers reference repair v1.39

Continue the complete dashboard reference-fidelity goal with production data.
The supplied Providers image uses four card columns, aligned quota rows and
percentage labels above its comparison bars. Previous captures had smaller
cards, full-width selected-owner details and percentages below the bars.

## Changes

- Desktop cards retain four columns, start below a 68px header and use 360px
  minimum height when quota readings exist. Quota-less cards use a shorter
  190px treatment. Card count and quota-window count remain data-driven.
- Each quota row has its window at left, actual percentage/bar in the middle
  and reset countdown at right. Reading origin and latest observed/confirmed
  times among the displayed windows fill the card's metadata section. Existing
  expiry/future/null treatment remains.
- Actual account state has a pill and dot; reader freshness has semantic dots.
  Card gradients and header/section icon tiles follow the reference treatment.
- Full selected-owner reading details use a native disclosure. It starts closed
  for the default overview and opens on owner selection or explicit URL owner/
  source scope. Keyboard toggling retains all reading metadata and alternative
  readers. Management/diagnostic links retain their existing destinations.
- Comparison percentages sit above the actual bar tops, with exact-owner marks
  beside labels below the plot. Reader rows use the canonical harness-owner mark.
  These are reader/account facts, not invented provider latency or service health.

No new requests, dependencies, daemon behavior or account readers are introduced.
Real billing plans, quota token denominators and service response times are not
available from these API fields, so no values are manufactured to fill the image.

## Validation approach

The Providers browser scope independently checks published quota percentages,
proportional bars, percentage/owner geometry, keyboard owner selection, native
details open/close, overflow at 390/900/1280 and unknown/expired/tiny/zero states.
It retains the unmasked repeatability tolerance and synthetic memory DB.
The first scoped layout run passed four byte-identical pairs. Final evidence
also covers the reading-metadata and quota-less-card refinements.

The final web TypeScript/Vite build passed with the existing chunk-size warning.
`QUOTAPULSE_CAPTURE_SCOPE=providers node --import tsx scripts/check-stable-captures.mts`
passed four byte-identical pairs, covering English/Thai and dark/light. Comparison
and reader panels end at 911.875px in the 941px canonical viewport. Inspector
selection and keyboard toggling, recorded percentages and unavailable/expired/
tiny/zero behavior passed. See [verification](redesign-v1.39/verification.json).
The complete eight-page suite was not rerun here; its v1.38 evidence is preserved.
The packaged index matches the tested index SHA256:
`d140b51504e9fab1a822f2ba369a99a3eb8bc8f076852ae1d0a90b7867c95767`.
No dependencies were installed or native modules rebuilt.

## Review artifact

`tmp/review-bundles/QuotaPulse-v1.39-XiUY38.zip` is the final unsigned Windows
x64 review bundle, using external Node module ABI 127 and 87 existing runtime
packages. It contains no app profile; readers are disabled. All 3,129 entries
were decompressed and SHA256-compared with their bundle sources. ZIP size:
199,848,438 bytes. SHA256:
`eeb5b992a2be10bf2faa30e3f4374c4a1a9ff29853446d3cfb48e6b1d1ecf716`.
See [inventory](redesign-v1.39/bundle-build.json) and
[archive verification](redesign-v1.39/archive-verification.json).
Extract into a fresh dedicated folder, then run `scripts/start-review.ps1`.
`scripts/stop-review.ps1` stops that review instance. Fresh profiles have empty
usage; the capture fixture is a separate synthetic in-memory database.

Checkpoint tag: `redesign-providers-reference-v1.39.0`. Work remains on the
isolated redesign branch with the existing QuotaPulse origin. Scoped process
inspection found no remaining build/capture processes. The original checkout
remains clean at `be8e145039247958992fa7673a9c77e1bff35db1` and old artifacts
are preserved.

## Reference inspection

[Reference review](redesign-v1.39/reference-review.html) starts on Providers.
Providers uses final v1.39 captures; the seven unchanged pages retain v1.38
captures, clearly labeled in the viewer. Original reference images and their
SHA256 evidence are retained. Side-by-side/overlay viewing is a review aid,
not a measured likeness score or approval.

The 99–100% target remains open. Typography, detailed window/plan treatment and
the remaining [per-page gaps](REDESIGN-REFERENCE-REPAIR.md) need further work.
Full release regression, extracted runtime/installer verification and manual
screen-reader review were not rerun in this scoped checkpoint.
