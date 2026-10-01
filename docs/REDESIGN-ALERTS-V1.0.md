# Redesign implementation checkpoint — 1.0.0

Branch: `design/redesign-foundation`. Tag: `redesign-alerts-v1.0.0`.
This checkpoint adds the blueprint's Alerts and Quota Guard view after
[Cost 0.9](REDESIGN-COST-V0.9.md).

Review captures: [English dark desktop](redesign-v1.0/alerts-en-dark-1440.png),
[Thai light mobile](redesign-v1.0/alerts-th-light-390.png), and
[browser verification](redesign-v1.0/verification.json). Captures use
synthetic events in an in-memory SQLite database.

## Current state and historical facts

- `#alerts?mode=redesign` uses the existing authenticated overview,
  quota-history, alert-history and notification-settings APIs. The canonical
  `#alerts` route still opens the existing page during compatibility migration.
  No schema, dependency, new channel or external action was added.
- Current risk is derived from fresh, unexpired owner/window readings and a
  forecast only when it reaches full use before a known reset. 50/80/95 are
  fixed read-only thresholds. Stale windows have unknown current risk; reader
  errors and unavailable sources appear as advisories linked to local Health.
  Hidden subscriptions are excluded from current-risk and coverage counts.
  The coverage denominator is known monitored windows and is unknown if no
  window has been observed.
- The selected owner/window chart reads real quota-history segments. Reset or
  counter-drop boundaries remain visible rather than joining unlike quota
  periods. The forecast rail labels insufficient samples explicitly. No
  project is credited with account-wide quota usage.
- Historical threshold crossings remain facts after current usage recovers.
  The history identifies detected events separately from events delivered on
  the desktop. Delivery requires the existing tray. The header switch updates
  existing notification settings only; collection continues. Snooze and quiet
  hours remain available through Settings, and daemon duplicate suppression
  is unchanged. Guidance links to local owner/reader details and performs no
  workload or provider changes.

## Validation

Web tests **116/116**, web production build, `npm run test:history`,
`npm run test:visual` (21 preview captures), and `npm run test:ui` passed.
The browser fixture creates 50/80/95 crossings, confirms that current risk
clears while event history remains, tests an unavailable reader advisory,
persists the notification toggle, and checks desktop/mobile layouts. Daemon
code did not change in this checkpoint. The web build retains its existing
main-bundle size warning.

## Remaining work

Settings redesign, canonical Live/Alerts route migration, full concept
geometry/SSIM review, hardening and RC gates remain. `visualApproval` is
still `pending`.
