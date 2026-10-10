# Implementable next slice: bounded History effort categories

Status: design from read-only inspection. No app/daemon edits, browser, build or service execution. Keep source/dist frozen until root ends capture17110.

## Decision

Add one scoped read, `/api/history-efforts`, with ordinary limit/offset paging. Add an explicit opt-out flag to the existing summary read so the redesigned History never downloads the old complete effort array before fetching the bounded page. Preserve existing callers' default summary behavior. Merely rendering fewer rows or adding a new endpoint while still fetching the complete summary effort list does not fix the measured payload growth.

No new dependency, index, categorical enum, source-string normalization, SQL migration or chart renderer is needed. This is cardinality hardening within the existing History screen and overrides.

## Actual consumer map

Repository search over packages/scripts `.ts`, `.tsx`, `.mts` found one production `api.historySummary` caller: `packages/web/src/sections/history.tsx:103`, passing its result to `HistoryTimeline` at173. The response interface is `packages/web/src/api.ts:206`; the complete helper is at682. `HistoryTimeline` consumes effort at `packages/web/src/redesign/history-timeline.tsx:46`.

Daemon route: `packages/daemon/src/api/server.ts:396`; query: `history-summary.ts:6`. Existing tests invoke the HTTP summary directly and reconcile all effort records/calls (`packages/daemon/test/history-summary.test.ts:28` through31). Preserve their default request/function behavior.

Existing `/api/usage-events` route at `server.ts:382` is the parser pattern: `parseUsageScope(...extraKeys:['limit','offset'])`, `parseUsagePagination`,400 on invalid input. Its parser allows1..500 rows (`usage-scope.ts:101`). Reuse this bounded ceiling rather than inventing another generic pagination helper. Redesigned UI requests16 categories.

`packages/daemon/src/api/live-sessions.ts:9` through31 is the closest query pattern: shared WHERE, grouped base SQL, aggregate count and LIMIT/OFFSET page, same database transaction.

## Exact API/query additions

1. New `packages/daemon/src/api/history-efforts.ts` exports `historyEfforts(db, scope, pagination)`.
2. Use `usageWhere(scope)` and the **same** FROM/JOIN/WHERE as `history-summary.ts:13` through14. All time/source/session/project/missing/harness/provider/vendor/model/q/grain filters remain inherited; there is no effort-value filter or arbitrary JSON/raw data.
3. Grouped base SQL:

```sql
SELECT u.effort, COUNT(*) AS records, COALESCE(SUM(u.call_count),0) AS calls
FROM usage_event u
JOIN source s ON s.id=u.source_id
LEFT JOIN session sess ON sess.id=u.session_id
WHERE <usageWhere.sql>
GROUP BY u.effort
```

4. Inside one `db.transaction`, obtain page metadata:

```sql
SELECT COUNT(*) AS total,
       COALESCE(SUM(records),0) AS records,
       COALESCE(SUM(calls),0) AS calls
FROM (<base SQL>)
```

5. Obtain only page rows:

```sql
SELECT * FROM (<base SQL>)
ORDER BY calls DESC, effort ASC
LIMIT @limit OFFSET @offset
```

Return `{ rows, total, limit, offset, totals:{records,calls} }`; route wraps `{ now, scope, ...result }`. The total counts **categories**, including the null category. `COUNT(DISTINCT effort)` would incorrectly omit null. `records` and `calls` are full-distribution sums, independently of the current category page. No schema changes.

Source categories are exact SQLite grouped text values; ordinary binary `effort ASC` matches current ordering and makes equal-call ties deterministic. Do not use locale or case-insensitive sorting/grouping, trim whitespace, coerce empty string to null, or invent a numeric effort rank. Empty string, null, literal `'null'`, case variants and leading/trailing spaces are distinct categories.

6. New authenticated GET route beside History summary in `server.ts`: validate the required from/to and shared scope, plus limit/offset via existing parsers;400 for malformed/unknown query parameters. Reuse existing global authentication.
7. Existing `/api/history-summary`: accept only optional `include_effort=0|1` as an extra query key; any other value is400. Default absent/1 preserves today's complete `effort` response. Add optional third function argument `{includeEffort?:boolean}` to `historySummary` so0 skips executing its effort GROUP BY query and returns `effort:[]`. Expose `effortIncluded:false` on explicitly excluded responses to distinguish omission from an empty distribution; default responses may retain their exact old shape.
8. Browser API: add `HistoryEffortsResponse`, reusing the category row shape, and `api.historyEfforts(scope,{limit,offset})` with `usageEventParams`. Extend `api.historySummary(scope,options?)` to append `include_effort=0` only when requested; unchanged callers retain complete old behavior. Add optional `effortIncluded?:boolean` to `HistorySummaryResponse`.

The redesigned application uses the bounded read path; legacy summary requests remain compatible. This does not globally bound deliberately requested old complete-summary responses. Row ceiling bounds cardinality; it is not a fixed-byte guarantee for arbitrarily long source text. These limits must be reported accurately.

## Minimal UI wiring

