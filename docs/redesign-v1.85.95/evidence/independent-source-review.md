# Aggregate presence95 independent review

Read-only review,2026-10-20, applying review-code-changes. Scope: frozen Models/Projects aggregate presence adapter/ledger/tests, associated factual-safe artwork, History close/summary CSS and Models row/Projects header CSS; root native harness inspected. No source edits, browser, build, tests or Git run by this reviewer.

## Verdict

**No concrete blocking or important source defect found in this candidate.** Proceed to root's compiled native and measured paint checks. This verdict does not certify all original motion surfaces, pixel likeness, native Electron or full state/release acceptance.

## Correctness and lifecycle findings

- **Request eligibility is captured at request start:** Models100-113 and Projects106-116 snapshot the ledger before existing API queries, then attach batch serial/reason/eligibility only after mounted, exact request key and scopeEpoch checks. Stale completions cannot overwrite the current batch. New work does not create a refresh/SSE engine or extra aggregate fetch. Actual detail and row-history requests remain the existing independent paths.
- **Full universe versus displayed page is correctly separated:** `aggregate-presence-motion.ts` accepts all exact response group identities into the preceding accepted baseline, then intersects only newly observed identities with the actual rendered page. Models passes `groups.map(modelPairKey)` and comparison rows; Projects passes all groups and filtered visible cards. Promoting a previously offpage group, reordering, metric-only revision or later revealing a previously accepted group cannot become a fresh presence. Memory is bounded by the preceding accepted response and current mounted page, not lifetime history. This remains observed presence, never ingestion/call recency.
- **Exact typed identities survive:** model+recorded-provider pairs use JSON tuple keys; projects use exact nullable project key. Null, empty and case are not coalesced. API provider filtering truth and existing distinct session/aggregate semantics are unchanged. Client search/sort/page/tab and locale/currency/rate/theme participate in context; changing context suspends old work rather than relabelling it fresh.
- **Startup and eligibility barriers reuse the proven ledger distinction:** absent DOM/unknown IO is not automatically declared offscreen. Real document hidden/reduced/intersection/ancestor clip or disabled accepted-error state calls suspend. Held batches carry old request epochs; restoration seeds before subsequent genuinely fresh work. Initial/dependency/visible/online batches seed. Empty/no-row regions cannot create animations and later mounting establishes current geometry. No promise of processing every event is introduced.
- **Finite effects survive duplicates:** the adapter has no per-batch cleanup. Active handles are pruned when their actual target leaves the mounted page or has no native animation, and existing active native selection prevents presence starting on that same target. Shared finite player observes individual targets and disposes animation/listener/observer ownership on native finish/cancel. Lifecycle cleanup removes region listeners and clears active handles. The active map is bounded to mounted targets; finished handles may remain until the next accepted/rendered observation or cleanup, without a timer or continued draw work.
- **Explicit action priority is selective:** changed actual model/project clicks synchronously cancel only that key's presence. A fresh explicit serial also excludes that key during the same commit, so hook ordering cannot create two owners. Other active targets continue. Project detail-tab intent has no card key and correctly leaves unrelated card presence alone. Duplicate/no-op selection does not issue a fresh serial. Existing accepted-detail selection hooks preserve their own exact scope/readiness/focus behavior.

## Tests and root harness

- Pure ledger tests meaningfully discriminate full-universe rank promotion, new offpage group consumption, nullable exact keys, changed context, stale/duplicate batch order, and held epoch loss. The adapter test uses an isolated React dispatcher/fake native handles; it proves adapter decisions/cancellation boundaries, not real React DOM or native IO ordering.
- Owner report attributes48/48 earlier focused tests, final10/10 ledger/adapter tests and final TypeScript session7754 exit0. These were not independently rerun. Hashes below match the inspected frozen report.
- Root `scripts/check-aggregate-presence.mts` uses actual compiled app/API/SSE and isolated memory DB. Positive checks record natural native finish180/700, unchanged near-full timeline thresholds, interpolation, one iteration/fillnone/idle. It covers initial static, duplicate during active animation, offpage existing promotion, search restoration, same model/different recorded provider, real held response crossing viewport eligibility loss, first restoration seed, reduced preference, Models active unmount, Projects exact empty/null, changed user selection cancelling same-key presence. No force-click or fabricated app-only trigger was found.
- This harness does not establish every Projects held/error/hidden/ancestor clip variant, all locale/narrow variants, true OS/Electron visibility, or Providers/Cost new-row coverage. The fake dispatcher is not a substitute for these native limits. Root must bind final results to the actual compiled index; pending/new runs are not considered passed here.

