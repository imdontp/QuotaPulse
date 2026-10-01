# Projects layout checkpoint — 1.8.0

Branch: `design/redesign-foundation`. Tag: `redesign-projects-layout-v1.8.0`.
Follows [Live layout 1.7](REDESIGN-LIVE-LAYOUT-V1.7.md).
Status: **Validated checkpoint**. Overall visual/release approval remains pending.

## Changes

- Ranking moves from below the project cards into the right rail, directly below
  selected-project details, matching the concept's structure. Ranking buttons
  select a project and reset its session pagination; selected state is announced.
  Buttons have at least 24 × 24 px hit areas, checked in the occupied fixture.
- Desktop cards, summary metrics, breakdown and panel gaps are more compact.
  Four count metrics share one row, while native cost and API value stay separate.
  The duplicated identity paragraph is removed; the full identity remains in the
  selected heading and Details tab. The detail panel no longer sticks over the
  ranking as the page scrolls. Narrow layouts retain stacking and full text.
- Projects now uses the existing cost-coverage component for priced values.
  A native or API subtotal gets `+` when it covers only some weighted calls,
  including when other calls have a different known price basis. Existing
  Not reported / Unavailable labels remain for absent basis data. The title and
  screen-reader explanation give covered/total calls. Projects count labels and
  shared price descriptions now say Calls rather than Call records; aggregate
  records can represent more than one call.

Source changes: `projects.tsx`, `projects.css`, the count label in `cost-value.tsx`
and the browser harness. No daemon, schema, dependency or tray changes.
Original checkout remains clean at `be8e145`; the implementation uses its existing
isolated worktree and branch.

## Occupied fixture and geometry

After the original functional/matrix/Live flow, the harness adds six synthetic
projects and 30 sessions. Together with the original data this gives eight
project cards. The selected project has 25 sessions, 76 weighted calls and three
source/provider/model combinations. Its native subtotal is `$0.90+` for 36/76
calls; computed/estimated API value is `$3.20+` for 40/76 calls. Thai formatting
uses `US$` for this USD fixture. These values are recorded fixture facts, not
invoices or budgets. Extra records are removed after the checks.

| Region, at 1672 × 941 | Bottom in all four language/theme cases |
| --- | --- |
| Sixth project card | 729.50 px |
| Complete selected overview and five-project ranking | 937.84 px |

The gate also checks that ranking shares the detail column and starts below it.
This fixture's eight cards fit; arbitrary counts, long identities and other tabs
can extend below the viewport. No fixed-height clipping or fabricated cards were
added. Long Thai identities remain visible on mobile and increase page height.
Bottom page padding can extend below the concept viewport; vertical scrolling
remains available.

See [occupied geometry](redesign-v1.8/projects-occupied-layout.json),
[English dark](redesign-v1.8/projects-occupied-en-dark.png),
[Thai light](redesign-v1.8/projects-occupied-th-light.png), and
[long Thai mobile metadata](redesign-v1.8/projects-occupied-th-light-390-long.png).
These captures were visually inspected against the supplied Projects concept and
blueprint overrides. They remain review candidates, not approved pixel baselines.

## Validation

- Web unit tests: **124/124** passed.
- Production web build: passed; existing 555.60 KB legacy App chunk warning remains.
- Complete `test:history`: passed, including **144** page/language/theme/width
  cases, prior monetary and occupied Live checks, and new sparse/occupied Projects
  geometry gates.
- Occupied Projects: English/Thai × dark/light, ranking selection, weighted
  monetary coverage, 20 → 5 → 20 session pagination, 390/900/1280 overflow,
  long Thai identity/observed paths, and empty filtered cards/ranking passed.
- A session's History link preserves custom from/to, source, harness, project and
  session identity; the linked History contains the single matching record.
- The first full run found a test expectation using `$` in Thai instead of the
  locale's `US$`. Locale-aware expectations corrected the test. The final run also
  verifies the enlarged ranking hit areas with the unchanged geometry thresholds.
- `test:runtime`: nine production routes passed with **5,000** synthetic records,
  authenticated summaries, no external/write requests or browser errors.
- `git diff --check`: passed.

See [validation and artifact hashes](redesign-v1.8/validation.json) and
[production evidence](redesign-v1.8/production-runtime.json). Daemon and tray
sources were unchanged; their suites and the preview suite were not rerun. The
shared cost component's call-description change is exercised by the production
browser flow; preview descriptions still use records.

## Remaining work

Continue Cost grid and Alerts chart/density refinements in the
[visual queue](REDESIGN-VISUAL-REVIEW.md), shared-shell styling and richer fixtures
for remaining pages. Chart axes/value accessibility, deterministic daemon/browser
clocks, reviewed baseline/SSIM, full accessibility/contrast review and packaged
tray/RC sign-off remain. This checkpoint does not certify complete concept parity
or release readiness.