Keep ownership in `HistorySection`; do not add another refresher, SSE stream, independent moving range or category component network loop.

- Add `effortOffset` state(default0), `effortPage` snapshot and a page-size constant16 beside record offset/snapshot (`sections/history.tsx:42` through46).
- Include effortOffset in the request key/scope epoch guards (`sections/history.tsx:56` through61). After existing `api.usage` resolves the precise range, fetch record page, summary with `includeEffort:false`, and effort page in the same existing `Promise.all` at103. Commit all three only under the existing current-key/epoch/paused/mounted guard.
- If category total shrinks below the requested offset, reset effortOffset0 and refetch, matching current record offset recovery at105. Empty distribution retains existing empty label; summary exclusion must not be interpreted as empty.
- Reset effortOffset with record offset on applied filters, hash scope/session changes, range/source changes and resume. Record-table next/previous should leave category offset unchanged; category paging should leave record offset unchanged. No new URL field is necessary for this small slice, since record offsets are already local state.
- Passing effortOffset through the existing whole refresh refetches records/summary too. This is consistent with current record paging and deliberately avoids a second state machine. Measure query counts after implementation; optimize only if measured repetition is material.
- Pass `effortPage`, paused/loading flags and next/previous callbacks to `HistoryTimeline` alongside `data`. Replace only the category list data source at46. Totals/timeline stay full-range; source category text remains escaped React text and null keeps existing unknown translation.
- For total<=16, show the list with no pager to preserve the usual original-reference composition. Existing category list CSS already has `max-height:70px;overflow:auto` (`history.css:32`); keep that footprint and add keyboard focus/accessibility to the scrollable list when it overflows.
- For total>16, add compact category controls in the effort article's second column. Reuse Button and previous/next translations; add a category-specific translated range string (existing `history.range` explicitly says records and must not label categories).
- Pager semantics: labelled navigation region for recorded effort categories, Prev disabled atoffset0, Next disabled when `offset+rows.length>=total`; prevent changes while paused/loading. Range status has `aria-live='polite'`; article/list uses `aria-busy` during paging. Keep stable native button identities. If a clicked control becomes disabled on the last page, focus a stable labelled range/pager element after successful commit; do not steal focus on background live refresh. Test keyboard focus behavior.
- Preserve old snapshots on failed page request, show the existing stale/error state and prevent presenting stale category counts under a different newly applied scope. Existing export remains tied only to record snapshot scope; category offset must not alter export filters or selected metadata.

Different HTTP reads are separate SQLite snapshots, as existing record/summary already are. Effort rows/total/sums are internally consistent within their own transaction. Do not claim cross-endpoint atomicity during ingestion or compare mismatched refresh epochs. Fixed-fixture acceptance should reconcile category sums with summary totals.

## Narrow acceptance tests

API query/route tests (new `packages/daemon/test/history-efforts.test.ts`; extend existing history-summary test for the opt-out):

1. Reuse the causal fixture:5000 distinct efforts, page16 returns16, total5000, records/calls5000; excluded summary effort[] and no full categories serialized. Old default summary still returns all5000 unchanged.
2. Stable tied-call order; null, empty string, literal'null', mixed case and whitespace categories remain separate. Traverse all pages of a fixed database: no gaps/duplicates and exact reconciliation of category records/calls to whole-range summary totals.
3. Calls vs records with session aggregates; null category included in total; empty filtered scope total0/rows[]/sum0; high offset rows[] while total/sums retained.
4. Shared source/session/project/unassigned/provider/vendor/model/harness/grain/literal-q scope parity. Invalid limits0/501/fraction, offsetsnegative/fraction, unknown params and invalid include_effort are400; no token401; no private-root or arbitrary source metadata.
5. Summary opt-out totals/timeline/bucketMs deeply equal to default; old summary test count/sum behavior still passes. Use a trace/spy or focused query inspection if claiming the old effort query is skipped; response[] alone would not prove avoided work.

Browser after freeze/build (extend targeted History harness rather than create another app):16 category list DOM rows regardless of5000 total; Next/Prev keyboard navigation and range labels; all pages or representative first/middle/last source identities remain available; last-page focus; loading/error/stale recovery; pause/in-flight guard; scope reset; narrow Thai/English dark/light; ordinary low-cardinality screenshot unchanged. Record API bytes and query count. No browser CPU claim until measured.

## Candidate changed-file boundary

Daemon: new history-efforts.ts, server.ts route/flag parser, history-summary.ts optional skip, new effort tests and summary opt-out tests.
Web: api.ts types/helpers, sections/history.tsx existing refresh/state wiring, redesign/history-timeline.tsx bounded source/pager, narrowly scoped history.css if pager column styling needed, en.ts/th.ts category-specific labels.
Browser acceptance: existing History/stable harness extension after source freeze ends. No other seven screen compositions, global shell, theme tokens, adapters or stored data change.

Original fidelity remains the active goal. This slice fixes a measured automatic payload-growth path while retaining complete source-category access and existing ordinary-category composition. It does not replace original-reference approval or release gates.
