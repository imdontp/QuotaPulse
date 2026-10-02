# Redesign tray recovery and Windows review bundle v1.21

## Objective and scope

Validated checkpoint on `design/redesign-foundation`, in the isolated redesign
worktree with the existing origin. Continue the approved blueprint implementation
by exercising the real compiled tray/main recovery path and delivering a local
Windows UI review ZIP. The original checkout, database and provider accounts are
preserved. No permanent tasks or live readers are started.

## Finding and correction

The first full-main Playwright launch failed before readiness: Electron retained
runtime switches before the application entry, and `parseArgs` interpreted
`--remote-debugging-port` as an application option. A controlled launch log showed
`ERR_PARSE_ARGS_UNKNOWN_OPTION`. The launcher now locates its own entry in argv
and strictly parses only subsequent application arguments. Unknown application
options still fail. This does not relax role, port or absolute-path validation.

The previous Electron preload fixture did not establish full main recovery. The
new harness runs the real compiled main and built dashboard, with sandbox and
context isolation enabled, an isolated Electron profile, a synthetic in-memory
daemon and no adapters. It invokes the existing dashboard-open action, crashes
the native renderer using Electron's
[forcefullyCrashRenderer API](https://www.electronjs.org/docs/latest/api/web-contents),
and observes native window identity, renderer replacement and readiness IPC.
When document loads are intentionally blocked, bounded recovery closes the
failed window; reopening creates one functional replacement window. The harness
checks the actual loaded metrics and working pause control after reopening.

## Review bundle

`build-review-bundle.mts` copies existing compiled daemon/tray/web output,
preloads, approved runtime pet assets and **87 installed runtime packages**,
including Electron and the existing SQLite native binary. It performs no install,
download or native rebuild. Installed notices for **114 web dependency packages**
are retained separately, along with the bundled Thai font's OFL/provenance files.
This inventory is packaging evidence, not a legal compliance certification.

The start/stop helpers use hidden processes and a fresh `review-data` directory
inside the extracted bundle. Readers and account probes are disabled. The start
helper refuses an occupied port or an already running review instance, supports
`-WhatIf`, disables the pet for initial review, and restores the caller's
`ELECTRON_RUN_AS_NODE` environment. Stop handles tray before daemon and checks
entry path, data path, role, PID and process creation timestamp before stopping
only the recorded processes. Data is retained. No scheduled tasks are registered.

**Prerequisite:** Windows x64 with installed native Node matching module ABI
**127**; this environment used **Node v22.13.1**. Node is not redistributed in
the ZIP. The existing SQLite binary needs that ABI. This is an unsigned unpacked
review bundle, not an installer or a production release.

The ZIP contains **3,114 files**, **199,802,583 bytes** compressed (about 191 MiB),
and no application review profile. Every ZIP entry was decompressed and SHA256
compared with its built source. Required executable, native SQLite, preload,
default pet, Thai font and Geist license entries were checked. Legacy .NET ZIP
creation used Windows separators; the archive writer now explicitly uses `/`
entry names and loads both compression assemblies for PowerShell 5.1.

Archive SHA256:
`ab6917123cb442bc3717cea04e8768754804f8590e9a777266b98dcbbb7114ec`

Local artifact (ignored `tmp`, not committed to Git):
`tmp/review-bundles/QuotaPulse-v1.21-vupOFl.zip`.
The exact path and checksum are in [archive evidence](redesign-v1.21/archive-verification.json).

### Try the review

Extract the ZIP into a new folder, open PowerShell there, then run:

```powershell
./scripts/start-review.ps1
# Use this review instance's tray icon to open Dashboard.
./scripts/stop-review.ps1
```

Default port is 7807; `start-review.ps1 -Port 7808` can select another available
review port. New usage is empty because readers are off. Closing the tray alone
retains its daemon; use `stop-review.ps1` to stop the whole review instance.
The helpers preserve the extracted folder's data for later review.

## Validation

| Check | Result and evidence |
| --- | --- |
| Task-entry regression tests | 3/3 pass: invalid options, compiled NoReaders startup/reuse, occupied-port ownership. |
| Synthetic task checks | 10 groups pass, including runtime-prefix exclusion and Unicode/space paths. All ScheduledTask cmdlets mocked. [Report](redesign-v1.21/task-verification.json). |
| Tray asset/recovery unit tests | 24/24 pass across wave4, wave5 and pet-assets. |
| Real compiled main recovery | 4 checks pass. [Source runtime report](redesign-v1.21/tray-recovery-verification.json). |
| Final bundle start/stop | 5 checks pass outside the repository dependency tree: start/stop WhatIf, real daemon/tray startup, scoped stop/data retention, retained-state restart. [Report](redesign-v1.21/bundle-verification.json). |
| Final bundle dashboard/recovery | The same 4 native recovery checks pass using its own copied Electron, main, preloads and web output. Synthetic daemon is supplied by the harness. [Report](redesign-v1.21/bundle-recovery-verification.json). |
| Runtime assets | 209 source-identical files for 8 approved characters; validation has no errors. Existing 172 non-canonical raster naming warnings are retained. [Inventory and warnings](redesign-v1.21/asset-package-verification.json). |
| ZIP integrity | All 3,114 entries match source bytes; required runtime/license entries present. [Report](redesign-v1.21/archive-verification.json). |
| Cleanup | No review-owned Node/Electron processes remain after final tests. No real ScheduledTask changes this checkpoint. |
| Original checkout | Still clean on `feat/openai-subscription-quota`, HEAD `be8e145039247958992fa7673a9c77e1bff35db1`. |

Commands used for the final scoped validation:

```powershell
node --import tsx --test packages/daemon/test/task-entry.test.ts
powershell -NoProfile -NonInteractive -File scripts/check-task-isolation.ps1
node --import tsx packages/tray/scripts/validate-pet-assets.ts --json
node --import tsx --test packages/tray/test/wave4.test.ts packages/tray/test/wave5.test.ts packages/tray/test/pet-assets.test.ts
node --import tsx scripts/check-asset-package.mts
npm run test:tray-recovery
node --import tsx scripts/build-review-bundle.mts
node --import tsx scripts/check-review-bundle.mts
# For the bundle recovery run, QUOTAPULSE_REVIEW_ROOT is the tested extracted folder.
npm run test:tray-recovery
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
```

The asset unit suite imports the existing packager and refreshes the isolated
worktree's `dist-package` output. Its target was checked before the run. New source
changes affect the launcher and review/test tooling; dependency manifests, lockfile
and shared installed dependencies are unchanged. The final diff was checked for
scope, credentials and whitespace. Reports contain synthetic state and paths,
not lock tokens or provider credentials.

## Remaining work

Dashboard renderer crash/load failure is verified. Physical tray clicks,
pet/quota-popup recovery and a truly unresponsive renderer remain separate checks.
Forced process stops are not proof of graceful SQLite/SSE shutdown. Retained-state
restart is tested. Actual Windows logon, signed installer and installer recovery,
manual screen-reader/typography review, approved concept visual baseline/SSIM and
release sign-off remain. Historical web suites and v1.20 real task lifecycle
evidence were not rerun for this checkpoint. The screenshot is diagnostic evidence,
not a visually approved concept baseline or live account data.

Next: installer packaging and recovery with an isolated target, then the remaining
logon and manual visual/accessibility review gates.
