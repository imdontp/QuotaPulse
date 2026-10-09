# Consolidated eight-page source review and Models lighting

Status: build and457 repository tests passed; full40-pair verifier recovered and validated.
This is a source-review candidate, not visual acceptance or release readiness.
The complete goal remains all eight original pages with real data and all23
blueprint overrides. Base: f2d72b9/v1.85.42.

## Implementation

Models selected DeepSeek detail uses the existing official monochrome SVG shape
with a local unique gradient(#2585ff → #2166ff → #1747eb). Only exact selected
provider/maker identity `deepseek` receives this treatment. Other table, shared
and selected provider marks retain their existing artwork. Dark plate uses
navy local lighting and a3px blue glyph glow. Plate56px/glyph38px, all facts,
provider/maker separation, filters, keyboard selection and geometry remain.
Root inspected fresh EN/Dark against the original. Source sampled glyph pixels
include#1b6aff/#1e60fa/#2766fc; plate samples#081230/#081436/#06112f. This improves
the demonstrated solid-violet mismatch; it does not certify exact artwork.

`measure-reference-parity.mts` now accepts an explicit original page name, adds
source/candidate SHA-256 and no-mask/diagnostic metadata. Overview retains its
existing source region boxes; other pages use their native header/sidebar/
workspace boxes, avoiding misleading Overview region labels. No rescaling,
masking or metric/tolerance change was introduced.

## One build and all eight original references

`npm run build -w @quotapulse/web`: session6353 exited0,2980 modules; existing
App chunk-size advisory remains. Production-index SHA-256:
`a65981fc09820fffe0d88a988568effc3174d13effca1ab3ba1c4074dc527b90`.
[Build/source provenance](build-provenance.json).

[Source hashes](source-hashes.json): all eight copied originals match the PNG
bytes inside authoritative blueprint v1.1. Archive hash:
`28bc63571ddf7ecda1e12e8821c6184378ccfe6c3a599d6ccec29bf17fedb054`.
Overview1586x992; seven other source pages1672x941. The
[viewer](reference-review.html) preserves native dimensions and provides all
eight pages, four language/theme states and selected/main History.

All eight EN/Dark original-source diagnostics/heatmaps are recorded in
[comparison index](source-comparison-index.json). Reference and actual images
are unmasked: factual numbers, captions, series and overrides remain included.
Raw local-luminance SSIM ranges approximately.472–.543 and must not be converted
into a user likeness percentage or approved-baseline score. It measures the
complete original image including mandatory factual substitutions. Styling,
composition and artwork still need region-level review and correction.

Models before/after raw original SSIM is.5393214094/.5401577019. The before image
is the historical41 candidate; the after image is the frozen43 candidate. This
narrow gain is not approval of the whole page. Both reports record input hashes.

## Validation

`npm test`: session67637 exited0. Daemon101 + web158 + tray198 =457 passed,
zero failed/skipped/cancelled. These are current43 source results, superseding
historical40 counts for this candidate. No dependencies or database changes.

Default `npm run test:stable`: session80972 produced the final full verifier.40 pairs: nine
routes×four language/theme variants plus four selected-History variants.
The harness executes built production assets with fixed clock, API fixtures,
fonts, DPR1, Bangkok timezone, reduced motion and independent browser passes.
Thirty pairs are byte-identical; ten meet the unchanged raster tolerance. All80
main/repeat PNG hashes were independently checked against the final manifest;
all eight source diagnostics bind to those exact EN/Dark captures. The process
handle is no longer available after the session boundary, so its terminal exit
code is not recovered or asserted. The final verifier is written only after
all checks/pairs complete. [Full verification](verification.json). No masks or
tolerance adjustments. [Application region evidence](reference-regions.json)
retains the distinction from still-open source geometry/delta acceptance.

The42 authenticated workflow remains historical on its own source/build, not
relabelled as43 execution. New source changes here affect selected artwork and
read-only diagnostic tooling; full current workflow/release evidence is still
required at final acceptance.

## Requirement audit and next substantive correction

[Draft override ledger](OVERRIDE-COVERAGE.md) maps all23 authoritative overrides
and meaningful regions of all eight pages to implementation/API/test sources.
It distinguishes factual substitutions, data-dependent differences, decorative
defects and unresolved evidence. It is not named reviewer approval.

**Confirmed OVR-003 gap:** selected-scope QuickStats counts are required, while
the implementation deliberately reads/discloses machine-wide data. OVR-002's
static This machine control is not a separate count-scope exception. Correct
scope propagation and backward-compatible optional scoped summary reads next;
retain no-query old-client behavior and five-minute observed-session caveat.
Truthful disclosure alone does not make that contract difference compliant.

Source geometry/deltas for every meaningful region, reviewer/baseline approval,
requirement/state mappings, >2000-event/performance evidence, final UI/visual/
workflow/desktop recovery/rollback and manual accessibility acceptance remain
open. Current repeatability checks do not prove99–100% likeness. Goal active.
