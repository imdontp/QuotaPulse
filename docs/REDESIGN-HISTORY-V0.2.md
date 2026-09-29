# Redesign implementation checkpoint — 0.2.0

This checkpoint extends the [0.1.0 visual pilot](REDESIGN-FOUNDATION.md) on the
isolated `design/redesign-foundation` branch. It uses the approved v1.1 contract in
`docs/quotapulse_build_blueprint_v1.1.zip` and the original QuotaPulse origin. The
normal application now has an authenticated History route and a call-only Live
minute chart. The development-only visual pilot remains a separate preview.

Version tag: `redesign-history-v0.2.0`.

Review captures: [History desktop](redesign-v0.2/history-en-dark-1440.png),
[History Thai mobile](redesign-v0.2/history-th-light-390.png),
[Live minute chart](redesign-v0.2/live-minute-th-light.png), and
[refined overview pilot](redesign-v0.2/overview-pilot-dark.png).

## Added read contracts

- `GET /api/usage-events`: `[from,to)` epoch milliseconds, source ID, exact project,
  exclusive missing-project flag, harness, recorded provider, model vendor, model,
  literal metadata substring and record grain. Default page 50, max 500, stable
  timestamp/id descending order, total count from the same SQLite read snapshot.
  Default range is the last 24 hours. This is a read-only, allowlisted API; no prompt,
  response, credential path or raw event JSON is returned.
- `GET /api/export/usage`: same filters. Existing CSV requests retain ascending
  order and columns. History requests descending order with an added grain column.
  CSV streams every matching row rather than only the page. Metadata beginning
  with spreadsheet formula markers is emitted as inert text.
- `GET /api/trend?bucket=minute`: 30-minute default, maximum 24 hours, UTC epoch
  aligned minute buckets. Only declared immutable call adapters enter the chart.
  Aggregate/unknown records and their source totals appear in explicit coverage.
  Other trend buckets keep their existing semantics.

Hermes records remain stable session aggregates; an update replaces the row by ID.
The browser History view supports filters, pagination, whole-range CSV, details,
keyboard dismissal, an in-memory Pause, and Resume to page zero. The Live chart
uses the shared refresh controller and has an accessible list of minute values.
Neither feature adds a collector, schema migration, account probe or dependency.

## Validation

```powershell
npm run build -w @quotapulse/daemon
npm run build -w @quotapulse/web
npm run test -w @quotapulse/daemon
npm run test -w @quotapulse/web
npm run test:history
npm run test:ui
npm run test:visual
```

`test:history` starts a loopback daemon with **in-memory synthetic SQLite**. It
checks authenticated reads, more than one page, shared export filters, complete
CSV, literal search, missing projects, Pause across an in-flight response,
recovery from an HTTP error, locale/currency/theme, and 390/900/1440 px widths.
It also exercises the Live chart against real call and Hermes aggregate facts.
`test:visual` verifies 21 preview captures and no fixture data in the production
build. The older UI suite verifies the existing dashboard and PulsePet popup.
At this checkpoint the full daemon suite passes **82 tests**, the web suite
passes **114 tests**, and both production builds complete. The web build retains
the pre-existing main-chunk size warning.

## Delivery boundary

This is an implementation checkpoint. The new History and Live functions are
connected to real read APIs, but the full nine-route visual redesign, provider and
project detail, quota history, all overview data bindings, and the remaining
blueprint phases are still open. The preview's visual review is pending. No
SSIM score or approved baseline is asserted, and this tag is not a production
release or a merge into the original branch.
