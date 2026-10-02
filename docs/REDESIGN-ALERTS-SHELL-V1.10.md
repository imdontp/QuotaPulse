# Alerts and shared shell checkpoint — 1.10.0

Branch: `design/redesign-foundation`. Tag: `redesign-alerts-shell-v1.10.0`.
Follows [Cost layout 1.9](REDESIGN-COST-LAYOUT-V1.9.md).
Overall visual baseline and release approval remain pending.
Status: **Validated checkpoint**.

## Alerts

- The summary moves into the main column, beside the forecast. Chart, risk list
  and fixed rules are compact on desktop; narrow views stack with all information
  preserved. There are still three fixed thresholds (50/80/95), delivery controls
  and advisory links, with no invented automatic mitigation actions.
- Quota history uses observed timestamps and a labeled percentage scale. Reset
  boundaries and unknown samples break the line. Known zero is a point at zero;
  unknown has no numeric point. The plot's viewBox follows actual container width.
- A keyboard-operated disclosure exposes the complete observed samples, their
  percentages and reset timestamps. Dates and all readings are also in the chart's
  accessible description. This improves access to data; it is not a complete
  screen-reader/contrast certification.
- Same-owner history now refetches after the overview snapshot time changes,
  including SSE/manual refresh. Request cancellation still prevents old owners'
  responses from replacing the current selection. Scope time comes from the
  overview snapshot rather than a separate browser clock.

The occupied fixture adds four synthetic owners, including `[0, unknown, 45, 97]`,
an 85% warning, a 55% notice and an unknown-only owner. English/Thai × dark/light
checks preserve zero/unknown, line breaks, real timestamp coordinates, all fixed
rules and complete history at 1672 × 941. Expanded sample tables and arbitrary
owner/history counts can extend vertically. No fixed-height clipping is used.
See [geometry](redesign-v1.10/alerts-occupied-layout.json) and the four captures.

## Shared shell and Quick Stats

- Desktop sidebar is now 226 px, topbar 60 px, with more compact navigation,
  active treatment and the existing pulse icon/brand. The sidebar can scroll at
  shorter heights. The nine routes, machine scope, language/theme controls and
  command palette remain. A skip link focuses main without losing route filters.
- The topbar shows actual daemon refresh/connection state. This is separate from
  provider/source freshness; it does not claim that all systems are operational.
- Quick Stats has a new authenticated, read-only `/api/runtime-summary` endpoint.
  Its SQL returns counts only: distinct nonempty project names in session metadata,
  distinct nonempty recorded models/providers, and sessions whose source last-seen
  timestamp is within the preceding five minutes and not in the future. Counts
  are machine-wide and independent of the current page filters. They include
  historical/disabled sources and exclude unnamed projects and unknown identities.
- Recent sessions do not claim that a process is running. Stats explain their
  scope, link to relevant pages and use the existing shared refresh coordinator;
  they add no separate SSE connection. On failure, known values remain with a
  stale notice; before an initial success, values are Unknown. Recovery clears
  the notice. Quick Stats is hidden in the compact sidebar and absent in preview.
- The endpoint adds no migration and returns no paths, raw records or credentials.
  Older web assets continue to work with the upgraded daemon. New Quick Stats
  requires the upgraded daemon; an older daemon's missing endpoint leaves its
  values unavailable. Schema/install/package versions are unchanged at this
  implementation checkpoint.

## Validation and boundaries

Validation and artifact hashes are recorded in
[the evidence manifest](redesign-v1.10/validation.json). Coverage includes the
144-case UI matrix, all previous occupied-layout/monetary gates, new occupied
Alerts checks, skip-link focus and route preservation, stats failure/recovery,
authenticated summary API, deduplicated identities and exact five-minute/future
boundaries. Web and daemon builds pass with the existing legacy App chunk warning.

- Web unit tests: 124 passed. Isolated daemon unit tests: 88 passed, two skipped.
- Full `test:history`: 144 matrix cases plus existing occupied fixtures and new
  Alerts checks passed. An additional focused run verifies skip-link behavior
  and summary failure/recovery. Its four occupied captures are included here.
- `test:visual`: 21 preview captures passed, including offscreen motion and no
  daemon/external/preference-write requests.
- `test:runtime`: nine production routes and 5,000 synthetic records passed;
  authenticated summaries, no external/write requests or browser errors.
- `test:desktop`: isolated hidden Electron dashboard/popup, compiled preloads,
  readiness/action IPC and context isolation passed. This is not an installed
  tray or installer test.
- `git diff --check`: passed.

The focused occupied fixture's complete fixed rules end at 934.72 px and history
at 701.53 px in all four language/theme cases. The full harness also passes its
unchanged 941 px thresholds with prior event/advisory state present.

The final daemon unit run uses an isolated `QUOTAPULSE_DATA_DIR`: 88 passed and
two existing live-database vendor checks were skipped. An earlier unisolated run
also executed those two checks through `openForeignRo` against the local database;
it only read model/provider identities and did not modify the database. Subsequent
validation explicitly isolates daemon state. Browser fixtures use in-memory SQLite.
No installed tray/task was replaced and no live provider request was made.

During diagnosis, clicking manual refresh with an empty synthetic adapter list
correctly disabled the fixture's missing sources, making its selected owner vanish.
The same-owner regression now inserts a sample and emits a real SSE data event,
keeping synthetic sources present. The corrected check passes and would fail with
the original selection-only history effect.

## Next

Establish deterministic daemon/browser capture clocks and review stable visual
candidates, then baseline/SSIM. Continue typography, chart data access across other
pages, contrast/screen-reader review and packaged tray/RC gates. This checkpoint
does not certify full concept parity or release readiness.
