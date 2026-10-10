# History performance next-goal audit

Status: source/evidence review plus authorized causal measurement on a synthetic in-memory database. No application edits, build, services, browser sessions, customer data, ports, network, or live probes. All artifacts are under ignored tmp.

## Highest concrete bounded-work gap

History effort-category cardinality is unbounded across both the summary payload and the rendered summary list. This is a source-proven growth mechanism, not evidence of observed production slowdown or a breached numerical target.

- `packages/daemon/src/db/schema.ts:79`: `effort TEXT`, without a category enum or SQL constraint.
- `packages/daemon/src/adapters/types.ts:55`: `effort?: string | null`; Claude adapter `claude-code.ts:248` passes source effort, and `ingest/sink.ts:315` preserves `e.effort ?? null`.
- `packages/daemon/src/api/history-summary.ts:22`: groups every distinct source effort; line23 materializes every group with `.all(where.params)` and no limit. N distinct nonnull efforts yields N category rows (plus null when present).
- `packages/web/src/redesign/history-timeline.tsx:46`: maps every returned effort row into a list item in the summary panel, without pagination or a render ceiling.

One-variable comparison: identical N event rows, scope, timestamps, totals and tokens; only effort changes from one repeated category to N distinct category strings. The authorized direct-function measurement below confirms category/payload growth. Rendered DOM count and browser CPU/render duration remain unmeasured.

Do not normalize unknown source strings into a fabricated standard effort scale. Blueprint History contract line13 explicitly says effort is a source category. Any fix must preserve source identities and reconcile their record/call counts.

## What is already bounded / verified

- The main record table requests50 rows per page (`packages/web/src/sections/history.tsx:103`) and maps only `snapshot.rows` (line189).
- API parser bounds record limit1..500 (`packages/daemon/src/api/usage-scope.ts:101`); SQL uses LIMIT/OFFSET and a same-transaction count (`packages/daemon/src/api/queries.ts:1356` through1365). This is not an unbounded record payload.
- Timeline bucket selection is explicitly bounded at120 (`packages/daemon/src/api/history-summary.ts:11` through12). Browser materializes the bounded range at `history-timeline.tsx:25`.
- Whole-range daemon CSV uses SQLite `.iterate` and a generator (`packages/daemon/src/api/queries.ts:1344` through1353); route returns `usageCsvStream` (`packages/daemon/src/api/server.ts:375`). Do not describe it as a daemon `.all()` CSV materialization.
- Greater-than2000-row paging/export is directly tested (`packages/daemon/test/usage-events.test.ts:340`); stable timestamp ties have coverage at line25.
- Existing indexes include usage timestamp/source+timestamp/model+timestamp/session (`packages/daemon/src/db/schema.ts:108` through111). No additional index is justified without query-plan and timing measurements.

## Rule and evidence limits

Authority is the original ZIP `docs/quotapulse_build_blueprint_v1.1.zip`:

- `quotapulse_build_blueprint/05_TEST_AND_VISUAL_PARITY.md:47` through51 asks for initial render/query count/chart commits/animation paints/hidden work, query plans and large fixture histories, and measured CPU/render results. It establishes an evidence requirement; it does not set a millisecond target.
- `01_IMPLEMENTATION_PHASES.md:19`: hardening includes complete browser matrix and bounded update work.
- `08_DEFINITION_OF_DONE.md:24`: relevant checks pass and performance evidence is recorded.
- `screens/history.md:9` through19 requires paginated records, complete usage-events history beyond2000, stable event identity, source effort categories and full matching CSV. The candidate must retain these semantics and original reference composition.

Prior runtime5k evidence is meaningful but narrower:

- `scripts/check-production-runtime.mts:22` through24 inserts5000 events in one session/source/model/provider, spanning about500seconds; it supplies no effort field, so the category distribution is a single null group.
- Lines59..64 measure selector readiness; lines67..70 verify total token display/accessibility. Lines86..94 time ten full summary requests and reconcile record/token totals.
- `docs/redesign-v1.85.48/production-runtime-verification.json:2748` records History readiness330.5762ms. Lines24 onward record summary HTTP measurements. These are measurements on that fixture, not a latency guarantee.
- `scripts/check-production-runtime.mts:107` explicitly limits selector readiness, comparison/CPU and packaged-platform conclusions.
- The script has no timing threshold assertion, query-plan capture, high-cardinality effort fixture, deep History-page interaction, or recorded JS/CPU render profile. Thus this specific unbounded category path remains unverified by that5k run.

