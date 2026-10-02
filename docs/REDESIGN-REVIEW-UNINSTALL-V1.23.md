# Redesign review uninstall v1.23

## Objective and scope

Validated checkpoint on `design/redesign-foundation`: remove registered review
software, stop only its owned instance and preserve the profile for reinstall.
The original checkout/application, databases and provider accounts are untouched.
Tests use fresh temporary NoReaders instances, with no scheduled tasks or logon
changes. This remains an unsigned PowerShell review package, not a signed MSI/EXE.

## Changes

- Installer metadata now retains `ownedReleases` across successful upgrades and
  rollback, including releases older than the immediately previous version.
  For v1.22 metadata, known active/previous IDs seed this list during upgrade.
- The installer copies standalone `uninstall.ps1` and its profile helper into
  the installation root. They remain available after runtime payload removal.
  Existing root helpers are preserved; future helper revisions can be invoked
  from the corresponding new ZIP's `scripts/uninstall-review.ps1 -Destination`.
- Uninstall validates the installation marker, absolute destination, legacy data
  separation and registered release IDs. Every deletion target must be a direct
  child of that installation's `releases` directory. It traverses each tree without
  following links and refuses reparse entries before stopping or deleting anything.
- `-WhatIf` performs preflight without stopping processes or changing metadata.
  An exclusive installation lock protects actual removal. The marker is checked
  again under that lock. Stop uses the existing PID/creation-time/entry/role/profile
  checks; unrelated or independently owned processes are not force killed.
- Start/rollback are disabled atomically before recursive payload removal. Receipt
  IDs remain until deletion completes, so a file-lock failure can be retried even
  after partial removal. A second completed uninstall is harmless. Database, Electron
  profile, process records, unknown diagnostics and recovery helpers are retained.
- Recursive deletion uses PowerShell `Remove-Item -LiteralPath` with an extended
  absolute path. The target boundary and unlinked tree are checked immediately
  before deletion. A separate synthetic path longer than 260 characters passed
  enumeration/removal in PowerShell 5.1. No cross-shell deletion pipeline is used.
- The v1.23 builder/ZIP include the uninstaller, and ZIP verification requires its
  bytes to match current source. No dependency install, download or native rebuild.

Only registered payloads are removed. Older untracked releases or failed staging
from previous versions remain for inspection; they are not inferred as disposable
from directory names. This is deliberate data/ownership preservation. Reinstall
using the same ZIP can reactivate the retained profile. There is no purge-data mode.

## Try it

Requires Windows x64 and native Node ABI **127** for app startup; this environment
uses **v22.13.1**. Readers stay off. ZIP:
`tmp/review-bundles/QuotaPulse-v1.23-3dmUsg.zip` (about 191 MiB).

Extract the ZIP, open PowerShell in the extracted folder, then install into a new
dedicated destination, or upgrade the existing review destination while stopped:

```powershell
$zip='C:\path\to\QuotaPulse-v1.23-3dmUsg.zip'
$sha='462c59971703c8d366af9aceb6ba9ab4ca5bea18c77c0a539b2ae5f33afcbe1c'
$destination=Join-Path $env:LOCALAPPDATA 'QuotaPulseRedesignReview'
./scripts/install-review.ps1 -Archive $zip -ExpectedSha256 $sha -Destination $destination
& (Join-Path $destination 'start.ps1')
# Open Dashboard from the review tray icon.
& (Join-Path $destination 'uninstall.ps1') -WhatIf
& (Join-Path $destination 'uninstall.ps1')
```

Uninstall can stop a running review instance. To retry a failed removal, run that
root `uninstall.ps1` again after releasing the reported locked file. Reinstall uses
the same installer command; `review-data` remains in the destination. Portable
start/stop remain available. The uninstaller requires a versioned installation
marker; it does not delete arbitrary extracted ZIP folders.

## Validation

| Check | Result |
| --- | --- |
| Installation/upgrade/rollback/uninstall | **17 groups pass**, actual ZIP/runtime outside repository dependencies. |
| Uninstall preflight | Malformed ownership receipt and a real nested junction rejected; outside sentinel unchanged. |
| Running preview | WhatIf keeps active pointer, software and live daemon/tray. |
| Removal failure/retry | Actual open-file delete failure stops only this instance, disables launch, retains receipts/profile; retry removes all three registered releases. |
| Data retention/reinstall | Synthetic SQLite table survives upgrade, rollback, uninstall and reinstall; reinstalled daemon/tray starts. |
| Actual v1.22 compatibility | **3 groups pass**: shipped v1.22 ZIP creates metadata without receipts, v1.23 registers old/new versions, uninstall removes both and preserves exact stopped DB SHA256 plus profile sentinel. |
| ZIP integrity | **3,117 files**, **199,810,185 bytes**; every entry decompressed and SHA256-compared with source, no review profile. |
| Dependencies | Existing 87 runtime packages and 114 web license inventories retained; no manifests/lockfile/native binary changed. |
| Cleanup | Zero test-owned Node/Electron processes after final validation. No tasks installed. |
| Original checkout | Clean on `feat/openai-subscription-quota`, HEAD `be8e145039247958992fa7673a9c77e1bff35db1`. |

Evidence: [17-group integration](redesign-v1.23/installation-verification.json),
[real v1.22 upgrade](redesign-v1.23/legacy-upgrade-verification.json),
[archive](redesign-v1.23/archive-verification.json),
[validation summary](redesign-v1.23/validation.json).

```powershell
node --import tsx scripts/build-review-bundle.mts
powershell -NoProfile -NonInteractive -File scripts/archive-review-bundle.ps1
powershell -NoProfile -NonInteractive -File scripts/check-review-installation.ps1
powershell -NoProfile -NonInteractive -File scripts/check-review-legacy-upgrade.ps1
```

The larger integration upgrade fixtures modify manifest labels only; the legacy
check uses the actual prior ZIP/installer. Both versions have the same compiled
application/schema. Different-schema downgrade compatibility is not established.
Tests do not contain live account data or publish lock tokens. Previous delivered
v1.21/v1.22 ZIPs remain unchanged. Source diff was checked for scope and whitespace.

## Remaining release gates

Signed installer, actual Windows logon, different-code/schema migration, native
pet/popup/unresponsive recovery, physical tray clicks and manual accessibility,
typography and concept approval remain. Portable/browser/native-dashboard recovery
results from earlier checkpoints are historical and were not repeated for this
uninstall change. Forced termination is not proof of graceful SQLite/SSE shutdown.
The installation directory intentionally remains with retained profile/diagnostics.
