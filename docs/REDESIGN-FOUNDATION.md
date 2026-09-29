# Redesign foundation — pilot 0.1.0

Based on `blueprint-v1.1.0` (`e762d21`). Development branch:
`design/redesign-foundation`. This is the first implementation slice, **not a
completed application upgrade or an approved visual baseline**.

Review captures: [desktop](redesign-pilot/overview-dark.png),
[Thai mobile light theme](redesign-pilot/overview-mobile-th.png),
[measurements and verification](redesign-pilot/verification.json).
Version tag: `redesign-pilot-v0.1.0`.

## Run the pilot

From this worktree:

```powershell
npm run dev -w @quotapulse/web -- --host 127.0.0.1 --port 7797 --strictPort
```

Open `http://127.0.0.1:7797/?mode=redesign-preview`.
Optional `&scenario=empty`, `stale`, `critical`, or `long-names` exercises boundary
states. All values are sample data anchored to 2026-09-29 10:00 UTC. They are not
prices, quotas, or usage from a connected account. No daemon is needed.

The normal URL and Electron popup still enter the existing application. The pilot
module and fixture are eliminated from production builds. The preview uses the
existing English/Thai dictionaries and bundled fonts, with in-memory language and
theme controls; it does not mount the settings provider, read account data, open
SSE, migrate settings, or persist preferences.

## Implemented

- Scoped navy/light shell with responsive navigation and keyboard focus styles.
- SVG Pulse Core: selected owner/window remaining percentage, explicit freshness
  and risk, reduced-motion support, animation paused offscreen or in hidden tabs.
- Selectable quota windows; no conversion from quota percentages to token budgets.
- Runtime Map generated from observed adjacent relationships. Nodes open a native
  modal with keyboard dismissal and focus restoration. Narrow screens scroll only
  the graph region.
- Model token shares; distinct session counts; call/aggregate record distinction;
  separately reported native cost and calculated/estimated API value.
- Deterministic fixture, pure presentation contracts, boundary tests, browser
  capture harness and production-exclusion checks. No new dependencies or schema.

## Validation

```powershell
npm run test -w @quotapulse/web
npm run build -w @quotapulse/web
npm run test:visual
npm run test:ui
```

`test:visual` writes 21 screenshots and `verification.json` under
`screens/redesign-foundation/` (ignored generated artifacts). It verifies interactions,
focus restoration, English/Thai × dark/light × 390/900/1280/1440, empty/stale/critical/
long-name cases, reduced motion, no outer-page overflow, no preference writes, no
daemon/external requests, font loading, browser errors and production exclusion.
It also captures the 1586 px reference width and region geometry. Development-mode
load timing is diagnostic only, not a production performance claim.

Verified 2026-09-29: web tests **114/114 passed**, TypeScript and production build
passed, all 21 pilot captures/checks passed, existing dashboard/PulsePet browser
regression passed. `git diff --check` passed. The build retains the existing
large-chunk warning (main JS about 1.148 MB before gzip). Daemon and tray unit suites
were not rerun for this web-only slice. No whole-application readiness claim is made.

The first browser run exposed font serving restrictions when resolving dependencies
from the parent checkout. Vite now allows that resolved dependency directory; the
pilot harness checks HTTP failures and font loading. One existing-UI run was
interrupted by a Vite config reload during that correction; its complete rerun passed.

## Gate A: gaps requiring further implementation / visual review

The pilot proves rendering and data semantics. It does **not** yet meet the full
reference composition or the blueprint's final geometry/SSIM gates:

- Navigation currently exposes implemented pilot sections, not all nine new routes.
- Core uses a procedural SVG sphere. Concept globe texture, waveform field, edge
  glow, iconography and exact spacing still need refinement against the reference.
- The fixture has two quota windows and two models, not the concept's complete
  content density. The hero and graph therefore have different geometry.
- Runway, insights and activity strip are not implemented. They require the
  approved real-data contracts, including coverage and forecast semantics.
- No production API adapter, API pagination/filter changes, shared-SSE integration,
  custom date range, search, or new screen routing has been introduced in this slice.
- Loading/error/inactive-source variants and complete eight-screen measurement
  sheets remain to be added when those contracts are connected.

`visualApproval` remains `pending`; no image is registered as an approved baseline
and no SSIM score is claimed. Keep the existing baseline until the concrete pilot
has been reconciled with concept + overrides and reviewed. Then implement the
read APIs and bind the new screens in the order specified by the blueprint.
