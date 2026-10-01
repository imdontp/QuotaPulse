# Redesign compatibility checkpoint — 1.2.0

Branch: `design/redesign-foundation`. Tag: `redesign-compatibility-v1.2.0`.
Follows [Hardening 1.1](REDESIGN-HARDENING-V1.1.md). This is an implementation
checkpoint, not an application release or deployment.

## Routes and preferences

All nine canonical destinations now use the shared shell. History and Settings
retain their existing working controls, with reader diagnostics available under
`#settings?section=diagnostics`. The eight-screen blueprint has no Settings image.
The tray readiness callback and document language are applied by the shared shell.

Legacy `usage`, `today`, `trend`, `sessions`, `sources`, `limits`, and `health`
aliases map to the blueprint destinations using `replaceState`. Valid scope and
entity keys survive migration. Browser Back/Forward is verified. `?mode=popup`
takes precedence over the hash, and `?mode=legacy` remains available for prior UI
compatibility and recovery. Live and Alerts no longer require an opt-in hash.

## Scope

Overview, Projects, Models, and Cost share calendar boundaries: local midnight,
Monday for this week, and the first day of this month. Models defaults to this
month and Cost to all time. Cost also retains a separate rolling last-30-days
option. Imported custom `[from,to)` ranges and source filters apply to the read
requests and survive History drill-down. Imported scope is visible, and stale
in-flight results cannot replace another scope. Invalid custom bounds fall back
to the destination default. Canonical routes preserve compatibility parameters;
page readers validate values before making requests.

## Keyboard and stream lifecycle

The command palette contains Tab/Shift+Tab focus and restores its trigger on
Escape or dismissal. Reader diagnostics respond to same-page source hash changes.

The extended browser capture exposed a daemon teardown failure: the SSE handler
held an unresolved promise and relied on request close for cleanup. SSE now uses
Fastify's hijacked response, releases listeners/timers on response close, and ends
remaining streams during `preClose`. An isolated HTTP regression verifies client
disconnect, scheduler listener removal, and shutdown with an active stream.

## Evidence and remaining work

Run commands and exact results are recorded in `redesign-v1.2/validation.json`.
The browser suite verifies real authenticated HTTP against synthetic in-memory
SQLite. Prior dashboard/popup behavior is exercised separately in legacy mode.

Eight viewport captures and their measured shell regions are in
`redesign-v1.2/review-candidates.json`. They use English/dark, DPR 1, local fonts,
reduced motion, and each concept's exact viewport. The browser clock is fixed at
fixture creation; the daemon clock is real and recorded as such. These are review
candidates, not approved deterministic baselines. No SSIM score or visual approval
is claimed. A first comparison shows History still needs the concept's Usage
Timeline and a more compact record/detail layout. Geometry and typography of all
eight screens require review before accepting baselines and enforcing regression
SSIM. Runtime profiling, the complete redesigned browser matrix and RC/rollback
gates remain. The entry bundle is about 275 KB minified; the legacy App chunk still
exceeds Vite's 500 KB warning threshold.

The original checkout and its branch are unchanged. No installed daemon, scheduled
task, tray package, customer usage database, or live provider account was changed.
