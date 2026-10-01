# Redesign implementation checkpoint — 1.1.0

Branch: `design/redesign-foundation`. Tag: `redesign-hardening-v1.1.0`.
This checkpoint follows [Alerts 1.0](REDESIGN-ALERTS-V1.0.md).

Review captures: [English dark desktop](redesign-v1.1/overview-en-dark-1440.png),
[Thai light mobile](redesign-v1.1/overview-th-light-390.png), and
[browser verification](redesign-v1.1/verification.json). Browser data comes from
an in-memory synthetic SQLite database.

## Shared navigation and Settings

- The production redesign shell now shows the local machine scope and a working
  command palette. It searches all nine destinations, opens via the visible
  control or Ctrl/Cmd+K, and supports keyboard selection. The top bar labels
  History and Settings correctly when those pages use the shell.
- The blueprint contains eight screen concepts and no Settings concept. Its
  compatibility contract explicitly retains language, theme, currency/rate,
  window size, hidden subscriptions, notification/snooze/quiet-hour, and pet/tray
  preferences. The Settings destination therefore opens the existing working
  page; no unsupported redesign screen or replacement settings API was added.
- The legacy dashboard, Settings route, and Electron popup remain reachable.

## Loading cost

The prior production build emitted one 1,304 KB minified JavaScript chunk.
Route-level lazy loading now emits a 273 KB entry chunk and separate chunks for
each redesign route. The existing legacy App still emits an 879 KB chunk, so the
build warning remains. This improves the initial route payload; it is not a
measured page-load or CPU performance score. The preview fixture remains excluded
from production assets.

## Validation

Web tests **116/116**, web production build, authenticated `npm run test:history`,
legacy dashboard and popup `npm run test:ui`, and `npm run test:visual` (21
preview captures) passed. The browser test checks command navigation to
Settings and keyboard navigation to Providers. The old UI test now publishes a
synthetic SSE data event when changing its fixture, matching the actual refresh
mechanism instead of waiting for the 30-second fallback timer.

## Remaining work

Canonical hash migration for the legacy aliases and opt-in Live/Alerts routes,
reference geometry/SSIM review of all eight screens, accessibility and runtime
performance consolidation, and RC/recovery gates remain. `visualApproval` is
still `pending`; this checkpoint is not an application release.
