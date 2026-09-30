# Redesign implementation checkpoint — 0.6.0

Branch: `design/redesign-foundation`. Tag: `redesign-live-v0.6.0`.
This checkpoint adds the blueprint's production Live read and layout after
[Projects 0.5](REDESIGN-PROJECTS-V0.5.md).

Review captures: [English dark desktop](redesign-v0.6/live-en-dark-1440.png),
[Thai light mobile](redesign-v0.6/live-th-light-390.png), and
[browser verification](redesign-v0.6/verification.json). Captures use synthetic
records in an in-memory SQLite database.

## Read contract and Live view

- `GET /api/live-sessions` is an authenticated, parameterized, paginated read
  over the shared `[from,to)` usage scope. It returns all observed and recent
  distinct-session counts plus the selected page from one SQLite read
  transaction. Recent uses `session.last_seen_at` within five minutes of server
  time; null and future source timestamps are unknown, never treated as recent.
  Existing `/api/sessions` behavior remains unchanged. No schema or dependency
  was added.
- The opt-in production route `#live?mode=redesign` uses the shared shell. Its
  default scope is the last 30 minutes. It shows four overlapping diagnostic
  counts, bounded session and usage-record pages, the call-only minute trend,
  explicit aggregate/unknown exclusions, source advisories, and an observed
  provider/model matrix (top 12 by recorded tokens). The matrix filters the chart, sessions and feed;
  History links carry the resolved time range and metadata filters.
- The Reporting count means enabled sources with a usage event in the last
  five minutes, not proof of a heartbeat. Stale means a known enabled quota
  reader whose last source fetch is more than one hour old. Reader errors use
  existing source telemetry. The counts can overlap and do not partition
  sessions. Advisories link to local diagnostics; provider/model cells describe
  observed usage, not service health or latency.
- Pause freezes this page's displayed snapshot and prevents new page reads;
  it does not stop the daemon or SSE. Controls that would change the scoped
  snapshot are disabled while paused. Resume fetches the latest data from page
  zero. The session modal displays recorded metadata and restores focus when
  closed. Null/future source timestamps display as unknown.

The existing `#live` route remains available during the migration. The new
shell's Live link opens `#live?mode=redesign`; moving the canonical `#live`
route is a later compatibility gate.

## Validation

Daemon tests **86/86**, web tests **116/116**, daemon/web builds,
`npm run test:history`, `npm run test:visual` (21 preview captures), and
`npm run test:ui` passed. The Live API test covers recent/all counts,
null/future timestamps, exact metadata filters, pagination, validation and
authentication. The browser fixture checks the call-only chart, aggregate
coverage, session modal, matrix filtering, pause/resume, English/Thai,
dark/light and 390/1440px layouts alongside earlier screens. The web build
retains its existing main-chunk size warning.

## Remaining work

Providers, Models, Cost, Alerts and Settings redesign slices remain. The
canonical Live route migration, complete reference geometry/SSIM review,
hardening and RC gates are pending. `visualApproval` remains `pending`.
