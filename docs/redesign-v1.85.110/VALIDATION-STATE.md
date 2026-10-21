# Models unused-breakdown optimization v1.85.110

Status: partially validated. Functional/data/compatibility tests pass; full stable visual gate and strict all-eight controls remain RED. No visual-fidelity improvement or completed release is claimed.

## Measured change

The actual Models page previously downloaded per-source/effort breakdown rows that it never consumed. It now opts in to a summary response; every group, total and requested trend stays complete. [API/compatibility contract](MODEL-SUMMARY-CONTRACT.md).

On the same161200-record/1265-pair/120-session/three-grain synthetic memory fixture used in88: the function return falls4009433 ->502138 UTF-8 bytes (87.48% less); real injected HTTP including trends falls4025423 ->518128 bytes (87.13% less). All1265 groups, totals and30 trend buckets exactly match the full mode; only7590 unused detailed rows are omitted. Full default result SHA256 still equals the frozen88 result060d4469f2050da1136d44ea76089012a2c6c6fadcb007d6df07d0b83cae8060. Actual aggregation prepares/executions fall3 ->2.

Five interleaved same-process full/summary trials after warmup: median974.846ms ->457.054ms for the aggregate function. Full raw timings, environment, query plans, exact payload sizes and read-only assertion are retained. These are local warm in-memory fixture observations, not a general production/native startup/disk/network SLO or whole-app speed guarantee. Complete group sorting/cardinality and vendor-filter work remain O(N); selected-model categorical payloads and legacy clients can still return large data.

The current compiled browser request is recorded as breakdown=0, no rows property, complete six fixture groups and721000013 tokens,3869 response bytes. Thus this is an actual consumer change rather than an unused endpoint optimization.

## Validation bound to final source

- Daemon and web TypeScript/Vite builds pass. The existing large lazy legacy-App chunk warning remains.
- Full repository655/655 tests pass: daemon122/web335/tray198. The targeted API/equivalence/client transport run passes six tests. Independent aggregate oracle comparisons cover exact identities/scopes, including money coverage and distinct-session counts.
- Real Chrome155 without renderer flags: two compiled modern-versus-older-daemon cases pass EN dark and TH light. Every main text/control label/fact is identical after fallback and refresh; one rejected summary probe is remembered until reload. Expected400 and the explicit fixture refresh action are not classified as unintended writes/errors.
- Fresh all-eight canonical EN dark immediate repeat pairs are byte-identical, no browser errors or external/write requests. Full shell/main/headings geometry matches108. Source canvases remain Overview1586x992/other seven1672x941. Previous PNG bytes are reused only when their full SHA matches the actual new capture.
- Original four-locale/theme Models stable run completes all first-pass functional checks and the two EN repeat pairs exactly, then exits1 on Thai dark125 changed pixels/maxdelta34. The missing Thai-light repeat was run separately with unchanged criteria and passes exactly. Three passing pairs do not convert the original full gate to PASS.

## Retained visual failures

Thai dark differences:125 pixels at x1512-1638/y418-473;116 within the recorded ring box and9 adjacent. Both ring geometry/computed paint snapshots are exactly equal. This constrains the discrepancy but proves no rendering cause or harmlessness. The original failed pair and log are retained; thresholds/masks were not changed.

The unmasked108/current control, with no planned visual edit, remains RED: Overview22 sidebar/max35; History440 (418 select label+22 sidebar)/max222; Providers123 shared header/max3; Cost22 sidebar/max35. Live,Projects,Models,Alerts are entirely byte-identical. These are not attributed to the optimization. Prior108 diagnosis/control evidence stays open, and passing immediate repeats/semantics do not clear it.

[All-eight original/108/current review](review.html) includes unmasked overlays/differences plus compatibility and retained failed-pair evidence. Main branch, old origin configuration, unrelated untracked files and user data remain untouched.

## Remaining work

Continue all-eight source fidelity and retained raster/native motion issues, final integrated UI states, remaining Models group cardinality/vendor-filter/query work, matching portable package/notices/fonts and actual previous/current rollback. [Approved requirement trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md) remains partial; this advances its payload/resource item and preserves GAP013/019 semantics. No99-100% or human visual approval claim.

## Reproduction

Build daemon/web; npm test. Extract archived .mts harnesses into tmp for imports. benchmark-model110.mts uses its own in-memory fixture and should run without competing workload for timing. Models stable gate uses QUOTAPULSE_CAPTURE_SCOPE=models with no locale filters (port7804); it retains its original tolerance. Separate Thai-light run sets QUOTAPULSE_CAPTURE_LANGUAGE=th and QUOTAPULSE_CAPTURE_THEME=light. Current all-eight and compatibility harnesses share port7816 and run sequentially. check-model110-controls.mts correctly exits1 on retained RED controls. Benchmark equality is not inferred from file existence: actual full/summary and HTTP comparisons ran, with unchanged total_changes.
