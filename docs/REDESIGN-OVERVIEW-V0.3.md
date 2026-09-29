# Redesign implementation checkpoint — 0.3.0

Branch: `design/redesign-foundation`. Tag: `redesign-overview-v0.3.0`.
This checkpoint adds a real-data Overview to the 0.2 History/Live foundation.
It remains isolated from the original checkout and uses the existing origin.

Review captures: [English desktop dark](redesign-v0.3/overview-en-dark-1440.png),
[Thai mobile light](redesign-v0.3/overview-th-light-390.png), and
[browser verification](redesign-v0.3/verification.json). The browser data is
synthetic and stored only in an in-memory SQLite database.

## Implemented

- `GET /api/runtime-map` uses the authenticated shared `[from,to)` and usage
  filters. It returns scoped totals, project/harness/recorded-provider/model
  groups, and observed adjacent links from one SQLite read transaction. Each
  group counts its distinct sessions independently; displayed links never
  imply unobserved combinations. Native reported cost and calculated or
  estimated API value stay separate, with unknown-cost coverage.
- `#overview` loads today's usage graph and the existing overview/limit reader.
  The selected owner/window uses the canonical primary reading. Its default is
  the most-used fresh window; when none qualifies, the core shows unavailable.
  Manual window selection remains possible and visibly stale. No quota
  percentage is converted into a token allowance.
- Production Overview follows the existing SSE/fallback refresh controller,
  browser language, theme, and display currency. It keeps the last successful
  snapshot visible on a read error. Its nine navigation links reach the current
  application routes; the graph nodes expose scoped counts in a dialog.
  Responsive navigation has icons with accessible names.
- The development-only preview remains separate from the production route.
  Fixture identifiers are absent from the production bundle.

## Validation

`npm run build -w @quotapulse/daemon`, `npm run build -w @quotapulse/web`,
daemon tests **83/83**, web tests **115/115**, `npm run test:history`,
`npm run test:ui`, and `npm run test:visual` passed. The browser test uses
real authenticated HTTP reads over synthetic in-memory SQLite. It verifies
the graph's token total, distinct sessions, fresh-over-stale quota choice,
THB conversion, node details, dark/light captures, 390/900/1440 px overflow,
and navigation back to History. The existing UI suite covers the popup.
The web build still reports the existing main-chunk size warning.

## Remaining blueprint work

This is a functional checkpoint, not completion of phase 2 or release approval.
Overview still needs Runway, Insights, activity strip, scoped drill-down routes,
range control, and the visual baseline review. Phase 1A quota history and the
remaining Projects, Providers, Models, Cost, Alerts, and full Live layouts are
also open. `visualApproval` remains `pending`; no SSIM score or approved image
baseline is claimed.
