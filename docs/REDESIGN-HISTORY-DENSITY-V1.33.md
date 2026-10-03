# v1.33 — History density

## Scope and implementation

Continue blueprint v1.1 on the isolated `design/redesign-foundation` worktree.
The preceding normal History candidate used most of the desktop viewport for
the timeline and filters; pagination followed all 37 displayed fixture records.
This checkpoint compacts the timeline, filters and occupied table while retaining
all metadata fields and the existing 50-record API page size.

- `history-timeline.tsx`: reduce SVG height from 148 to 112 px and adjust plot/date
  coordinates together. Bucket selection, recorded-time semantics, scale maxima,
  totals, effort categories, pricing coverage and partial-breakdown notes remain.
- `history.css`: desktop range/summary/filter spacing is compact; all nine filter
  controls occupy one row at widths of at least 1280 px. Cost basis and amount
  share a table line. The table has a 230 px scroll area and sticky column headers.
  Narrow layouts retain wrapping fields and the existing horizontal table scroll.
- `history.tsx`: the redesign table has a named, keyboard-focusable region and
  dedicated card hooks. It renders every row in the existing response; it does
  not truncate the dataset or change query/export/pagination contracts.
- `check-stable-captures.mts`: add occupied-card geometry, complete response-row
  count, keyboard End scrolling, last-record detail opening and focus restoration.
  Existing repeated normal/selected capture and responsive detail/shell gates stay.
- Review bundle label advances to v1.33; no dependencies or native modules change.

## Validation — Validated for this slice

```powershell
npm run build -w @quotapulse/web
$env:QUOTAPULSE_CAPTURE_SCOPE = 'history'
node --import tsx scripts/check-stable-captures.mts
Remove-Item Env:QUOTAPULSE_CAPTURE_SCOPE
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
git diff --check
```

| Check | Final result |
| --- | --- |
| TypeScript/Vite build | Passed; existing large-chunk warning remains |
| Occupied desktop, English/Thai × dark/light | Card including pagination ends at **936.796875 px**, inside unchanged 941 px gate |
| Visible records | Five complete rows; remaining rows accessible by scroll; sixth row is partly visible |
| Complete data | All **37 today-scope fixture records** retained (38 fixture records overall) |
| Keyboard | Region scrolls with End; last record opens with Enter; Escape restores its focus |
| Repeated captures | **8/8 pairs byte-identical**, normal and selected states; no masks or changed tolerance |
| Existing detail checks | Four API-matched metadata/token cases; native modal background isolation and first-record focus restoration |
| Responsive/shell/fonts | 390/900/1280 detail checks, 32 header cases, eight shell and 12 font checks passed |
| Safety | Synthetic in-memory DB, no readers, browser errors, external or write requests |

Initial density validation measured pagination at 1008.796875 px. Filters were
then placed on a single desktop row, table cost labels combined on one line and
the scroll area reduced. The unchanged 941 px gate passed after rebuilding and
rerunning all scoped checks. No failed-run screenshot is used as final evidence.

Exact results: [verification](redesign-v1.33/verification.json).
Candidates: [English dark](redesign-v1.33/history-en-dark.png),
[English light](redesign-v1.33/history-en-light.png),
[Thai dark](redesign-v1.33/history-th-dark.png),
[Thai light](redesign-v1.33/history-th-light.png).
Final English dark and Thai light normal states were visually inspected.
Selected-state candidates are also stored in this evidence folder.

## Package, limitations and next step

Archive: `tmp/review-bundles/QuotaPulse-v1.33-536EUe.zip`, 3,121 files,
199,841,993 compressed bytes. SHA256:
`613fe537c94eb50f67ba87231a05a4fc762e9115b46d4884aa60499034155396`.
Original checkout remains clean; previous v1.32 ZIP SHA256 remains
`3dc31593c110ae399afeb4d519a0148744b6c9a1d956d9e42a76c978bfbaaf03`.

Fresh bundle inventory: [bundle evidence](redesign-v1.33/bundle-build.json).
ZIP entry verification: [archive evidence](redesign-v1.33/archive-verification.json).
Extract into a dedicated fresh folder and use `scripts/start-review.ps1` and
`scripts/stop-review.ps1`. Requires Windows x64 and installed Node ABI 127.
Readers remain disabled; screenshot fixture records are not shipped as app data.

This is an unsigned review checkpoint. It covers History and Settings shell access,
not a new full eight-screen run, export/clipboard/pagination behavior suite, native
lifecycle or extracted-installation runtime test. Original application and earlier
ZIPs are preserved. Five visible rows are a measured improvement, not parity with
the original concept's ten displayed rows. Main density now passes its viewport
gate; manual accessibility, long-label/custom-range review and approved visual
baselines remain pending. Continue remaining dashboard refinements (including
Alerts spacing), then the combined release-candidate checks.
