# Eight-page original-reference repair checkpoint

This is a validated incremental implementation checkpoint. Original-reference
likeness and release acceptance remain open. See [source changes and remaining
differences](SOURCE-CHANGES.md), and [compare all eight pages](reference-review.html).

## Validation

- Production web build passed (session 24359, exit 0). Existing bundle-size advisory remains.
- `npm test` passed (88831, exit 0): daemon 105, web 162, tray 198; **465 tests**, no failures.
- `npm run test:stable` passed (63491, exit 0): **40 pairs / 80 PNGs**, nine routes plus
  selected History in EN/TH and dark/light. 31 pairs are byte-identical;
  remaining pairs meet the unchanged unmasked raster tolerance. All 80 PNG hashes
  were independently verified. [Capture manifest](capture-verification.json).
- Authenticated eight-page workflow passed (83997, exit 0), with filters, scopes,
  pagination, pause, quota runway, drill-down and 16 responsive combinations across
  nine routes. Local authenticated HTTP, in-memory SQLite and Vite; browser, server,
  daemon and database teardown completed. [Workflow](workflow-verification.json),
  [responsive matrix](workflow-responsive-matrix.json), [Cost compatibility](workflow-cost-route-compatibility.json).
- `npm run test:ui` logged successful completion, including existing popup preference,
  loading, empty, unavailable and recovery behavior. Its combined session 75572
  exited 1 because the following old Preview check failed; this is not recorded
  as a combined pass. The corrected standalone Preview run 98010 exited 0 with
  21 screenshots and storage/network/focus/responsive/motion checks.
  [Preview evidence](preview-verification.json).
- Eight original-reference diagnostic runs passed (96486, exit 0). References
  match the user's current external refs; report and image SHA-256 bindings were
  checked against these exact captures. [Source comparison index](source-comparison-index.json).

Production-index SHA-256: `aaf39be820ed7c01144c7c228e653e38d3d52ccb2b8c662a4fc4e2b08a84c162`.
[Build/source provenance](build-provenance.json) binds commands and source hashes.
Initial failed runs are retained alongside corrected runs; see SOURCE-CHANGES.md
for their causes and fixes. No visibility, data correctness or raster thresholds
were weakened.

## Practical limits and next work

Repeat captures prove repeatability, not likeness to the concept. Unmasked source
diagnostics include real-data and approved blueprint override differences; their
SSIM is not a user-facing percentage or an approved visual baseline. Current
captured records are isolated API test data, not the user's production database.

Next implement the measured Overview caption correction, reduce excessive globe
ring haze, and restore Alerts risk-row icon/severity hierarchy. Live chart
prominence, Models detail styling and Cost caption hierarchy remain open. The
complete goal still requires source-region review, baseline approval, final
accessibility/desktop/release evidence and reconciliation of the 23 overrides.
No 99–100% likeness or final release readiness is claimed here.
