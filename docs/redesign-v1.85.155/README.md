# Quota chart initial coordinates / source155

The Alerts quota chart could briefly show stretched coordinates on first mount. A focused run of the original assertion measured its actual width932.9375px with viewBox600 and x positions34/407.333/594. One animation frame later the same chart used viewBox933 and positions34/629.333/927. It was not a stale quota value or incorrect percentage calculation: the hardcoded600 fallback remained visible until the first ResizeObserver delivery. The original full integration failure in source154 omitted the measured values; the focused frame trace now establishes this causal timing mechanism.

QuotaChart now measures its mounted client width in useLayoutEffect before paint, then retains ResizeObserver for later size changes. Existing minimum width, percentage/time calculations, unknown sample breaks, reset boundaries, zero baseline, text and accessible sample table are unchanged. The same component serves Alerts and the Overview history disclosure, where it mounts only after the disclosure opens. No API or data changes were needed. The maintained assertion now includes language/theme/geometry in its failure message; its tolerance and timing are unchanged.

## Validation

The identical focused diagnostic asserts the first measured frame, not a later settled frame. Before the change it fails with600 versus932.9375; after the change it reads933 immediately and passes all four EN/TH dark/light layouts. Six measurements per case retain the same correct coordinate width. All zero points remain at y104. The existing focused Alerts flow also checks the unknown sample break, four source owners, sample table keyboard controls, same-owner SSE counter drop, unknown-only owner, sidebar risk count, Quick Stats and390/900/1280 layout. No assertion or numeric tolerance was loosened and no sleep was added to the maintained check to hide the initial state.

Production build exits0 and353 web tests pass without failures/skips/cancellations. The complete maintained dashboard integration, including the Alerts assertion that failed in source154, passes. Its144 responsive cases retain at most one SSE server listener. This does not prove the separate historical SSE intermittence fixed; the dev proxy cause fixed in source154 remains a narrower, independently validated conclusion.

All eight current canonical screenshot pairs are byte-identical within their context. The historical baseline is the verified source153 renderer, not a fresh run relabeled as before. Settled Alerts is byte-identical to that baseline, as are six other pages: this correction changes the transient initial layout rather than the approved settled design. Models still differs by3 unexplained edge pixels at x246,y353–414, maximum channel delta23, and its whole current frame is retained. No mask/tolerance closes that gate. The earlier105 Providers header variance also remains unexplained even though the current Providers frame matches source153.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history.mts
```

The four images are actual occupied Alerts captures after validation; no initial-before screenshot was captured, and no synthetic before image was reconstructed. The before/after frame geometry is the evidence for the transient correction. Compressed exact logs and isolated-fixture reproducers accompany source/index hashes. Reproducers run from tmp/ after decompression; the focused diagnostic copy retains its pre-fix first-frame assertion. No new native, ZIP or performance/migration acceptance is claimed. The most recent runnable ZIP is still review150 and lacks source151–155. Original reference99–100% approval, remaining visual/control/motion, native/customer/provider, tray/monitor, performance and migration/rollback gates remain open. Main and unrelated work remain preserved.
