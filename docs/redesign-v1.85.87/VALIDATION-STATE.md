# Models exact row trends - v1.85.87

## Partially validated toward the full redesign

Restores the original Models comparison Trend column using persisted model plus recorded-provider observations. Scope, totals, full-list search and sorting remain factual. Comparison pages render at most 20 rows, with up to 30 bins each; selected detail survives manual paging. No concept curve or capability score is fabricated.

One authenticated batch read uses exact null/empty/case-sensitive pairs, shared usage predicates and parameterized SQL. Short requests use GET; request targets above 8000 UTF-8 bytes use one read-only POST with scope in query. Limits apply together: 1-20 pairs, each identity null or at most 4096 JS string units, and serialized pairs at most 262144 UTF-8 bytes. Larger multibyte combinations return an explicit error; identities are never truncated. No schema/dependency or original endpoint default change.

## Current evidence

- Daemon and web builds exit 0. Repository tests: 113 daemon +235 web +198 tray = **546 passing**, no failures/skips.
- Actual loopback HTTP unit test supports 20 maximum-length ASCII pairs via POST, verifies GET/POST parity, auth, validation, unchanged database snapshot and total_changes. This does not claim every maximum-length Unicode combination fits the total byte budget.
- Built-web browser gate passes **8 cases**: EN/TH x dark/light x1672/390. Real memory DB, API and SSE; synthetic fixture only. Exact null/empty identities, deep-link page, keyboard paging, retained detail, no document overflow, and native table fit pass.
- Every case exercises missing endpoint 404 after a valid snapshot, retained graph and one keyboard retry batch. Initial-load 404 is not separately browser-proven.
- EN dark1672 additionally delivers an older held response after a newer accepted response, proves no overwrite, and checks retained503/retry. 1265 exact pairs render 20 rows and at most600 trend circles; native fit rechecked with20 larger identities.
- New helper tests exercise encoded transport threshold, Unicode preservation, pagination/clamping and unavailable/no-history/zero distinction. Browser transport here uses ordinary short fixture names; long transport proof is the real HTTP test plus client helper tests.
- Production web index SHA256: `ffcc8030ef0d2c81793dbdbc3be13d77cb379e8ed4c6cabaf382737860ac61f7`.

## Review and remaining limits

The archived initial independent review predates POST and strengthened browser coverage. Its GET-envelope issue is addressed by the transport fallback and actual HTTP test. Its 404-after-snapshot, retry request-count, large-row native fit and light-theme gaps now have browser evidence; initial404, per-page/SSE request counts, scope-navigation races, retry-after-unmount,1536 geometry and production-history query timing remain unproven by this gate.

Existing full group payload, sorting and provider aggregation remain O(N). Bounded visible rows/bins do not prove constant whole-screen cost. EXPLAIN proves an access path, not a production performance SLO.

Source comparison: the original Models reference includes the rightmost Trend column; OVR-015/016 do not remove it and OVR-022 forbids copied factual curves. See blueprint authority. Current sparks are uniformly blue; original palette has multiple colors. Screenshots are functional fixtures, not equal-content visual baselines or a numerical likeness measurement. No new artwork candidate is shipped.

Previous Models/Projects canonical repeat failures from85 remain unresolved. No current full40, all-eight visual acceptance, native first-frame/packaged installer/previous-version rollback or release acceptance is claimed. The new rollback harness files remain outside this checkpoint. Continue Source palette/typography/composition and broader release checks before closing the goal.
