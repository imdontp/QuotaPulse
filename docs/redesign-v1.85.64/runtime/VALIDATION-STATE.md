# Current64 runtime and Dashboard recovery

Validated bounded runtime checks on application commit e2ea4e1, web index c118de8dec77029c9178d6cd633e2860640e32f86dafdd9a81811c9a3ea8a45d.

- Tray TypeScript and preload builds pass.
- `npm run test:desktop` passes: isolated hidden Electron Dashboard/popup, actual compiled sandboxed preloads, ready/action IPC, legacy sessions alias, command-dialog focus isolation, bundled Thai font and language switching.
- `npm run test:runtime` passes: nine production routes served by authenticated daemon, 5,000 usage records and500,000 tokens, unauthorized request rejected, exact history summary, private path excluded, no external/write requests or page/HTTP errors. Ten local history-summary requests range 20.37–33.98ms, median 28.70ms. These are one-machine observations; they establish no CPU improvement or release performance threshold.
- `npm run test:tray-recovery` passes four checks through actual compiled tray/main: same native window recovers with new renderer and React/preload; document-load failures stop after bounded retries; tray stays alive; reopen creates one replacement Dashboard with a working Pause control.

All tests use isolated profiles and synthetic databases with readers disabled. Desktop smoke uses a fixture main host; recovery additionally exercises actual compiled main. Neither is an installed/package release acceptance check. Actual hang recovery, popup recovery, full current40/UI/repository regression, measured hidden work/CPU, package/rollback and manual source/accessibility acceptance remain open. This does not prove99–100% reference similarity. Original session exits and build/report hashes are recorded in provenance.
