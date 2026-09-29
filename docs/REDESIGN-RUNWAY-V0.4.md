# Redesign implementation checkpoint — 0.4.0

Branch: `design/redesign-foundation`. Tag: `redesign-runway-v0.4.0`.
This checkpoint extends the [real Overview](REDESIGN-OVERVIEW-V0.3.md) with
quota history, Runway, measured cache insights, and recent activity.

Review captures: [English dark full page](redesign-v0.4/overview-en-dark-full.png),
[Thai light mobile full page](redesign-v0.4/overview-th-light-full.png), and
[browser verification](redesign-v0.4/verification.json). The captures use only
synthetic data in an in-memory SQLite database.

## Read contracts and UI

- `GET /api/quota-history` is authenticated and accepts an exact subscription
  key, window kind, and optional `[from,to)` milliseconds (up to 90 days). It
  selects the same freshness-first source/origin as the current limits view.
  It returns that reader's identity, freshness, forecast status, and observed
  samples in separate discontinuous segments. An unknown owner/window returns
  an unavailable empty result. It never combines readers into a fake trend.
- `GET /api/runtime-map` now also returns input token components, known cache
  price difference, and monetary coverage counts. The Overview shows cached
  input share only when input exists, and known cache difference only when
  priced cache components exist. These figures use the same today scope as
  the usage graph. Native reported cost and calculated API value remain split.
- Runway uses the selected owner/window only: remaining percentage points
  divided by hours until reset. It shows a projected exhaustion marker only
  for a fresh, ready forecast before reset. Stale, expired, missing and
  insufficient cases have explicit messages. The quota reading history can
  be expanded without drawing a line across resets or reader origins.
- Recent activity uses the safe paginated usage-events API. An activity card
  opens `#history?range=all&session_id=...`; the shared History and CSV filters
  honor that session ID. Aggregate updates are labelled separately from calls.
  Previous route defaults and the PulsePet popup are preserved.

## Validation

Daemon tests **84/84**, web tests **116/116**, daemon/web builds,
`npm run test:history`, `npm run test:visual` (21 preview captures), and
`npm run test:ui` passed. The browser test checks fresh-reader selection,
two history segments, safe pace, cache share, currency, activity drill-down,
52 session-scoped versus 53 total records, responsive widths, languages,
themes, and existing History error/pause/export behavior. The UI suite was
rerun alone after an initial startup timeout while three browser suites ran
simultaneously. The web build retains its existing main-chunk size warning.

## Remaining work

This is a checkpoint, not a complete phase-2 or release verdict. The full
visual baseline and SSIM review are pending. Overview still needs range
controls and scoped graph/model drill-down. The remaining Live, Projects,
Providers, Models, Cost, Alerts, Settings layouts and their contracts still
need implementation and hardening. `visualApproval` remains `pending`.
