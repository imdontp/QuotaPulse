# Renderer isolation and repeated software motion checks / checkpoint171

Application rendering remains source169 (`68d2f673cf461845c1c60b74c785ba3e08adeb43`), compiled index SHA256 `de34ca584f371514b383e05a842fb91d2565af3f892fa1a8bbade43aab80cd6a`. This checkpoint adds an explicit QA renderer option and evidence. It makes no production rendering, styling, data or Electron configuration change. Full GPU/native performance acceptance is still open.

## What the isolation shows

A standalone HTML box with180/700ms Web Animations, no QuotaPulse application code and the same headless Chrome/default renderer also missed the180ms near-end RAF sample. Its first context had a501.7ms inter-frame gap. The remaining three default contexts sampled the required points. Thus a missing sample in this environment is not sufficient evidence of a QuotaPulse-specific JavaScript defect.

Four fresh standalone software-rendering contexts sampled both near-end points; their maximum inter-frame gaps were53.6–79.1ms. This is not a60fps or smoothness guarantee. In particular, the first software context still took301.8ms to produce its first sampled frame. Startup/rendering performance remains a separate requirement.

The default Projects trace contains138.1ms and64.4ms tasks on `CrGpuMain`, with no selected main-thread timeline event above50ms. **That trace covers the first selection, which passed; the driver failed later on a held-response selection after tracing had ended.** It is evidence about that measured interval, not a direct trace of the later failure or a complete GPU root-cause proof. Both default and software traces are retained. The observations support investigating browser/render scheduling; they do not certify that all application paint work is inexpensive.

## QA option and repeat results

`scripts/motion-renderer.mjs` accepts `QP_MOTION_RENDERER=default|software`. Without the variable, the three affected drivers keep their previous arguments. Existing baseline/paint arguments are also preserved. Software mode adds `--disable-gpu` only to the test browser, stores output in separate `-software` directories, and records renderer/arguments in its result. Invalid modes fail early. It is not passed to the app or native review launcher.

The Projects/Runtime/Providers, History/Alerts and aggregate presence drivers each passed **two unprofiled software runs** with their existing duration, identity, intermediate-paint, near-end and cleanup assertions. No timing window was relaxed and no fixture or chart was replaced. Aggregate `visualSamplingComplete` is true with zero sampling gaps in both runs. The separate software trace experiment also completed Projects/Runtime/Providers, but is not counted as an unprofiled repeat.

| Driver | Evidence exercised |
|---|---|
| Projects/Runtime/Providers |27 recorded stages per run: actual card/ranking/tab and accepted detail transitions, held response, duplicate/static and reduced states, provider inspector, Runtime graph/data disclosure and focus restoration/context cancellation.|
| History/Alerts |Main native180ms/700ms effects plus actual compiled lifecycle helpers: current snapshot/selection/focus, duplicate/filter/show-more static states, offscreen and held-response consumption, cancellation/remount and same-document behavior. Underlying proof labels any emulated visibility; this is not OS minimize/tray testing.|
| Aggregate presence |28 stages per run: accepted aggregate identities, finite effects, no invented individual-call replay, detail/paging/context/duplicate/reduced/offscreen behavior, all nine direct destinations and lifecycle cleanup.|

Source170's default-renderer failures and eight aggregate sampling gaps remain valid unresolved observations. Software results are a separate, labelled measurement condition; they do not replace those results, original reference captures, a reviewed visual baseline, hardware-browser checks or native/physical monitor performance. No canonical baseline was updated here.

Run sequentially from the active worktree (all three own the same local port7816):

```powershell
$env:QP_MOTION_RENDERER='software'
node --import tsx scripts/check-projects-runtime-providers-motion.mts
node --import tsx scripts/check-history-alerts-motion.mts
node --import tsx scripts/check-aggregate-presence.mts
Remove-Item Env:QP_MOTION_RENDERER
```

The artifact contains first/repeat results, renderer arguments, frozen helpers, source/evidence hashes and compressed traces. All checks use owned synthetic in-memory databases and real local API/SSE; no user database/provider account, new worktree, runtime extraction or native ZIP was used. The application build is unchanged, so source169's build/375-unit/144-responsive validation remains the latest application validation. Full art/typography/control review, the initial concept-plus-overrides baseline, intermittent History1px placement, physical desktop/performance, Cost projection eligibility and actual two-version upgrade/rollback remain open. Native review167 still contains source166. The overall goal remains active.
