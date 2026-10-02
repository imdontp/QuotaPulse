# v1.27 — shared dashboard header

## Objective and scope

Continue the approved dashboard blueprint v1.1: eight concept screens plus
Settings. This checkpoint refines the shared brand/header structure. Pet settings
and popup remain compatibility scope; no pet redesign, native recovery or installer
work is introduced. Work stays on `design/redesign-foundation` in its isolated
worktree, using the existing origin and a new checkpoint tag.

## Changes

- `packages/web/src/redesign/shell.tsx` moves the existing QuotaPulse brand into
  the full-width shared header. The sidebar starts below that header. The existing
  daemon connection, current page, machine scope, navigation palette and language/
  theme controls retain their behavior and factual labels.
- `packages/web/src/redesign/overview.css` uses a shared sidebar-width variable,
  two-row root grid, 60 px header, 22 px brand text and a wider desktop navigation
  trigger. Desktop sidebar height accounts for the header. Narrow layouts retain
  icon navigation. Main content starts at its previous vertical position; the
  occupied Overview density gate remains unchanged.
- `scripts/check-stable-captures.mts` checks header/brand/sidebar alignment,
  nine navigation destinations, exactly one current page and document overflow
  at canonical, 390, 900 and 1280 px widths across all routes/languages/themes.
- `scripts/build-review-bundle.mts` advances only the review checkpoint label.
  Existing installed dependencies and popup compatibility assets are preserved.

The wider trigger says “Go to” / “ไปยังหน้า” and opens the existing page navigator.
No unsupported global data search, account selector or service-health claim is added.
No data queries, calculations, database schema, dependencies or native ABI changed.

## Validation — Validated for this scope

Commands:

```powershell
npm run build -w @quotapulse/web
node --import tsx scripts/check-stable-captures.mts
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Result |
| --- | --- |
| Production build | TypeScript/Vite passed; existing large-chunk warning remains |
| Canonical captures | Eight screens × English/Thai × dark/light, two independent passes |
| Repeatability | 32/32 pairs byte-identical, no masks |
| Shared header | 144 geometry cases passed, including Settings |
| Geometry | Header 60 px; sidebar 226/66/48 px at desktop/tablet/mobile breakpoints |
| Shell/keyboard | 36 route/language/theme checks passed, including palette focus/inert behavior |
| Fonts | 36 checks passed with bundled font provenance |
| Existing behavior gates | 8 chart, 24 model/cost, 8 quota, 4 runtime and 4 Overview layout checks passed |
| Safety | In-memory synthetic DB; no external/write requests or browser errors |
| Cleanup | Zero scoped capture/build processes; original checkout clean |

Exact measurements, browser configuration and hashes are in
[verification](redesign-v1.27/verification.json). Representative candidates:
[Overview Thai light](redesign-v1.27/overview-th-light.png),
[Overview English dark](redesign-v1.27/overview-en-dark.png),
[Models English dark](redesign-v1.27/models-en-dark.png).
All 32 canonical candidates are retained in `docs/redesign-v1.27`.
These views were visually inspected for header placement and readable controls.

## Review package

Archive: `tmp/review-bundles/QuotaPulse-v1.27-bivDRz.zip`.
3,120 files; 199,839,063 compressed bytes.
SHA256: `3c52aaaa83871eb7ba1e464d21fbfac10fb22e9c0b2fc8d76d0784881cbead0b`.

[Bundle inventory](redesign-v1.27/bundle-build.json) records 87 installed runtime
packages. [Archive verification](redesign-v1.27/archive-verification.json) records
decompression and SHA256 comparison of every entry against the built bundle.
No app profile is included. The previous v1.26 archive remains unchanged, SHA256
`9fc13ab96d085693429cf489330963223c441709650a9d450512ee84e921d0ba`.

Extract into a fresh dedicated folder, then use `scripts/start-review.ps1` and
`scripts/stop-review.ps1` for that instance. Requires Windows x64 and installed
Node ABI 127. Readers remain disabled; an empty review database is expected.
The synthetic capture fixture is not shipped as production records.

## Limits and next dashboard work

These are review candidates, not approved visual baselines or measured concept
SSIM parity. Keep refining the remaining screen-specific concept geometry,
typography, globe/waveform treatment and empty/long states. Establish a reviewed
baseline before the blueprint's regional/SSIM gates. Manual keyboard/screen-reader
review and full RC gates remain pending.

This run validates the production web build and full existing browser capture
matrix. It does not rerun all unit/API suites or native desktop lifecycle/installer
checks. ZIP entry validation compares the built bundle; it is not a second
extracted-installation runtime test. No full-release readiness claim is made.
