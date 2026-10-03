# v1.32 — History record details

## Scope and changes

Continue dashboard blueprint v1.1 in the isolated `design/redesign-foundation`
worktree. Refine the existing History detail rail: selected row fill and leading
accent, sticky heading/close control, recorded-kind badge, and token metric tiles.
Recorded metadata, missing values, pricing basis, related-session navigation and
safe metadata copying keep their existing contracts. Native `showModal()` behavior
remains; the dimmed background is inert while details are open. No invented
completion status, prompt, response or raw source payload is introduced.

Changes are in `sections/history.tsx`, `redesign/history-record-details.tsx` and
`redesign/history.css`. Legacy History presentation remains available. The capture
harness adds a History scope and repeated selected-state candidates. The review
builder advances its checkpoint label to v1.32. No dependency, native module,
reader, account, API, database, pet or popup change is introduced.

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

- TypeScript/Vite build passed; the existing chunk-size warning remains.
- English/Thai × dark/light: four normal and four selected captures, each repeated
  in an independent renderer. **All eight pairs are byte-identical**, with the
  original unmasked raster gate unchanged.
- Four detail cases match recorded identity and all six token values to daemon
  data. Enter opens the native modal, one selected row is highlighted, Escape
  closes it, selection clears and focus returns to the triggering record.
- At 390/900/1280 px, document and dialog have no horizontal overflow; the dialog
  fits the viewport, and its heading remains visible after scrolling to the end.
  Tab cannot reach background controls; programmatic background focus is rejected.
- 32 shared-header geometry checks, eight shell checks and 12 font checks passed.
- In-memory synthetic database, no readers, external/write requests or browser
  errors. Browser cleanup uses the harness's normal finally block.

Initial diagnostic runs exposed two test-preparation issues. Chrome's native
modal cycle includes a browser-focus step (active element reported as `BODY`)
after the last link. The final test permits that single step and verifies return
to the modal and rejection of background-control focus. A normal-state repeat
also differed only inside the native range selector's `Today` label (234 pixels).
Both capture passes now perform the same font inspection before screenshots;
the final original screenshot gate passes without masks or relaxed thresholds.

Exact evidence: [verification](redesign-v1.32/verification.json).
Selected candidates: [English dark](redesign-v1.32/history-selected-en-dark.png),
[English light](redesign-v1.32/history-selected-en-light.png),
[Thai dark](redesign-v1.32/history-selected-th-dark.png),
[Thai light](redesign-v1.32/history-selected-th-light.png).
The original concept, earlier normal candidate, and final English dark/Thai light
selected states were visually inspected.

## Package and remaining work

Archive: `tmp/review-bundles/QuotaPulse-v1.32-svG688.zip`, 3,121 files,
199,841,624 compressed bytes. SHA256:
`3dc31593c110ae399afeb4d519a0148744b6c9a1d956d9e42a76c978bfbaaf03`.
The original checkout is clean. Previous v1.31 archive SHA256 remains
`c7f3c8e28299184b187b3acc085b000eba2c5c074906e7d8ed7e041137210523`.

The fresh unsigned Windows review ZIP is recorded in
[archive verification](redesign-v1.32/archive-verification.json); every ZIP entry
is decompressed and compared with the built bundle source. Installed dependency
inventory is in [bundle evidence](redesign-v1.32/bundle-build.json).
Extract into a dedicated fresh folder and use `scripts/start-review.ps1` and
`scripts/stop-review.ps1`. Requires installed Windows x64 Node ABI 127. Readers
remain disabled; synthetic screenshot records are not shipped into app profiles.

This checkpoint covers History detail presentation and Settings shell access.
It is not a new full eight-screen, all-unit/API, clipboard/export/pagination,
native lifecycle or extracted-installation test run. Metadata copying and
related-session routing were retained, not revalidated in this scoped run.
The main History timeline/filter/table density still needs refinement against
the concept. Manual accessibility, visual baseline approval and complete release
candidate gates remain pending. The original checkout and previous ZIP remain
preserved; no claim of complete redesign or production release is made.
