# History observed extent — source145

Validated bounded correction to all-time History. Parent commit `d5b79808b523db8429ed19b923ff68e7bc7d81b3`; the executable [review144 ZIP](../redesign-v1.85.144/README.md) remains unchanged and does **not** contain this later correction. Full redesign and 99–100% original-reference acceptance remain open.

The actual native review144 image exposed an epoch-to-now axis. A reproduction imports the exact original source143 implementation after checking its bytes against commit `8c10e147439c9037131af77449c3ada0a6d9970f`. Two recent events collapse into one 173-day bucket there. The fixed observed extent separates them into hourly bins, with identical totals. No records are discarded or scanned in JavaScript.

The renderer now requests `timeline=observed`. The API derives the chart origin from MIN(recorded timestamp) in the same filtered totals transaction when from=0, including an explicitly epoch-origin query. Nonzero custom intervals retain their full leading/trailing empty intervals. The chart still ends at the requested end, so trailing inactivity remains visible. Genuine timestamp-zero records are retained. With no matching records, the observed chart has no buckets or date labels. Query scope, paging, totals, metadata filters, session/source constraints and CSV export semantics remain complete and unchanged.

Requests without the new parameter keep the original scope-based bucket origin/resolution, preventing an older open renderer from allocating hourly bins across the entire epoch range. `timeline=scope` is also accepted; other values return400. The new renderer/API are delivered together; this is not a claim that a new renderer can run against an older daemon that rejects unknown parameters.

## Validation

Daemon and production web builds pass.126 daemon and351 web tests pass with no failures/skips/cancellations. The regression covers filtered earliest timestamps, bounded intervals, exclusive end, actual epoch data, empty matches, literal query scopes and old-client bins. The compiled production renderer passes8 cases (EN/TH × dark/light ×390/1672): complete source/session scope,20 actual tokens, visible hourly bins, exact keyboard Home/End tooltip values, empty-state axes, no horizontal overflow and no page errors.

The maintained full History/Overview/Projects/Live/Providers/Models/Cost/Alerts integration through Vite also passes on the final opt-in source, including16 language/theme/width sets across nine routes, real authenticated HTTP/in-memory SQLite,53-record pagination, CSV, pause/in-flight snapshots, exact drill-down scopes, occupied layouts and separate money bases. All own browser/server/database handles close. Source hashes and raw logs are retained. This turn does not rerun tray tests, native Electron, full route-loading/performance or installer/migration checks for source145.

An earlier final-source integration run failed its unchanged SSE assertion: two server listeners remained while the client reported one open EventSource (opened6/closed5). The failure log is retained; a later serial passing run does not establish the cause or resolve the intermittent transport-count concern. No assertion, timeout or tolerance was loosened, and no SSE product code was changed. This remains a separate investigation item and prevents an unconditional all-checks-always-green claim.

## Inspect and reproduce

Images: [EN dark desktop](images/en-dark-1672.png), [TH light desktop](images/th-light-1672.png), [EN dark mobile](images/en-dark-390.png), [TH light mobile](images/th-light-390.png). All8 images use owned synthetic QA records; none are application demo content or approved reference baselines. Desktop EN/dark and mobile TH/light were manually inspected. The current-time sparse fixture is not a deterministic original-concept pixel comparison.

From the repository root with its existing dependencies:

```powershell
npm.cmd run build -w @quotapulse/daemon
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/daemon
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history-timeline.mts
node --import tsx scripts/check-history.mts
```

The historical reproducer is retained as evidence, originally run at tmp/repro-history145.mts, and requires the retained frozen source143 worktree. It never opens customer databases. No dependencies, old application data, credentials, Pet behavior, origin or main branch were changed. The separate review144 package is already runnable; source145 still needs a subsequent native/ZIP validation before it replaces that delivery.
