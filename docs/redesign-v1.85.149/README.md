# SSE canceled-response lifetime — source149

Validated bounded daemon correction. Parent `7062e5f0e7bf97b14f90d19963feb7ef37758dac` (calendar source148). The [review147 ZIP](../redesign-v1.85.147/README.md) remains the previous runnable delivery and does not contain source148/149.

A real HTTP client was held after authentication in a test preHandler, then disconnected before the actual production SSE handler resumed. The raw response was already destroyed and its close event had fired. The previous handler still subscribed data/settings listeners, registered the dead response and created its ping interval. Because close had already happened, its later close listener could not release those resources. Before:0→1 data and0→1 settings listeners on an already-closed response. The normal connected-stream and shutdown controls passed against that same original code.

The handler now hijacks the response and returns before registering resources if the request was aborted or the response is destroyed/already ended. The identical actual-HTTP schedule now retains0 data/0 settings listeners. The regression repeats12 canceled-before-handler cycles, verifies live hello/data delivery and both channel subscriptions, checks actual disconnect cleanup, and checks daemon shutdown ends the stream. Only test cleanup replays close after recording/asserting the old defect so the broken implementation cannot leave its ping timer alive; this replay is not used to obtain the passing measurements.

This is a demonstrated daemon-side mechanism for extra server listeners after a client closes. The individual historical source145 Vite-proxy failure did not retain connection identities, so its exact occurrence cannot be retrospectively proven to be this same race. The unchanged full integration passes after this correction, including its server/client stream assertions, but that single pass is not a claim about every possible proxy failure.

Daemon build and129 tests pass, zero failed/skipped/cancelled. The targeted three tests fail1/pass2 before and pass3 after. The maintained full integration on final source149 (including unchanged source148 calendar UI) passes all sixteen sets of nine routes:144 recorded cases each have at most one server SSE listener. It also passes authenticated HTTP/in-memory SQLite, paging/export, pause/in-flight behavior, exact scopes, occupied layouts and money bases. All owned browser/Vite/server/database handles close. No test assertion, timeout or tolerance changed. Frontend351 tests,42 calendar checks and8 compiled History cases were run on unchanged frontend source148; they were not rerun as new source149 tests.

```powershell
npm.cmd run build -w @quotapulse/daemon
npm.cmd run test -w @quotapulse/daemon
node --import tsx --test packages/daemon/test/sse-lifetime.test.ts
node --import tsx scripts/check-history.mts
```

The original root-level tmp/sse149-repro.mts is retained compressed as evidence; it requires repository imports from that location. All databases are owned in-memory fixtures. No customer profiles, credentials, native settings, Pet, origin/main branch or unrelated user files changed. This source still needs frozen native/ZIP validation. Full99–100% original-reference approval, complete native/provider/performance and migration/rollback gates remain open.
