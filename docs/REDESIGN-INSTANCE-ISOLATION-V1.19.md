# Redesign instance isolation v1.19

## Scope and findings

Continues the approved redesign on `design/redesign-foundation` in its separate
worktree, using the existing QuotaPulse origin. The original checkout and
installed application remain untouched.

Inspection found that the old installer printed `-Port` without forwarding it
to the daemon, automatically removed legacy/default task definitions, and had
no named-instance option. An explicit data directory could also trigger legacy
data adoption. Electron settings/cache remained in its default profile even
when the usage database was separated. The uninstaller used lock-file PIDs and
a broad Electron process search.

## Changes

- Named logon tasks use `<InstanceName>-daemon` and `<InstanceName>-tray` in the
  root task folder. A named instance requires its own absolute data directory
  and a port other than 7676. Normalized paths overlapping the default or legacy
  directories are rejected. All task operations specify the root task path.
- Both installer and uninstaller support `-WhatIf`. Existing definitions require
  `-Replace`; registration failure attempts to restore exported XML definitions
  and remove newly created definitions. Rollback errors are reported. This is
  recovery for definitions, not a transaction over running processes.
- The task runner forwards process-local port/data settings. Tray execution
  clears `ELECTRON_RUN_AS_NODE`, quotes the entry path, runs hidden, waits for
  Electron and returns its exit code. It does not change persistent environment
  variables. Dependency resolution supports the nested worktree layout.
- Explicit `QUOTAPULSE_DATA_DIR` disables legacy data adoption. The default
  instance retains the existing upgrade behavior.
- The compiled instance-profile helper creates `<DataDir>/electron` and sets
  both Electron `userData` and `sessionData` before readiness. See the
  [Electron app path API](https://www.electronjs.org/docs/latest/api/app).
- Uninstall stops only the selected task definitions, tray first, when requested.
  Manually started processes, data and locks are retained. Automatic legacy task
  deletion during install and broad PID/Electron termination are removed.

## Validation

Status: **Validated checkpoint for source changes and isolated fixtures**.

- Daemon TypeScript build passes.
- Tray and sandboxed preload TypeScript builds pass.
- Targeted Node tests pass: 9/9. Separate child processes use synthetic
  `LOCALAPPDATA` fixtures to verify default legacy adoption and explicit-instance
  preservation. Profile tests verify both path overrides and separate instances;
  existing schema-upgrade/path behavior tests also pass.
- PowerShell task harness passes 8 groups, including invalid/shared paths,
  spaces and Thai in paths, `-WhatIf`, `-NoTray`, replacement preflight, unchanged
  original/legacy definitions, partial registration rollback, scoped uninstall,
  daemon runner environment and mocked tray launch/exit propagation. Every
  ScheduledTask cmdlet is shadowed; no real tasks are queried or modified.
- Hidden Electron integration passes with an in-memory synthetic DB. The host
  calls the real compiled profile helper; Electron reports identical instance
  `userData` and `sessionData` paths under the owned fixture. Existing built
  dashboard/popup, compiled preloads, IPC, sandbox, native modal keyboard behavior,
  bundled Thai font and external-request guards pass.
- `git diff --check` passes. No web source changed; browser screenshot/history
  suites were not repeated. Their previous v1.18 evidence remains historical.

Evidence: [task checks](redesign-v1.19/task-verification.json),
[desktop checks](redesign-v1.19/desktop-verification.json),
[validation summary](redesign-v1.19/validation.json).
The task success report is removed before testing so a failure cannot retain
an older successful report.

## Next release gate

The README contains review-instance preview/install/uninstall commands. The
scripts are ready for a separately approved manual Windows lifecycle test;
they were not used to install or start a real application in this checkpoint.
That test must cover logon/start, tray-spawned daemon ownership, task-managed
child shutdown, restart, occupied port, preserved existing app/history and
removal/recovery. Actual tray/main lifecycle and packaged installer recovery
remain unverified. No release claim is made from mocked task checks.

Manual screen-reader/typography review, approved concept visual baseline/SSIM,
packaging and release sign-off remain as recorded in v1.18. No live provider
account or user usage database was accessed.
