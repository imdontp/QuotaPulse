# Current native review163 / source162

The portable application now includes source157–162, including the latest recorded Cost summaries and bounded long-range timeline. It is built from frozen commit `b0490cf96ea00d8284a95ab0fff6a46459957f4e` on the existing redesign worktree; no historical checkout was created.

Archive: `C:\Users\TH12367283\Projects\QuotaPulse\tmp\releases\QuotaPulse-v1.85.162-review163.zip` (206,507,376 bytes; 3,161 files).

SHA-256: `8e8f7656fa875d103c1e3d40ae285bdb26a3df792b2d1e5d49ff6208bbaeb191`.

Extract into a new dedicated folder, then run PowerShell there:

```powershell
.\scripts\start-review.ps1 -EnableReaders
```

Open `http://127.0.0.1:7807/#overview`. Explicit `-EnableReaders` reads installed harness logs and configured quota readers into separate review-data; initial collection can take several minutes. The original database is not imported. Without the switch, a new profile starts empty and collection is disabled. Stop with `.\scripts\stop-review.ps1` before changing launch modes. A restart without the switch retains collected data and disables collection. Pet stays disabled by default, and no logon task is installed. Windows x64 and installed Node with module ABI127 are required (Node22.13.1 was used). `-Port` selects another port. This is an unsigned portable review, not a production installer acceptance.

[Native Cost capture](native-cost.png) · [Actual adapter reading an owned synthetic log](reader-models.png) · [Canonical source162 Cost and concept comparison](../redesign-v1.85.162/README.md) · [Delivery evidence](delivery.json)

Validation covers compiled daemon/main/preload/web, 16 actual native captures (eight routes in initial English/dark and restored Thai/light), Settings/preload IPC, language/currency/rate/theme/window-size persistence through Electron restart, unchanged owned database facts, and no unexpected API mutations or page/preload/placement errors. Every ZIP entry was decompressed and SHA256-compared with the unused source bundle. Separate actual ZIP extractions passed six portable launch/stop/restart checks and six owned-reader lifecycle checks. The latter verifies default readers-off, explicit opt-in, actual Codex ingestion from a fake home, incremental append to190 tokens/one session, no duplicate ingestion on repeated refresh/restart, and default restart disabling collection. No customer logs, credentials or fixture database are included in the delivered ZIP.

The six-stage build receipt explicitly identifies reused successful daemon/web builds and703 repository tests from unchanged source162, plus the current tray build, approved runtime assets and packaging. The production index hash matches source162's compiled browser evidence. Reuse does not claim a second execution of those tests/builds.

Both initial parallel extraction checks ended with null child status before any app launch and left partial extracted trees. Their logs/counts remain in evidence. The local test extractor was changed from PowerShell Expand-Archive to guarded .NET ZipFile; checksum, path traversal protection, empty owned destination,120-second timeout and complete inventory assertions remain. Sequential final checks passed. The original child error was not recorded, so a specific timeout/OS root cause is unproven; no production extractor fix is claimed.

The five runtime/extraction copies created during this round were verified against the delivered archive and cleaned after their processes stopped. Small ASAR files are conservatively retained; the receipt records exact retained and reclaimed bytes. The central ZIP and earlier review156/review150 ZIPs remain. No new branch/worktree or permanent second runtime is retained for this delivery.

Remaining acceptance: physical tray/monitor/minimize behavior, broad resource/customer/provider coverage, current two-version upgrade/rollback and full concept+override visual/control/motion review. Native captures use an owned synthetic fixture and do not establish99–100% visual approval. A concrete next defect seen in the native Cost capture is duplicated rounded money-axis labels for a sub-cent-scale range; preserve totals/tooltips and adapt axis precision in the next source change. Overall goal remains active.
