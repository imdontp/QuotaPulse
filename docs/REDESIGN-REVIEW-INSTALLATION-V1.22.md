# Redesign isolated review installation v1.22

## Objective and scope

Continue the approved blueprint on `design/redesign-foundation` with a versioned
Windows review installation, upgrade and rollback. This is a PowerShell installer
for the unsigned review ZIP, with native Node ABI 127 as a prerequisite. It is not
a signed MSI/EXE or a production release. Original checkout/data/provider accounts
are preserved. No tasks, shortcuts, registry entries or live readers are installed.

## Changes

- `scripts/install-review.ps1` validates the supplied ZIP SHA256, rejects nonempty
  unowned destinations, legacy data overlap, linked paths, duplicate ZIP names,
  traversal and embedded review profiles, and checks required runtime entries.
- Each ZIP has a separate `releases/release-<archive-sha256>` directory. The
  installation's `review-data` stays outside those directories. `installation.json`
  records the active and retained previous release. Root `start.ps1`, `stop.ps1`
  and `rollback.ps1` dispatch to the active release.
- Extraction finishes in a fresh staging directory before publication. The active
  pointer is replaced atomically. A failed first install retains an identifiable
  inactive target. Failed activation moves the new payload back to staging, keeps
  the old pointer/data and permits retrying the same ZIP. Inert staging and pending
  metadata are retained for diagnosis; this installer does not delete user data.
- An exclusive installation lock covers release changes and installed starts.
  Process ownership is checked again under that lock. Running instances block
  upgrade/rollback. A startup lock also prevents concurrent portable starts.
- `review-profile.ps1` allows an installed runtime to use only its installation's
  fixed profile, verifies its active-release identity and rejects reparse paths.
- Start checks platform/architecture as well as Node ABI. Failed starts invoke
  cleanup only after this invocation records a child. Stop checks PID, creation
  timestamp, entry, role and data directory, stops tray before daemon, then waits
  up to 15 seconds for matching Node/Electron processes to exit. It never force
  kills additional children discovered during that wait.
- The packager includes these helpers. ZIP creation refuses helpers that differ
  from current source, and SHA256 compares every decompressed ZIP file with its
  source. Runtime dependencies are copied from the existing installation; nothing
  is downloaded, installed or rebuilt.

## Diagnosis during validation

The initial installer failed with `The path is not of a legal form` at
`File.Replace`. A controlled temporary-file reproduction showed the same error
with PowerShell `$null` as the backup string argument. Passing
`[System.Management.Automation.Language.NullString]::Value` replaced the file
successfully. Microsoft's [NullString API](https://learn.microsoft.com/en-us/dotnet/api/system.management.automation.language.nullstring)
documents its purpose for null string arguments to .NET methods. The installer
uses that value. A subsequent full integration run passed atomic activation and
rollback. A non-elevated probe separately encountered sandbox access denial; the
authorized isolated reproduction established the argument fix outside that limit.

An early upgrade run's immediate post-stop rollback was blocked by the running
process guard. The later scoped query found no remaining processes; that alone
does not establish which process was observed at the guard. Stop now explicitly
waits for shutdown and reports remaining PIDs on timeout. Final integration covers
immediate upgrade/rollback after this wait.

The PowerShell provider move also failed while publishing a full release. Direct
`Directory.Move` later encountered an access denial immediately after extraction;
the exact same source/destination rename succeeded when retried later. The holder
and the provider failure's precise mechanism were not established. Publication
and recovery now use direct directory rename with a ten-second retry bound only
for access/sharing errors, while the source exists and destination is absent.
The active pointer is still switched only after publication completes. Permanent
denials fail rather than changing permissions or stopping unrelated processes.

## Try it

Windows x64; installed native Node ABI **127**, tested with **v22.13.1**. Extract
`QuotaPulse-v1.22-d255e5bc.zip` into a fresh folder, then open PowerShell there.
Portable review remains available:

```powershell
./scripts/start-review.ps1
./scripts/stop-review.ps1
```

For a versioned installation, replace the ZIP path below with its actual location:

```powershell
$zip='C:\path\to\QuotaPulse-v1.22-d255e5bc.zip'
$sha='3bfec2f507fff8fbefd3a286f949ea84cc9ab56c23dc9ae79666680a987f7450'
$destination=Join-Path $env:LOCALAPPDATA 'QuotaPulseRedesignReview'
./scripts/install-review.ps1 -Archive $zip -ExpectedSha256 $sha -Destination $destination -WhatIf
./scripts/install-review.ps1 -Archive $zip -ExpectedSha256 $sha -Destination $destination
& (Join-Path $destination 'start.ps1')
& (Join-Path $destination 'stop.ps1')
# After a later ZIP has been installed, while this instance is stopped:
& (Join-Path $destination 'rollback.ps1')
```

Use a new dedicated destination. No app starts during install. Default review
port is 7807; the root start wrapper supports `-Port`. Readers remain off and a
fresh usage database is empty. Open Dashboard from the review tray icon.
Upgrade uses the same installer command with the new ZIP/checksum. Rollback
switches the runtime only; it does not restore a prior database snapshot. Binary
removal/uninstall and arbitrary future schema downgrades are not implemented here.

## Validation

The integration test installs the actual ZIP outside the repository dependency
tree and opens its own real Node daemon/Electron tray. Upgraded and failed-activation
fixtures change only the manifest checkpoint; runtime code/schema stay the same.
The retained database includes an explicitly seeded synthetic table, checked
after upgrade, rollback and retry. During a forced activation failure, the pointer
text and database SHA256 must remain exactly unchanged. No production DB is opened.

Final result: **11 installation checks and 5 portable checks pass**. Cleanup
found zero test-owned Node/Electron processes. Original checkout remains clean
on `feat/openai-subscription-quota` at `be8e145039247958992fa7673a9c77e1bff35db1`.
No dependency manifest, lockfile or installed native binary was changed.

Final evidence is in [installation report](redesign-v1.22/installation-verification.json),
[portable regression report](redesign-v1.22/portable-verification.json),
[archive verification](redesign-v1.22/archive-verification.json) and
[validation summary](redesign-v1.22/validation.json).

```powershell
powershell -NoProfile -NonInteractive -File scripts/check-review-installation.ps1
node --import tsx scripts/check-review-bundle.mts
```

The installer checks cover previews, checksum failure, traversal, unowned target
preservation, real install/start/stop, exclusive locks, duplicate starts, running
upgrade/rollback rejection, retained-data upgrade/rollback, actual file-sharing
activation failure and successful retry. Portable checks cover start/stop previews,
real startup, scoped stop/data retention and retained-state restart.

Archive: **3,116 files**, **199,807,830 bytes** (about 191 MiB). Every entry was
decompressed and SHA256 matched. It contains no review profile, keeps the existing
87 runtime packages/114 web license inventories, and adds the installer/profile
helpers. Intermediate unshipped candidates were refreshed after causal fixes;
the final ZIP's helpers match current source. The v1.21 delivered ZIP is unchanged.

## Remaining gates

Signed installer, removal/uninstall, actual Windows logon, different-code/schema
upgrade/rollback compatibility, pet/popup/unresponsive recovery, physical tray
clicks and manual accessibility/typography/concept approval remain. v1.21 native
dashboard crash recovery and prior browser/real-task suites are historical
evidence; they were not rerun for these installation scripts. No permanent review
instance is left running by the automated tests. This checkpoint does not certify
all Windows hosts, authentic signatures or future database migrations.
