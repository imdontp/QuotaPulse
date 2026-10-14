# Loading72 case isolation

Changed only tmp/loading72-probe.mts; fixture helper unchanged. No browser/daemon/build/tests/Git run. Source structure reviewed read-only.

- Fresh in-memory DB, Scheduler([]), Fastify server and ephemeral loopback host are created **inside** each of the6case iterations.
- Each case asserts4enabled sources and populated limits before browser requests. Real POST refresh remains unchanged, and intentionally disables that case's nonexistent sources.
- After case: cold retry requires all enabled0/limits0; read-only deferred case requires enabled1/populated limits. Both require historical usage row count and source identity/account metadata preserved.
- Result records before/after source flags, quota windows, usage count and actual host, making factual changes explicit.
- Cleanup releases deferred routes, closes browser context, stops Scheduler, closes Fastify and DB. Outer finally closes any fixture still active after setup failure, then restores Date/TZ. One headless browser is shared across independently isolated contexts.
- Parent's pending/ready font waits, pending child-size diagnostic, actual selected-project identity wait and unchanged2px geometry assertions remain in place. No tolerance relaxed.

Probe SHA256: eca917d2de786c6539b6a465f0bd79d6a07fa1020581d6b2202548cb59467e08.
Fixture helper SHA256:4ea5ec17d9c1b0347593188fdc2c93e598da568d01f3fb80cfc2b38e3fb63a08.

This is static source review only; root must execute against frozen built72. Previous failed probe evidence remains retained.