## Minimal candidate implementation and validation plan

1. First execute the one-variable categorical fixture comparison in a temporary in-memory database and built app after the active capture freeze ends. Use5000 source efforts versus one source effort; keep all other data constant. Also profile first and deep record pages with stable timestamp ties and source/search filters. Capture EXPLAIN QUERY PLAN, API bytes/counts and browser category DOM/refresh work. Do not add an arbitrary library or claim timing improvement before comparison.
2. If the comparison confirms the category growth needs handling, paginate **effort categories only**, retaining full-range totals and existing bounded timeline. Add a small fixed category page ceiling (e.g.16) with explicit offset/total metadata; implement deterministic `calls DESC, effort ASC` ordering and count null as its own source category. Keep original unknown/null wording. Do not silently truncate distribution counts.
3. Render a bounded category page within the existing effort summary cell. Show category range/total and keyboard-accessible category paging only when needed; retain source text and call counts. Preserve filter scope, live-refresh stale-response guards, pause behavior and source/reference composition. Agree additive API compatibility explicitly before changing the summary's formerly complete effort-array semantics.
4. API checks: >2000/high-cardinality fixture, page ceiling, all-category traversal without gaps/duplicates, deterministic ties/null category, reconciled sum of category records/calls, invalid pagination rejection, identical totals/timeline across category pages, filter consistency and privacy allowlist.
5. Browser checks: category DOM count stays bounded, all original categories remain reachable, keyboard paging/focus, paused/in-flight/filter-change behavior, large category labels and Thai/English dark/light narrow layout. Recheck usual low-cardinality reference fixture: no category pager and no composition drift.
6. Preserve original fidelity goal: this is a bounded hardening candidate after the eight-page capture audit; it does not replace original-reference visual approval or RC gates. Stop at source-proven risk and recorded measurements; do not call whole-app performance certified.

## Executed causal measurement

Command: `node --import tsx tmp/history-effort-causal50.mts` (stdout/stderr recorded to `tmp/history-effort-causal50.log`). Script: `tmp/history-effort-causal50.mts`; complete result: `tmp/history-effort-causal50.json`. Initial sandbox execution was prevented by tsx/esbuild subprocess `spawn EPERM`; the same scoped command then passed through automatic approval review and ran successfully. No application build was performed.

One in-memory5000-row fixture, then `UPDATE usage_event SET effort = printf('category-%05d',id)`. Only effort changes. Scope from0 to5001, one timeline bucket,500000 tokens and5000 calls.

| Measurement | One repeated effort |5000 distinct efforts |
| --- | ---: | ---: |
| Returned categories |1 |5000 |
| Serialized full summary, UTF-8 bytes |588 |250542 |
| Serialized effort array, UTF-8 bytes |47 |250001 |
| Direct function median,10 runs, ms |11.00315 |16.3186 |
| Direct function min/max, ms |8.891 /15.1744 |14.5932 /20.1595 |

Full summary grew approximately426.09times. `EXPLAIN QUERY PLAN` was identical in both cases: indexed timestamp range using `idx_usage_ts`, source/session primary-key lookups, temporary B-trees for grouping and ordering. This demonstrates result-cardinality growth rather than absence of a timestamp index.

Assertions passed: all usage_event fields except effort have identical ordered-data SHA-256; totals and timeline are deeply equal; bucketMs identical; category record/call sums reconcile; repeated/distinct category counts1/5000. Recursive per-file-content tree digests for `packages/web/src`, `packages/daemon/src` and `packages/web/dist` are identical before/after (full hashes and file counts in JSON).

Timings describe the full direct `historySummary` function, measured repeated first/distinct second. They are local diagnostics; no browser CPU/render improvement, production distribution, latency guarantee or release readiness is claimed. Candidate step1's direct payload/query-plan part is complete; actual browser category DOM/render measurements and fidelity-preserving fix remain next work after the capture freeze.

## Secondary residual risk

The browser CSV helper obtains the whole response as a Blob (`packages/web/src/api.ts:105`, consumed by `sections/history.tsx:137` through143), so download memory grows with export bytes. This is user-triggered, while summary categories render on every History refresh. The daemon already streams; any client streaming/download redesign needs compatibility evidence and is lower priority than bounding the automatic categorical payload/render path. No export OOM was observed in this audit.
