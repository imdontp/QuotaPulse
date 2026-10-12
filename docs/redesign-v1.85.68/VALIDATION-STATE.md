# v1.85.68: Activity visibility and current integration validation

Validated scoped implementation checkpoint. Whole-reference and release acceptance remain open.

ActivitySparkline now skips bitmap/context/paint operations while disconnected, hidden, outside the viewport or nonintersecting. Intersection/visibility events resume current props; older browsers have a capture-scroll geometry fallback. Existing paint math, title, ARIA and supplied minute values remain unchanged. Cleanup includes the added observer/listeners and a disposal guard.

The original actual-source probe reproduced offscreen clearRect increments3→5→6→9 for points/theme/resize. After the fix, the same operations stay3→3→3→3 and visible reentry paints once at the latest360px width. No-IntersectionObserver fallback uses actual window scroll and passes too. Headless hidden state is explicitly **emulated**, not real Electron minimize proof. Before/after proof and all20 assertions from the repository command are archived. Resource counts cover component-owned listeners/observers, with Playwright instrumentation excluded. These are causal operation counts, not CPU throughput improvements.

## Current gates

- Web, daemon and tray/preload builds: passed. Existing Vite chunk warning remains.
- Repository tests:474 passed (daemon106, web170, tray198).
- Full EN/TH dark/light matrix:40 repeat pairs passed;33 byte-identical, seven within original unmasked tolerance. All80 image hashes verified against actual files.
- UI compatibility:16 Live/Limits responsive language/theme cases, navigation/settings/loading/empty/error/recovery and existing popup preferences passed.
- Isolated Electron: actual compiled preloads, dashboard/popup, readiness/action IPC, instance-profile helper and bundled Thai font passed. Fixture main process only; no installer/live readers/installed tray verification.
- `npm run test:activity-visibility`, then `ACTIVITY_PROBE_NO_IO=1` with the same command:10 assertions each passed, browser/server closed.

Production index: `f7d1206ef4ddf75c6fc2f1ee6c36cc5e6d22fe45338b19caefea9a6e50922b5a`. Source and normalized-log provenance are in build-provenance.json. The original failed mobile bitmap assertion is retained: expecting redraw while the chart was offscreen no longer matched the approved behavior. The test now scrolls the actual chart into view before checking width; its existing pixel/data/theme/accessibility assertions remain.

The full matrix manifest is archived; eight affected Overview images are preserved in overview-captures. Other matrix PNGs remain at the local screens/stable-captures path and were hash-verified; they are not copied into this checkpoint archive.

## Reference review and remaining work

All11 title size/tracking/position trials were rejected because measured glyph alignment was worse than current67. Rejected captures/crops/method are retained under rejected-title-trials; no title CSS was changed. Offline all-eight review uses explicitly labeled build67 inputs and identifies lower globe atmosphere, map arrowheads/node rims and Models input/output donut palette as next artwork candidates.

Full source99–100% likeness is not established by repeatability. An approved whole-source implementation baseline/SSIM gate, remaining artwork measurements, actual hidden desktop/performance lifecycle, current packaged/install/rollback evidence and final manual accessibility/user acceptance remain open. Main and unrelated .zed files were not changed.
