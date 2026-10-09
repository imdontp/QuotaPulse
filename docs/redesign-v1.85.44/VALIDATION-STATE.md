# Selected-scope Quick Stats (OVR-003)

This checkpoint corrects the selected-scope requirement found in the v1.85.43
blueprint audit. It continues the eight-page real-data dashboard redesign.
It is not original-reference visual acceptance or release readiness.

## Implementation

- `/api/runtime-summary` accepts an optional explicit usage scope through the
  shared strict scope parser. No-query requests retain legacy machine-wide
  counts, including metadata-only projects. No schema or database migration.
- Scoped counts deduplicate exact nonempty project, model and routed-provider
  identities across matching usage. Sessionless usage remains included.
  Recent sessions additionally require an observation within daemon now minus
  five minutes through now; this does not prove a process is running.
- Overview, Live, Projects, Models, Cost and History pass their committed usage
  scope into the shared sidebar. Providers, Alerts and Settings retain explicitly
  disclosed machine scope because they have no selected recorded-usage scope.
- A pending scope shows unknown counts; obsolete responses cannot restore old
  counts after A/B/A navigation. Parent scoped reads also reject obsolete results.
- History uses applied filters, not dirty form controls. Live and History pause
  their usage counts with the displayed snapshot. Pause transitions invalidate
  pending requests; connection and current quota risks remain independent.
- Count links preserve the complete scope where the destination supports it.
  Unsupported destinations retain their labels without an actionable link,
  avoiding silent scope broadening. Global navigation remains available.
- EN/TH explanatory text changes are limited to one added key each. Shared
  layout, CSS, reference assets and raster tolerances are unchanged.

## Validation

Production web build: passed, session 13592 exited 0. Existing bundle-size
advisory remains. `npm test`: passed, session 53838 exited 0, covering daemon,
web and tray.

The dedicated production-browser workflow tests legacy machine counts,
selected source/time counts, pending-state isolation, delayed A/B/A responses,
complete-scope navigation, History drafts and pause/resume, and Live pause.
It uses an isolated in-memory database and authenticated local HTTP.
An intermediate Live assertion read the preceding History count during hash
navigation; the check now waits for the Live destination before its counts.
Final dedicated browser run: session 27955 exited 0. The corrected reproduction
passes, including a genuinely delayed pre-pause response and both Live/History
pause/resume. [Browser evidence](quickstats-verification.json), with three
explicit EN/Dark screenshots in `quickstats/`. Browser capture confirms dark
theme rather than relying on the operating system default.

Production-index SHA-256:
`d58d4a9dd435273033648314bbdc12a3c4cc957355d544a967e1501af44d6e30`.
All-page EN/Dark capture: session 94100 exited 0. Ten pairs cover nine routes
and selected History; all 20 PNG hashes were independently checked against the
final verifier. Seven pairs are byte-identical; three meet the unchanged raster
tolerance. This is one language/theme, not the full 40-pair matrix.
[Capture evidence](capture-verification.json).

[Original-reference viewer](reference-review.html) overlays all eight original
refs with these exact EN/Dark captures at native size. Its source diagnostics
include real-data and override differences and do not express a likeness percent.
Authenticated workflow: session 93241 exited 0. History/Overview/Projects/Live/
Providers/Models/Cost/Alerts E2E passed with filters, pagination, pause, quota
runway, drill-down and responsive checks. The responsive matrix covers 16
language/theme/width combinations, each with nine routes. Browser, Vite, daemon
and database teardown completed. [Workflow evidence](workflow-verification.json),
[responsive matrix](workflow-responsive-matrix.json),
[Cost compatibility](workflow-cost-route-compatibility.json).

## Remaining goal

The historical v1.85.43 all-eight-source comparison and 40-pair matrix belong to
that earlier build. Current scoped checks do not replace four-variant final
capture evidence, source-region geometry/deltas, review of remaining decorative
differences, approved visual baselines, manual accessibility, or final desktop
compatibility and release gates. No 99–100% likeness claim is made.

Next: use the corrected real-data build for the original-reference region
comparison and continue repairing the eight pages' remaining composition,
color, artwork and typography differences.
