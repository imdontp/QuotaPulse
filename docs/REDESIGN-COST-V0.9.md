# Redesign implementation checkpoint — 0.9.0

Branch: `design/redesign-foundation`. Tag: `redesign-cost-v0.9.0`.
This checkpoint adds the blueprint's production Cost Analysis view after
[Models 0.8](REDESIGN-MODELS-V0.8.md).

Review captures: [English dark desktop](redesign-v0.9/cost-en-dark-1440.png),
[Thai light mobile](redesign-v0.9/cost-th-light-390.png), and
[browser verification](redesign-v0.9/verification.json). They use synthetic
records in an in-memory SQLite database.

## Monetary read and view

- The new authenticated `GET /api/cost-analysis` requires the shared
  `[from,to)` scope and an explicit `api` or `native` basis. One SQLite read
  transaction returns totals, at most 30 elapsed-time trend bins, provider,
  exact model/route and project groups, plus the ten highest-value sessions
  sorted by the server over the complete scope. The existing mixed-basis APIs
  remain unchanged; no schema or dependency was added.
- `#cost` defaults to calculated API value (computed + estimated). The basis
  selector can show separately reported native cost. All monetary panels,
  ranked rows and per-1K-token denominator follow the selected basis. Tokens
  from all usage are shown separately. Priced-call coverage, excluded calls
  and estimated-reference calls are explicit. A genuine priced zero remains
  zero; a scope with usage but no value on the selected basis is unavailable.
- The trend, provider distribution, model/project tables, top sessions and
  coverage rail use source facts. Project and session links carry the exact
  time scope into History. Cache savings are historical values with known API
  pricing components and show their call coverage; native mode does not infer
  cache savings. Model concentration and unknown-cost coverage are descriptive
  observations, not optimization promises.
- The daily tile reports a rate over elapsed 24-hour time only after at least
  one complete 24-hour period. The monthly projection is unavailable with a
  reason: current ingest state cannot verify a complete, fresh call-grain
  calendar-month-to-date series. Native reports are never projected as billed
  spend. English/Thai, light/dark and narrow layouts are supported.

## Validation

Daemon tests **86/86**, web tests **116/116**, daemon/web production builds,
`npm run test:history`, `npm run test:visual` (21 preview captures) and
`npm run test:ui` passed. API tests cover the separate monetary bases,
coverage, `[from,to)`, server-ranked sessions, a real priced-zero call,
validation and authentication. The browser fixture checks the basis switch,
ranking, scoped History and desktop/mobile layouts. The web build retains
its existing main-bundle size warning.

## Remaining work

Alerts and Settings redesign slices remain, along with canonical Live route
migration, full concept geometry/SSIM review, hardening and RC gates.
`visualApproval` remains `pending`.
