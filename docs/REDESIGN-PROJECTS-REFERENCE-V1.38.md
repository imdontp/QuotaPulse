# Projects reference repair v1.38

## Goal and scope

Continue the complete eight-page reference fidelity repair, preserving real
application data. Projects was materially different: small identity tiles,
compressed four-row cards and a bar chart rather than the reference's larger
three-row cards and line charts. This checkpoint repairs those differences.
The original 99–100% visual target remains open across the complete dashboard.

- Project identities have 48px tiles and larger names. Cards use cyan/violet
  decoration, gradients, real token-share bars, separate native/API money,
  actual token sparklines and icons for recorded facts. Colors are decoration,
  not invented project categories or status.
- The desktop card region displays three rows and scrolls to additional cards.
  All eight fixture cards remain loaded, keyboard reachable and selectable.
  Rows can grow for longer content; footer facts must stay inside the card.
- The selected detail uses a 112px observed line/area plot, larger identity tile
  and actual harness/provider marks. Exact scope, detail tabs, pricing coverage,
  history links and complete chart data remain available.
- Desktop main padding is 12px and the card/detail column ratio is 1.65:1.
  Narrow layouts retain stacked cards.

## Real mini-chart data

`GET /api/projects?detailed=1&trends=1` opts into one additional scoped grouped
query. It uses the same `usageWhere` filters as the aggregate and one read
transaction for totals/groups/rows/trends. Each project has up to thirty elapsed
time buckets, matching the selected detail's bucketing. Null, empty and literal
project names stay distinct. No per-card request fanout is introduced. Existing
responses without `trends=1` retain their fields/cardinality; Models is unchanged.
The frontend indexes returned points by exact project identity and timestamp,
then fills empty buckets with zero. Straight lines preserve the observed values.
No budgets, week-over-week percentages, fabricated activity or random series
are added.

The new API tests cover legacy fields, total reconciliation, scope filters,
half-open time boundaries, sessionless/null/empty/literal project identities and
invalid opt-in flags. Browser checks compare every mini-chart timestamp/value
and its sum with independently queried scoped API data. Selected-chart tests
check line coordinates, including tiny and zero buckets. Card checks now verify
the bounded region and last-card keyboard access rather than requiring all eight
cards to be squeezed into the screenshot. This changes the layout contract to
the reference's larger three-row treatment, while retaining complete access.

## Reference review artifact

[Open reference review](redesign-v1.38/reference-review.html) presents all eight
source concepts and matching production captures. It supports side-by-side and
opacity-overlay inspection at matching image dimensions. Original PNG copies
are SHA256-verified against the supplied folder; see
[source verification](redesign-v1.38/source-reference-verification.json).
This review tool does not measure similarity or approve the design.

## Validation and artifact

- Web TypeScript/Vite and daemon TypeScript builds passed. The existing web
  chunk-size warning remains. No dependency install or native rebuild occurred.
- `node --import tsx --test packages/daemon/test/project-trends.test.ts packages/daemon/test/detailed-aggregates.test.ts`:
  two tests passed, including empty windows and the thirty-bucket cap. See
  [test output](redesign-v1.38/project-trends-tests.txt).
- `node --import tsx scripts/check-stable-captures.mts`: the full eight-page
  run passed 36 pairs, 35 byte-identical. Projects Thai dark differed at 31
  pixels by at most two channel levels, within the unchanged unmasked
  tolerance. The card region bottom is 926px in all four combinations. Full
  data, keyboard/focus, tiny/zero charts, quota/runtime, shell/font and overflow
  checks passed. See [verification](redesign-v1.38/verification.json).
- The packaged web index matches the browser-tested build and the packaged
  project-trend implementation matches the compiled daemon. See
  [build match](redesign-v1.38/build-match.json).

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.38-DYFU1l.zip`, unsigned Windows
x64, external Node module ABI 127, readers disabled, no app profile. All
3,128 entries were decompressed and SHA256-compared with bundle sources.
ZIP size: 199,847,222 bytes. SHA256:
`67e3b2d2e6b35da37383354e2f40857b393b6ecead28bb98dfabd13989ac6e91`.
See [inventory](redesign-v1.38/bundle-build.json) and
[archive verification](redesign-v1.38/archive-verification.json).
Extract into a new dedicated folder and run `scripts/start-review.ps1`;
`scripts/stop-review.ps1` stops that instance. New profiles are empty; screenshot
fixture data is kept in a separate in-memory DB. Extracted runtime/installer
and broader release suites were not rerun.

Version tag: `redesign-projects-reference-v1.38.0`. Original checkout remains
clean at `be8e145039247958992fa7673a9c77e1bff35db1`; earlier versions are preserved.

## Outstanding acceptance

Projects still needs typography and detailed tab/route treatment. Other pages
retain the gaps in [reference repair](REDESIGN-REFERENCE-REPAIR.md). Unsupported
concept budgets/status/latency/benchmarks need corresponding data before being
shown. The complete visual target, named reviewed baseline, original-reference
similarity measurement, manual screen-reader review and broader release gates
remain outstanding. Do not close the goal on the strength of repeat captures.