## Artwork and CSS safety

- Models summary Box/Database/Play/Database silhouettes restore original decorative vocabulary under existing aria-hidden wrappers. Actual pair count/distinct sessions/calls/native/API labels and observed spark data remain unchanged. Play is not exposed as a playback control or session lifecycle fact.
- Projects Flame is aria-hidden, within the existing real top-consuming heading; it does not introduce severity or a new action. Flex heading/gap and native dark14px type are scoped. Rank actions/typed project identity are preserved.
- History Close uses an existing X with translated aria-label/title and native32px icon button. The negative10px right margin repositions the existing hit box, not the glyph into a14px click target. Existing close/Escape/focus helper is untouched; legacy dialog retains visible Close/autofocus. In the288px rail with14px padding, its right margin remains inside the rail's outer boundary. Actual overflow/focus ring still needs native capture.
- History Calls supplemental metadata is10px with-.1px tracking only at native dark>=1536. No hidden text/clamp/overflow concealment was added. Long Thai/large real counts may still grow naturally; the source does not guarantee every dataset becomes67px. Require actual canonical geometry/readability evidence; do not proclaim the12px repair from the CSS alone.
- Models canonical dark table12px/5px vertical padding keeps real10 columns and horizontal overflow region. Its26px observed trend implies approximately37px row minimum; wrapping/long content may legitimately grow. No column truncation or fake row insertion was added. Check final selected outline, row baseline and accessible focus ring with real compiled screenshots.
- Native Projects mini-trend direct line grid dashes are hidden via opacity0; actual `.qp-observed-line` and real points are untouched. These are decorative grid lines, not removed data series. No screenshot mask or fabricated replacement curve is introduced.

## Fingerprints (raw SHA256)

| File | SHA256 |
|---|---|
| `redesign/models.tsx` | `09d472de4751144fd49dbf0a6388df652e07fc9c422f7ca78e0af60e3a6fff31` |
| `redesign/projects.tsx` | `7e2d092915f8b6fe82c8d7462a2e5650767e7b5636bf72cc44c0febd7275dfec` |
| `redesign/aggregate-presence-motion.ts` | `c247d7a238be99d4a38cdd873b3f204e28830dd6eaf50f7f974e23e7079fb97b` |
| `redesign/use-aggregate-presence-motion.ts` | `4beab36097ba490a293481ae23678e65a7e18c0212878575877af729e5202d1a` |
| `test/aggregate-presence-motion.test.ts` | `f94811d03890c421c63694c362d34f4f8e480c02169377d8dc5a134fa6479049` |
| `test/aggregate-presence-hook.test.ts` | `ca651bb8c9ff8240a68e5d0d70f98eee9e5b8fac3d9a3fbb6b8e99b3531ed6b6` |
| `sections/history.tsx` | `ea73485cdbe7559e07806c89ca97047f39cfc5038d29093b29b840d7bb121670` |
| `redesign/history.css` | `b50f8c6e450604b41f39bfa21ca339c8d29977d0365e7f0df837302fb127808e` |
| `redesign/models.css` | `67613bcdb2df29bd9adfeca384e235cbe9fde4e9140c3ab71da69ee2aee5e873` |
| `redesign/projects.css` | `fe0eb0bd796321e64cb77d74d626e432e1214ba8c506fcd5c613ac29909351d6` |
| `scripts/check-aggregate-presence.mts` | `105524098196f26d507b6e28ac03b171fae2c4ad087713f6f7ca05f9f2ae6b9f` |

App paths in table are relative to `packages/web/src/`, tests to `packages/web/`; script path is repository-relative. Original32/40-pixel control differences remain an unresolved independent capture limit, with no new causal claim from this source review. Any later changed fingerprint requires affected re-review/evidence binding.
