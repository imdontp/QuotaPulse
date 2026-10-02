# Redesign Windows lifecycle v1.20

## Scope

Continues v1.19 on `design/redesign-foundation`, in the separate redesign worktree
and existing origin. The user approved beginning the real isolated lifecycle
test. This checkpoint creates temporary uniquely named Windows tasks and fresh
worktree-local databases, then removes the tasks and stops test-owned processes.
It does not install over the original application or access its usage database.

## Findings and causal fixes

| Observation | Evidence | Correction |
| --- | --- | --- |
| Stopping the PowerShell task left its Node child alive; its Electron child also survived. | Real diagnostic-host reproduction, matching task launcher/child PIDs and scoped cleanup. | Tasks now launch Node/Electron directly through `scripts/task-entry.cjs`; the task owns the application process. Real stop/uninstall assertions check process termination. |
| Starting tray without daemon failed to create a daemon database. | Controlled Electron Node-mode reproduction with an in-memory SQLite DB: Electron Node 24.19.0, module ABI 149, installed SQLite binary ABI 127, `ERR_DLOPEN_FAILED`, exit 1. | Tray fallback launches the native Node executable resolved by installation, rather than Electron's Node mode. No native dependency rebuild or shared dependency change. |
| An intermittent health read was reported as daemon replacement. | Task launch PID 38960 matched the isolated lock PID 38960; the failed comparison used a second readiness read. | Retain the successful readiness result and compare daemon identity from its lock, with bounded readiness retries. |

The first uninstrumented task run also timed out before readiness. Its individual
cause was not established. Direct-entry task-managed lifecycle subsequently
passed twice; this checkpoint does not attribute that earlier timeout to a
proven cause.

## Implementation

`-NoReaders` sets `QUOTAPULSE_READERS=off` in the instance process. The daemon
then skips adapter detection/account probes and cached catalog imports, while
serving its own DB and built dashboard normally. Undefined or `on` keeps normal
collection; an invalid setting fails before opening a DB. Test fixtures remain
empty unless explicitly seeded. This mode is not a read-only database mode.

The CommonJS task entry validates role, port and absolute instance paths before
loading the compiled application. Daemon loading uses dynamic import; Electron
tray loading is synchronous so profile setup precedes readiness. Tray actions
include the resolved native `--node-exe`; the tray inherits the selected instance
environment when starting its detached daemon. Manual tray starts fall back to
`QUOTAPULSE_NODE_EXE` or `node` on PATH and report executable-launch errors.
The older PowerShell runner remains a manual helper, with the same reader/Node
configuration, but is not used by scheduled actions.

Task stop/uninstall owns task-managed processes. The existing independent
collector contract remains: a daemon spawned by tray outside the daemon task
continues after tray closes and after task definitions are removed. The tray-first
test proves this behavior, then explicitly terminates only its own detached
test collector. Production uninstall does not search for or kill those processes.

## Validation

Status: **Validated checkpoint for isolated Windows on-demand lifecycle**.

- Daemon TypeScript build passes after reader-mode changes.
- Tray/preload TypeScript build passes after native Node fallback changes.
- Final targeted tests: **12/12 pass**. Includes invalid CLI/mode rejection,
  compiled daemon startup with zero source/usage/quota/price rows despite a
  synthetic cached catalog, duplicate-instance rejection preserving the original
  lock PID, occupied-port failure without claiming a lock or stopping the port
  owner, legacy/default DB migration and profile/path regressions.
- Synthetic task checks: **9 groups pass**, covering rollback, `-WhatIf`, scoped
  removal, Unicode/space paths, direct entry configuration and native Node tray
  executable forwarding. The ScheduledTask mocks are only used in this suite.
- Real task-managed lifecycle: **9 checks pass**, including install preview,
  configuration, real daemon/tray startup, instance reuse, actual Node/Electron
  parent stop, restart with retained state, uninstall and original/legacy task
  definition hash preservation. No fallback kill was needed on successful runs.
- Real tray-first lifecycle after the ABI fix: **8 checks pass**. Tray starts
  its own detached collector with zero sources; closing tray retains collector;
  uninstall retains that independently owned collector/data; explicit test
  teardown stops the detached process. No unexpected cleanup fallback was used.
- Final tray-first owned PID check: **0 processes alive**. Temporary task
  definitions are removed; fresh synthetic databases/sentinels remain in `tmp`.
- `git diff --check` passes. No web source or dependency manifest/native binary
  changes. v1.18/v1.19 web/hidden-desktop evidence remains historical; those suites
  were not repeated for these startup/lifecycle changes.

Evidence: [task-managed lifecycle](redesign-v1.20/windows-task-verification.json),
[tray-first lifecycle](redesign-v1.20/tray-first-verification.json),
[synthetic tasks](redesign-v1.20/task-verification.json),
[validation summary](redesign-v1.20/validation.json).
Reports omit lock tokens and raw original task XML. Each real run writes its
own attempt report and removes the current success report before starting.

## Commands

```powershell
npm run daemon:build
npm run build -w @quotapulse/tray
node --import tsx --test packages/daemon/test/task-entry.test.ts packages/daemon/test/instance-data.test.ts packages/daemon/test/db.test.ts packages/daemon/test/paths.test.ts packages/tray/test/instance-profile.test.ts
powershell -NoProfile -NonInteractive -File scripts/check-task-isolation.ps1
powershell -NoProfile -NonInteractive -File scripts/check-windows-task-lifecycle.ps1
powershell -NoProfile -NonInteractive -File scripts/check-windows-task-lifecycle.ps1 -TrayFirst
```

The two Windows lifecycle commands operate real temporary tasks. They are not
mock-only checks and should be run only when real task testing is intended.

## Remaining release gates

On-demand start is verified; an actual Windows logon trigger was not exercised.
Real installed tray renderer/recovery, packaging/installer recovery and release
sign-off remain. Native task stop is forced termination, not proof of graceful
SQLite/SSE cleanup; retained-state restart is tested. Manual screen-reader,
typography and approved concept visual baseline/SSIM review remain. This is not
a packaged application release or certification for all Windows environments.
No permanent review instance remains running after these tests.
