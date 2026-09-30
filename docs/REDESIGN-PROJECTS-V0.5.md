# Redesign implementation checkpoint — 0.5.0

Branch: `design/redesign-foundation`. Tag: `redesign-projects-v0.5.0`.
This checkpoint implements the blueprint's Projects read slice and continues the
additive API foundation. It follows [Runway 0.4](REDESIGN-RUNWAY-V0.4.md).

Review captures: [English dark desktop](redesign-v0.5/projects-en-dark-1440.png),
[Thai light mobile](redesign-v0.5/projects-th-light-390.png), and
[browser verification](redesign-v0.5/verification.json). Captures use synthetic
records in an in-memory SQLite database, not a user's usage database.

## Read contracts and UI

- `GET /api/projects?detailed=1` and `GET /api/models?detailed=1` accept the
  shared authenticated `[from,to)` scope. Their legacy responses stay unchanged.
  Totals, exact groups and source/route/model rows come from one SQLite read
  transaction. Distinct sessions are counted independently at each level;
  group counts are never added to infer the page total. Project `NULL`, empty
  string and literal `(none)` remain distinct. The model aggregate retains the
  recorded provider, model and effort identities. Monetary fields use the
  blueprint's `reported_native_usd`, `api_value_usd` and coverage names.
- `GET /api/project-detail` requires an exact project or `project_missing=1`.
  It returns at most 30 elapsed-time trend bins, a stable recent-record list,
  and server-filtered sessions in pages of up to 500. It uses the same scope
  predicate as the aggregates and CSV/History reads. No persisted budget or
  project record is introduced.
- `#projects` has All, five-minute Recent and Unassigned tabs; complete-result
  metadata search; harness, period and sort controls; a card grid; selected
  Overview/Sessions/Usage/Details; and a ranked usage list. The bar indicates
  share of recorded usage, never budget consumption. Trend bins retain empty
  periods rather than stretching one event over the whole range.
- Project sessions and Usage link into History with the exact project identity,
  harness and resolved time range. History now reads those filter parameters
  from the URL and keeps them when its own range changes. A route guard prevents
  History's URL synchronization from pulling navigation back from another page.
- Native reported cost and calculated API value remain separate. Missing
  coverage appears as unavailable; unpriced and reference-priced call counts
  are explicit. Working paths are shown only as recorded metadata from recent
  sessions. The common redesign shell is shared by production Overview and
  Projects, while other routes and the Electron popup retain their existing UI.

## Validation

Daemon tests **85/85**, web tests **116/116**, daemon/web production builds,
`npm run test:history`, `npm run test:visual` (21 pilot captures) and
`npm run test:ui` passed. The API test covers null/empty/literal project
identities, distinct sessions, provider-specific models, monetary coverage,
pagination, exact scope, validation, authentication and legacy defaults. The
browser fixture checks Projects tabs, trend, scoped History, filters, language,
theme and widths 390/900/1440px alongside Overview/History/Live behavior.
The web build retains the existing main-chunk size warning.

## Remaining work

This is an implementation checkpoint, not the complete application upgrade.
The production Live layout, Providers, Models, Cost, Alerts and Settings still
need their blueprint slices. The full reference geometry/SSIM review and
hardening/RC gates are pending; `visualApproval` is still `pending`.
