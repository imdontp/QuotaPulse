# Native sidebar interiors v1.85.52

**Validated scoped implementation. Full concept likeness and release acceptance remain open.**

Final production index: `a7cb8c83cef42ceb390b6031e4a7938e3b51f94dee375aa451690f19deb90916`. Isolated branch `design/redesign-foundation`; base `a9cd137`.

## Changes

Native production QuickStats now use measured per-page padding, row cadence, blue typography, darker surfaces and decorative folder/cube/headset/session marks. Text bearings and the English Active Sessions capitalization follow refs. Footer phrase spacing, Overview text inset, logo glow and actual-version color are adjusted. QuotaPulse uses a cube in both project card and detail, while other actual projects retain folders. The active native navigation edge uses a tiny transparent rasterized copy of the original vector rim, whose SVG source is retained. Hit areas, focus outlines, active semantics, APIs and scope/pause guards are preserved.

## Validation

- Final build and 170 web tests passed (session 82911, terminal exit 0).
- Focused Models EN/dark and TH/dark original repeat gates passed.
- Final full 40-pair matrix passed (session 31387): 35 byte-identical pairs; remaining pairs satisfy the original unmasked tolerance. All 80 archived PNG hashes verified.
- Native EN/dark and corrected TH/light checks passed for all eight pages, default/closed/open More, all nine links and compact widths 1280/900/390.
- The initial native thaiLight command repeated EN/dark due to mismatched environment names. Its log is retained; a separate corrected native command proves current TH/light. The archived browser runner is corrected for future runs.
- Scoped QuickStats HTTP workflow and existing 16-combination UI/legacy/popup/recovery compatibility gates passed.
- Final count/label vertical paint MAE: 0.8750px across 64 measurements. This is not a likeness percentage.
- Two earlier full matrices failed (18/max29 and 34/max20 pixels/delta); an intermediate focused gate also failed (12/max20). Failure evidence is retained; clean-process diagnostic comparisons did not reproduce either failure. No confirmed raster root cause is claimed.

[Full source comparison](reference-review.html) · [Sidebar comparison](sidebar-review.html) · [Final measurements](after-measurements/REVIEW.md) · [Corrected evidence register](EVIDENCE-CORRECTIONS.md) · [Provenance](build-provenance.json).

## Remaining acceptance work

Label bearings/color/baselines, Overview footer inset, pulse logo and atmospheric texture, and main-page paint/geometry still require source comparison. Named approved baseline/SSIM, bounded History effort performance, manual accessibility, final desktop/recovery and packaged release gates remain open. Real data and actual version remain authoritative; original mock numbers are not substituted. Repeatability does not establish 99–100% source likeness.

Native Overview fixtures use the default 5h/83% scope; full matrix uses canonical monthly/72%. Providers/Cost default expanded More follows OVR-001; closed source measurements are labelled.
