# Review156 — runnable source155

[Review ZIP](C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-validation-v1.85.155/tmp/review-bundles/QuotaPulse-v1.85.155-review156.zip) · [Original refs / actual Electron gallery](review.html) · [History date control](images/initial-calendar-subday.png)

Frozen source `c452881ac8db8f9f513752379971f5efbce4b15d` includes the History reference table/token bars, compact date capsule and actions, Providers comparison graph, and initial quota-chart coordinate correction from source151–155. This is the latest portable review package; review150 remains preserved. The development-only SSE proxy correction is also in the frozen source and repository tests; the portable application connects directly to its daemon.

## Try it

Extract into a new dedicated folder and run PowerShell there:

```powershell
.\scripts\start-review.ps1 -EnableReaders
```

Open http://127.0.0.1:7807/#overview. Explicit -EnableReaders enables installed harness/configured quota readers into separate review-data, without importing the original application database. Initial scans may take several minutes. Without the switch the fresh profile starts empty with readers/account probes off. Stop with .\scripts\stop-review.ps1 before changing modes. Restart without the switch preserves collected review data but disables collection. The portable launcher exposes this switch; versioned installation wrappers do not. Pet stays disabled. No customer database, credentials or QA fixture database is packaged. Windows x64 and installed Node ABI127 are required (validated Node22.13.1); Node is external. -Port selects another port. No logon task is installed.

Archive: 206502182 bytes, 3159 entries. SHA256 `6ec9c91e7dd7586e5d776a270e1aa45dd3e86441ee23ea6392562bf55c9f61cb`. Web index `9a57fc2c0243d761bd576e1fed241ececd7ba154feec334b9f0349d26f5261ba`.

## Validation

All six frozen application-only build/package stages passed. The clean sparse checkout contains825 visible tracked files, and the full repository passes680 tests:129 daemon,353 web and198 tray, with no failures/skips/cancellations. Every ZIP entry matches the unchanged tested runtime folder. A fresh extraction outside repository dependencies passes6 portable start/stop/restart/profile-isolation checks. A second fresh extraction passes6 reader opt-in lifecycle checks using only an owned fake home and synthetic Codex logs:150→190 tokens, one session, deduplication, refresh, restart, default-off retention, prompt exclusion and unchanged original-profile/log sentinels.

Actual compiled Electron main and the exact sandboxed preload pass two cycles: EN/dark, then restart restoring TH/light, THB37.25 and1371×887 window settings. The final16 route captures are actual Electron page screenshots after DOM readiness. All8 initial frames use their own SHA-verified original reference dimensions: Overview1586×992, the other seven1672×941, DPR1. Renderer dimensions were measured and corrected through native window size feedback, without CSS zoom or screenshot resizing. The earlier first native QA run used1672×941 for every page; its log is retained as bounded evidence, while the final per-reference run is authoritative. The restored cycle intentionally shows its actual saved window size, not original-reference sizing.

The source151 token comparisons retain real150/1 counts,150 page maximum and exact ratios on50×6px tracks. The source152 date capsule opens with keyboard, fits the viewport and restores focus on Escape in both native phases. Two custom-date checks retain exact from/to/source/session scope and151 tokens, display the final included date and ignore a cleared end date. Native Projects facts/keyboard actions, metadata filters, observed/single-bucket History, cold palette query/focus handoff, Models180ms selection/reduced motion, preferences and window-size IPC also pass. All64 served web files match the tested distribution. All3159 bundle files remain unchanged. The owned native database retains3 records and221 tokens across native/computed/unknown monetary bases and passes integrity_check. All recorded QA daemons/tray processes stop.

The source bundle, both owned native profiles and ZIP remain retained. Only the two completed fresh ZIP QA extraction folders were removed, after exact archive/source/index/path/no-link/stopped-PID checks; separate cleanup receipts retain their identities and recovered bytes. Existing application data, prior ZIPs, main and unrelated work were preserved.

## Limits and remaining acceptance

The gallery compares original concept images with actual native QA data, not invented content. It does not claim99–100% approval. The16 current captures use an owned synthetic fixture; the delivered app displays collected actual data. Separate webContents.capturePage bitmap attempts are diagnostic and are not an exact parity pass. The native run uses offscreen/nonfocusable windows, anti-occlusion/background-throttling controls, and reduced motion except the explicit Models checks; this does not validate physical tray clicks, minimize/restore on real monitors, broad motion/performance or all customer/provider datasets. It is not installer/two-version migration/rollback acceptance.

The historical intermittent server2/client1 integration observation is still not fully explained. Source149 fixes a demonstrated daemon abort-before-handler defect, source154 fixes a demonstrated shipped-dev-proxy early-abort defect, and source155 fixes the reproduced initial quota-chart timing issue; these are bounded causal conclusions. Providers105 header pixels and Models3 edge pixels from previous browser comparisons remain unexplained, without masks or relaxed tolerances. Remaining visual/control/motion, customer/provider, native/monitor/performance and migration/rollback requirements still need the full blueprint audit. This portable delivery does not complete the overall goal.
