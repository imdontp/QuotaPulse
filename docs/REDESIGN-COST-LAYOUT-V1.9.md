# Cost layout checkpoint — 1.9.0

Branch: `design/redesign-foundation`. Tag: `redesign-cost-layout-v1.9.0`.
Follows [Projects layout 1.8](REDESIGN-PROJECTS-LAYOUT-V1.8.md).
Status: **Validated checkpoint**. Overall visual/release approval remains pending.

## Changes

- At desktop widths of at least 1280 px, provider distribution sits beside the
  four summary cards. Model breakdown shares the trend row; project, session and
  coverage-insight panels form the bottom row. Header controls, gaps and table
  spacing are compact. Narrow layouts stack and retain all text and records.
- Summary, daily average, donut and breakdown amounts use the existing weighted
  price-coverage component. Unknown, known zero and partial subtotals stay distinct;
  partial subtotals carry `+` with covered/total calls in the title and accessible
  description. Native and calculated API values remain separate.
- Zero amounts now have zero-height bars. Empty buckets have no token marker;
  known priced buckets can still show tokens when their monetary value is zero.
  Zero monetary totals retain a neutral donut and no invented shares. Chart scale
  endpoints and localized series labels describe monetary value and priced tokens;
  its accessible name includes each bucket's timestamp, value and priced tokens.

Source changes: `cost.tsx`, `cost.css`, one label in each language dictionary, and
the existing browser harness. No daemon, schema, dependency or tray changes.
The original checkout remains clean at `be8e145`; work uses the existing isolated
implementation branch and worktree.

## Occupied fixture and geometry

The harness adds ten synthetic sessions after the existing flows, spreading their
records over a custom 30-day scope. With source 1 selected, the fixture has five
recorded providers, eight displayed model/route groups, six projects and ten
server-ranked session rows. Its API value is `$65.40` / `US$65.40`, covering 62/62
weighted calls. The lower-valued eleventh session remains outside the server's
existing top-ten breakdown; History provides the complete scoped records.

| Region, at 1672 × 941, all four language/theme combinations | Bottom |
| --- | --- |
| Complete project breakdown | 836.84 px |
| All ten displayed session rows | 922.03 px |
| Complete coverage-insight panel | 928.50 px |

Provider/summary non-overlap and trend/model row alignment are also checked.
Arbitrary provider counts and long identities can increase vertical height;
no fixed-height clipping or fabricated series was added. The mobile long-name
case preserves the complete project/session identities and horizontal table
scrolling without page overflow. Bottom page padding can extend below 941 px.

See [occupied geometry](redesign-v1.9/cost-occupied-layout.json),
[English dark](redesign-v1.9/cost-occupied-en-dark.png),
[Thai light](redesign-v1.9/cost-occupied-th-light.png), and
[long Thai mobile identities](redesign-v1.9/cost-occupied-th-light-390-long.png).
The four occupied captures were inspected against the supplied Cost concept and
blueprint factual overrides. These remain review candidates, not approved pixel
baselines.

## Validation

- Web unit tests: **124/124** passed.
- Production web build: passed; existing 555.60 KB legacy App chunk warning remains.
- Complete `test:history`: passed, including **144** page/language/theme/width
  cases, existing monetary/occupied Live/Projects checks, and new Cost checks.
- Missing-price, known-zero, weighted mixed-basis and empty-source cases now check
  Cost on both bases. Known-zero bars, neutral donut, unknown chart exclusion and
  model coverage (50/109 API or 10/109 native calls) are verified. Whole-scope mixed
  coverage remains 50/110 API or 10/110 native; one other-model call explains the
  different model denominator.
- Occupied Cost: English/Thai × dark/light, complete desktop panels, 390/900/1280
  overflow, zero empty-bucket bars, long Thai identities and exact History
  drilldowns passed. Model links preserve custom from/to, source, model/provider
  and produce one record; a project link produces its two matching records.
- The first full run caught a test expecting “cost” in the graph label where the
  dictionary says “value”. The isolated follow-up caught a new test using the
  wrong History table selector. Both tests now use existing dictionary/component
  identifiers. The final full run passes unchanged geometry thresholds.
- Production runtime results and artifact hashes are recorded in the linked
  [validation evidence](redesign-v1.9/validation.json).

Daemon/tray and daemon-free preview sources were unchanged; their suites were
not rerun. No live provider, installed tray/task or user database was accessed.

## Remaining work

Continue Alerts chart/density refinements and shared-shell styling in the
[visual queue](REDESIGN-VISUAL-REVIEW.md). Full chart-axis treatment, typography,
contrast/screen-reader review, deterministic daemon/browser clocks, reviewed
baseline/SSIM and packaged tray/RC sign-off remain. This checkpoint does not
certify complete concept parity or release readiness.
