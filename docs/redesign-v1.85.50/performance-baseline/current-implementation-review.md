# History effort bounded slice: current source review

Read-only preparation, 2026-10-10. No application/source/dist edits, browser, service, build, database, or Git operations. Inspected the actual query, route parser, API helper, HistorySection, HistoryTimeline, CSS, locales, refresh coordinator, and existing summary test.

## Verdict

The proposed slice is implementable without schema migration or another refresh coordinator. It bounds automatic category response/render cardinality, while preserving the legacy summary contract and access to exact stored categories. It does **not** bound SQL scan/group work: both category metadata and page queries still group the whole selected range. Measure query count/time rather than describing this as a CPU optimization.

## Exact patch surfaces

1. `packages/daemon/src/api/history-efforts.ts` (new): follow `live-sessions.ts`'s grouped-base/transaction pattern. Use exactly history-summary.ts's joins and `usageWhere`; category metadata `COUNT(*)` over grouped rows includes NULL, unlike `COUNT(DISTINCT effort)`. Stable page ordering is calls DESC, effort ASC, matching the old summary. Empty string, NULL, literal null, case, and whitespace remain distinct. Return rows/total/limit/offset/totals records+calls.
2. `packages/daemon/src/api/history-summary.ts:6,24`: optional third `{includeEffort?:boolean}` argument; conditionally skip the actual effort prepare/all operation, return effort `[]` and `effortIncluded:false` only for excluded calls. Default response fields/order/array stay compatible.
3. `packages/daemon/src/api/server.ts:396`: allow only `include_effort` via `extraKeys`, then explicitly validate absent/0/1. New adjacent authenticated history-efforts route uses `requireRange:true` plus extra limit/offset keys and existing parser. The parser already rejects arrays/nonstrings/unknown keys and limits to 1..500. No separate authentication code or query normalizer.
4. `packages/web/src/api.ts:206,682`: category row type may reuse `HistorySummaryResponse['effort'][number]`; add paged response and helper. Existing `usageEventParams` preserves filters; append pagination and opt-out only when requested. Optional summary flag preserves old callers.
5. `packages/web/src/sections/history.tsx`: own one `effortOffset` and committed `effortPage`, limit 16; add offset to queryKey at56. At103 fetch records + excluded summary + effort page using one Promise.all **after** usage resolves exact range. All state commits/error writes remain after `current()` checks; do not add useEffect fetching categories or an SSE subscription.
6. `packages/web/src/redesign/history-timeline.tsx:8,46`: accept effort page plus explicit loading/disabled/current snapshot state and page callbacks. Replace category rows only; totals/timeline/chart stay full-range. Add pager only when total>16. Keep an optional legacy data.effort fallback only if future direct callers are intentionally supported; the sole current component caller is HistorySection.
7. `packages/web/src/redesign/history.css:32-38,135-144`: scoped effort pager grid-column:2, wrapping controls/range text. Preserve low-cardinality geometry. Native summary cards have min-height67 and UL max-height70; high-cardinality paging can legitimately grow the article rather than overlap or hide controls. Category text must wrap; arbitrary strings are not fixed-byte bounded.
8. `packages/web/src/i18n/en.ts` and `th.ts`: add `history.effortRange` (EN `{from}–{to} of {total} categories`, TH `{from}–{to} จาก {total} หมวด`) and `history.effortPages`/equivalent labelled navigation string. Reuse `history.previous`, `history.next`, `history.effortDistribution`, and `history.stale`. English dictionary derives MessageKey and Thai must cover the same keys.

## Required corrections to the earlier slice

### Recover offset when distribution becomes empty

Do **not** copy records' `result.total > 0 && offset >= result.total` guard literally for categories (HistorySection105). A category request at offset16 with total0 would otherwise commit an empty nonzero page. Use `effortOffset > 0 && effortOffset >= effortPage.total`, including total0; reset offset0 and refetch before committing the replacement trio. This produces correct 0–0 range and prevents an inaccessible nonzero page. Record-table behavior can remain outside this bounded change.

### Scope staleness must reach the timeline itself

HistorySection124 already suppresses shell scope counts during replacement loading, but HistoryTimeline173 still renders the previous summary. Adding `aria-busy` alone does not identify stale categories under newly applied controls. Pass `snapshotKey===queryKey`/paused semantics and show an explicit translated previous-snapshot/stale status for a mismatch or failure. Preserve old data on error without labelling it as the newly applied scope. Disable category paging whenever the committed page does not match the current key, not just paused/loading. Do not replace the existing summary with `effort:[]` interpreted as empty before the bounded page exists.

### Page controls and focus

Background SSE has live=true and deliberately does not setLoading(true) (HistorySection100). The refresh controller serializes each subscriber's jobs (`use-live.ts` drainEntry), while key/epoch guards reject obsolete commits. Keeping the new page inside this existing callback is safe; no new in-flight timer/refetch loop is necessary.

Loading may disable the currently focused pager button before the new page commits. If restoring focus, record a user-initiated pager action before changing offset and use a stable focusable range/status node after a successful matching commit. Only move focus if it was still in this pager or fell to document.body; clear pending focus on scope reset/pause/error/unmount. Never steal focus from someone who has tabbed elsewhere or from the initial auto-open record dialog (HistorySection108-110). Button is React.forwardRef, so refs are available. Existing check-stable-captures History modal harness closes/opens the initial dialog; new paging scenarios must close it before operating the pager.

### Reset points (all actual source sites)

Add effortOffset reset alongside setOffset at hashchange sync68, resume132, UsageRangeBar onChange172, and apply-submit174. Category next/previous changes only effortOffset; record buttons194 change only record offset. QueryKey includes both offsets, so existing scopeEpoch/currentKey/pausedRef/mounted checks cover both. Export remains `snapshot.scope` and has no effort pagination parameters. Avoid an effect that resets category offset whenever the whole queryKey changes: that would prevent paging and reset on record pagination.

## Narrow acceptance with useful evidence

- New daemon test: fixed 5000 categories, 16 row limit, total5000, record/call totals; old complete summary unchanged, excluded summary's totals/timeline/bucketMs deeply equal. Confirm excluded code skips the effort SQL using an instrumented prepare wrapper or narrowly targeted query trace if making an avoided-work claim.
- Category count includes NULL; exact empty/literal-null/case/space identities and tied-call ordering; fixed-database page traversal no gaps/duplicates; aggregate call_count differs from record count. Empty scope + nonzero offset retains total/totals semantics.
- Reuse existing history-summary.test.ts's scope parity cases (2103 records including session aggregate), add all filters/invalid unknown keys/limit0,501/fraction/negative offset/invalid include_effort and401. No private source paths in responses.
- UI: bounded 16 rows, first/middle/last pages, category-specific range, keyboard scroll region with accessible label, focus on successful last-page transition, pause during in-flight requests, scope reset, failure retaining marked stale snapshot, recovery, and distribution shrinking to0 at nonzero offset. Keep ordinary fixture screenshot unchanged and verify 390/900/1280/native TH/EN dark/light.
- Preserve actual query/byte counts: current callback performs usage + records + summary; new callback adds one effort read, and category paging repeats the whole callback just like record paging. SQL grouping may execute twice for the new endpoint; no CPU improvement is established by payload shrink alone. Separate HTTP snapshots are not globally atomic during ingestion, even though each effort endpoint's rows/count/sums are transactionally consistent.

No blocker beyond the above corrections. Final source-reference approval remains independent of this performance slice.
