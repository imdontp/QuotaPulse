# Overview quota groups v1.54

Continue the real-data reference redesign after insight cards v1.53. Quota
windows now use owner cards with compact window, used-percentage and reset rows.

## Changes

- Group by canonical owner key, with provider/name fallback for legacy preview
  inputs. Owners with identical display names retain separate cards.
- Production already preserves each distinct owner/window through primaryLimits.
  This change groups the existing results; no backend or query expansion was needed.
- Owner headers retain actual vendor icons and show the actual window count.
  They do not infer service health from quota availability.
- Each row shows actual quota used, matching the core and source orientation.
  Unknown values remain a dash, zero remains zero, and readings above 100 retain
  their raw label while the bar caps at 100. Per-window risk and stale treatment
  remain visible. Reset labels distinguish unknown, past and subminute resets;
  the tooltip retains the localized exact timestamp.
- Window selection still routes the selected canonical owner/window to the core
  and history. The scrollable rail supports keyboard access to every row.

## Validation

TypeScript/Vite build passed with the existing large-chunk warning. The final
production-browser manifest records all four English/Thai, dark/light sets.
Four repeated capture pairs passed unchanged tolerance without masks: dark
pairs have 17 changed pixels at maximum channel delta 1; light pairs have 16 at
delta 2. None are byte-identical. Activity bottom remains 989.516px within the
original 992px viewport. This is repeatability evidence, not source likeness.

New memory-database scenarios exercise two canonical owners and eight windows
(5h, weekly, monthly and weekly_opus per owner). Independent API values match
each percentage and bar. An older alternate-origin weekly reading does not
replace the fresher reading. Keyboard scrolling and selection of the last row
match the history response's owner, window, source and origin and the core's
value. Giving both owners the same name leaves two distinct canonical groups.
All scenarios pass at 390/900/1280px without horizontal overflow. Synthetic
samples and owner names are restored afterward. No live database was touched.

The existing scope/source/custom-date, unknown/stale/expired, 0/100/125 percent,
forecast, insight-card, runtime, history-table and focus checks also passed.
No external/write requests or browser errors were recorded. Readers are disabled.
Canonical screenshots use the baseline two 5h windows; the eight-window scenario
is functional evidence, not the baseline screenshot content.

[Verification](redesign-v1.54/verification.json),
[Overview comparison](redesign-v1.54/reference-review.html) and
[source hash](redesign-v1.54/reference-hashes.json). The viewer preserves v1.53
and uses the unchanged original Overview image from v1.44. Other pages were
not recaptured here. Full nine-page browser evidence at v1.52, 124 web tests at
v1.49 and 418 repository tests at v1.44 are separate evidence for those builds;
unit tests were not rerun for this layout change.

Version tag: `redesign-quota-groups-v1.54.0`, isolated branch
`design/redesign-foundation`, original QuotaPulse origin.

## Review bundle

`tmp/review-bundles/QuotaPulse-v1.54-uq6fGG.zip`: 201558255 bytes, 3134 files.
Archive SHA256: `9897d1a3697da48ca1e1b1526273cee1c060d0e9be3f77be1edbc415d50f1c76`.

Bundle and archive details are recorded in
[bundle build](redesign-v1.54/bundle-build.json) and
[archive verification](redesign-v1.54/archive-verification.json).
All canonical capture hashes, the packaged production index and Earth asset
match the tested build. Every ZIP entry is decompressed and compared with
its source by SHA256. Existing runtime packages are copied without installation
or native rebuild. No app profile is included. Requires Windows x64 and Node 22
(ABI 127). Extract into a new dedicated folder, run `./scripts/start-review.ps1`,
and stop with `./scripts/stop-review.ps1`. Readers/account probes are disabled;
a new database has empty usage. This bundle is unsigned. Extracted-runtime,
installer and manual release acceptance were not rerun for this change.

Final diff whitespace check passed. Scoped inspection found no remaining
Node/Chromium test processes. The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`.

## Remaining goal

The eight-page 99–100% source target remains open. Overview runtime/activity
decoration, finer composition and the other page details still need reference
reconciliation and manual visual/release review.
