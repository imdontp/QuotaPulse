# Dev proxy canceled SSE cleanup / source154

The shipped Vite development proxy could retain a daemon SSE subscription when the browser disconnected before upstream response headers. The daemon is still waiting in an asynchronous hook, so it cannot know that the downstream browser has gone: the proxy leaves its own upstream socket alive. Once the hook resumes, the daemon correctly starts an SSE stream for that still-live socket, leaving one data and one settings listener with no browser consumer.

An isolated real HTTP reproduction holds the authenticated daemon preHandler, closes the downstream client, then releases the handler. With the previous dev proxy, the upstream is still open and listener counts become1/1. With early downstream-close forwarding, the upstream is already destroyed before release and counts remain0/0. The daemon's existing abort guard from source149 is unchanged and handles the forwarded abort correctly. This causal control distinguishes the proxy defect from a daemon listener cleanup failure.

The fix binds downstream response close during proxyReq, before headers can arrive, and destroys that upstream request. It also checks response.destroyed in case close has already occurred. It applies only to the exact /api/events/stream pathname and preserves token query parameters. Normal requests remain unchanged. A small typed helper is shared by the actual vite.config.ts and the existing full integration harness, which previously carried its own early-close callback. No new dependency, production transport, runtime API or data schema is introduced.

## Validation

The new regression loads the actual shipped dev proxy options. Before the fix, the canceled-before-headers case fails because the upstream close never arrives; the live-stream case passes. After the fix both pass. Eight controlled early-abort cycles leave both listener counts0. The second case confirms hello/data delivery, an independent successful health request without ending SSE, and actual upstream response close after normal client disconnect. Cleanup destroys owned response sockets only after assertions; it does not replay close events to satisfy them. All test resources terminate.

All353 web tests pass with0 failures/skips/cancellations, including these2 new tests. The3 direct daemon SSE abort/disconnect/shutdown regressions pass independently. The maintained full dashboard integration completes its144 responsive cases with at most one server listener after navigation, but later FAILS in checkAlertsLayout: Quota chart uses stretched coordinates. The complete suite therefore does not pass. That assertion's original width/viewBox values were not included in the old error message, so the exact geometry and root cause remain unproven. The chart initializes its coordinate width to600 and measures it in a ResizeObserver effect; a timing hypothesis must still be tested rather than assumed. Its assertions and cleanup budget are unchanged; only the duplicated proxy configure callback now references the shared helper. TypeScript checking of vite.config.ts and vite-sse-proxy.ts exited0 with no diagnostics. The proxy fix is validated in isolation; broader integration remains partially validated until the Alerts failure is resolved.

```powershell
node --import tsx --test packages/web/test/vite-sse-proxy.test.ts
npm.cmd run test -w @quotapulse/web
node --import tsx --test packages/daemon/test/sse-lifetime.test.ts
node --import tsx scripts/check-history.mts
node C:/Users/TH12367283/Projects/QuotaPulse/node_modules/typescript/bin/tsc --noEmit --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler packages/web/vite-sse-proxy.ts packages/web/vite.config.ts
```

The current compiled renderer index remains exactly source153 047c35f7e6bd34cf7eb86ec5c65419266968dada8e1ec566317371f3bbede3c1, verified against its committed delivery manifest; no renderer rebuild, native run or new ZIP was needed for this dev-server change. The source153 visual gallery remains current. Review150 remains the previous runnable ZIP and does not include source151–154.

## Bounds of the conclusion

This fixes the demonstrated shipped-development-proxy defect. It does not establish the cause of every historical server2/client1 integration failure: source152's integration already installed an early-close callback, so that separate intermittent observation remains unexplained. The current144-case transport portion does not close that investigation. The newly observed Alerts coordinate assertion,105 Providers header pixels and3 Models edge pixels from source153, original reference99–100% approval, remaining visual/control/motion, native/customer/provider, tray/monitor, performance and migration/rollback acceptance remain open. Main and unrelated work are preserved. Evidence includes exact red/green logs, causal measurements, the full integration failure log and completed matrix, source hashes and reproducible owned-fixture code.
