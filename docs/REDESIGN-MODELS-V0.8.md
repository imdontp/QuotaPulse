# Redesign implementation checkpoint — 0.8.0

Branch: `design/redesign-foundation`. Tag: `redesign-models-v0.8.0`.
This checkpoint adds the blueprint's production Models view after
[Providers 0.7](REDESIGN-PROVIDERS-V0.7.md).

Review captures: [English dark desktop](redesign-v0.8/models-en-dark-1440.png),
[Thai light mobile](redesign-v0.8/models-th-light-390.png), and
[browser verification](redesign-v0.8/verification.json). Captures use an
in-memory SQLite fixture, not the user's usage database.

## Exact model read and view

- The existing opt-in `GET /api/models?detailed=1` supplies scoped totals,
  exact `model + recorded provider` groups and vendor maker labels. The new
  authenticated `GET /api/model-detail` supplies a selected pair's sparse
  elapsed-time trend, categorical effort counts and largest observed context
  window from one SQLite read transaction. It uses the shared `[from,to)`
  predicate, prepared parameters and exact null/empty identity flags. The
  legacy `/api/models` response remains unchanged.
- `#models` uses the shared shell. Period, recorded-provider and maker filters
  query the same scope as the summary and table. The comparison search finds
  rows within that result; ranking uses tokens, calls or calculated API value.
  Selecting a row updates the detail rail. Its History link carries the exact
  period and model/provider where both identities are present.
- Sessions are counted distinctly at the displayed total and pair levels;
  row counts are never added to infer the total. Cache share uses recorded
  input components. Priced-call coverage replaces the concept's quality score,
  and calls replace speed. Calculated API value and reported native cost stay
  separate; missing prices are disclosed. The token donut uses recorded
  components, and the trend is based only on the selected pair.
- No catalog-sourced context capacity exists in this read, so that field is
  unavailable. The largest context window seen in a usage event is labelled
  separately with its origin and observation time. Effort is a categorical
  distribution, not a fabricated performance score. No benchmark, model
  description, schema migration or dependency was added.

## Validation

Daemon tests **86/86**, web tests **116/116**, both production builds,
`npm run test:history`, `npm run test:visual` (21 preview captures) and
`npm run test:ui` passed. API tests cover exact model/provider pairs, null and
empty identities, scope, authentication and the unchanged legacy response.
The browser fixture checks table/detail/trend, provider filter, scoped History
and English desktop/Thai mobile layouts. The web build retains its existing
main-bundle size warning.

## Remaining work

Cost, Alerts and Settings redesign slices remain, along with canonical Live
route migration, full concept geometry/SSIM review, hardening and RC gates.
`visualApproval` remains `pending`.
