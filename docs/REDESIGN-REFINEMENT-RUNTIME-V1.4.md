# Visual refinement and runtime checkpoint — 1.4.0

Branch: `design/redesign-foundation`. Tag: `redesign-refinement-runtime-v1.4.0`.
Follows [History hardening 1.3](REDESIGN-HISTORY-HARDENING-V1.3.md).
This checkpoint is not a completed redesign release or deployment.

## Implementation

All eight original concept/candidate pairs were inspected. The
[screen review](REDESIGN-VISUAL-REVIEW.md) distinguishes blueprint overrides and
fixture differences from remaining layout and typography work. New candidates
are stored in [redesign-v1.4](redesign-v1.4/review-candidates.json); visual
approval remains pending.

History now uses a shorter timeline region and responsive SVG coordinates. The
plot uses the actual available width while text retains its size. The browser
gate checks timeline height below 390 px, plot width above 90% of its container,
and the first record wholly inside the 1672 × 941 concept viewport. It also checks
the complete 144-case language/theme/width/navigation/stream matrix. A repeated
Range heading and overlapping record-kind/checkbox controls were corrected.

The selected-record rail now groups Event summary, Token breakdown, Pricing
source, Runtime metadata, and related records/metadata actions. Cache write and
recorded subagent status are visible. Missing runtime values are labelled
Unknown. Synthetic metadata verifies cache write 7, subagent Yes and recorded
duration 1,234 ms. Safe copying, session scope, Escape/focus restoration, filters,
pause and export checks continue to pass. Legacy mode retains its prior detail
layout. See [History](redesign-v1.4/history-concept-size.png) and
[initial detail rail](redesign-v1.4/history-detail-open-en-light-1440.png).

## Production runtime and privacy evidence

`npm run test:runtime` serves the built web assets directly from the real
authenticated daemon, without Vite, using synthetic in-memory SQLite containing
5,000 records / 500,000 tokens. All nine destinations render. The full-range
History total and ten authenticated summary responses reconcile; an unauthenticated
summary request is rejected. Page viewing issued no external requests or write
requests, and summary responses did not disclose the synthetic private root path.
This is a scoped network/summary gate, not a claim that every API hides project
paths or that ingest/provider actions never use the network.

The artifact records route readiness, navigation/paint/resource timings and
SHA-256 hashes of production JS/CSS/fonts. On this machine the first Overview
document reached its readiness selector in about 1,603 ms; later documents shared
the browser cache. History took about 433 ms. Ten summary HTTP requests averaged
12.6 ms (range 11.0–16.1 ms). These are one local run, not release performance
budgets, a comparison with the old version or measured CPU savings. Readiness
does not await every asynchronous detail panel. See
[production runtime evidence](redesign-v1.4/production-runtime.json).

## Desktop runtime

`npm run test:desktop` launches two hidden Electron windows with fresh user data
under the worktree and the real compiled dashboard/popup preloads. Production
dashboard and popup render, including popup priority over a conflicting hash.
Renderer-ready IPC and popup dashboard/close action IPC work. The legacy sessions
alias opens History. Sandboxing and context isolation are enabled; Node integration
and renderer `require` are unavailable. No preload errors or external requests
were recorded. A test failure was traced to Electron attaching the popup before
the dashboard; selecting the dashboard by its production URL fixed the original
check without relaxing it. See [desktop evidence](redesign-v1.4/desktop-runtime.json),
[dashboard](redesign-v1.4/dashboard-production.png), and
[popup](redesign-v1.4/popup-production.png).

The main process is a test fixture: these checks verify compiled preloads and
renderer integration, not the installed tray lifecycle or a packaged installer.
They do not install a tray, register tasks, start readers or access a user database.
Build web/tray before running these two scripts.

## Rollback rehearsal

A separate detached worktree, `tmp/worktrees/redesign-rollback-v1.3`, was created
at `redesign-history-hardening-v1.3.0` / `997eaa4`. Its web build passed. The same
production runtime harness then served that prior build against the synthetic
5,000-record database and passed all nine routes, authenticated summaries and
network/write gates. Daemon source is identical between this change and v1.3;
there is no schema migration to reverse. The original and implementation
checkouts were not switched or reset. See
[rollback evidence](redesign-v1.4/rollback-runtime.json), including prior-build
asset hashes. This verifies a prior web build/API recovery path; it does not
rehearse replacing an installed tray or rolling back a real usage database.

## Validation and remaining release work

- Web production build and tray/preload build passed.
- Web unit tests: **122/122** passed.
- History/browser matrix: **144 cases** passed, including new geometry and metadata checks.
- Production runtime and isolated Electron runtime passed.
- No daemon/tray source, schema or dependency changes in this checkpoint. The
  previous daemon 88/tray 196 results remain historical evidence, not new reruns.
- The legacy App still emits the existing approximately 556 KB build warning.

Visual refinements across the eight pages, deterministic reviewed baselines and
SSIM/regional checks, full accessibility review, packaged tray/installer recovery
and complete RC sign-off remain. The browser candidate daemon clock is still real.
Keep the original checkout at `be8e145` and use separate worktrees for this work.
