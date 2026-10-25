# History single-bucket area — source146

Validated bounded visual correction. Parent `cba8566897f1f34b723417a23f46ead4bf20a86a` (source145). The original goal and99–100% visual acceptance remain open.

Actual production-main Electron validation of source145 passed its functional checks,675 fresh repository tests and two native language/theme/restart cycles. Inspecting the real image then revealed a visual defect those numerical checks did not reject: with just one bucket, each area polygon connected the one observed point to the far-right baseline. This painted a declining triangle without a second data point. [Actual native image before the fix](images/native-before-single.png), with151 tokens (101 input/50 output), is retained. No source145 ZIP was published from that diagnostic build; review144 remains the previous published runnable checkpoint.

The renderer now paints series areas only when there are at least two buckets. Both real series dots, the date tick and keyboard tooltip remain for a single bucket. Empty data paints no areas. Multiple buckets keep their existing polygons. No API, scope, monetary facts, theme, Pet or customer data changed.

The added regression fails against the original compiled source145 renderer (two polygons, expected zero). After the fix, the production web build and351 web tests pass with no failures/skips/cancellations. Eight compiled renderer cases (EN/TH × dark/light ×390/1672) each exercise multiple, single and empty buckets; exact token totals, Home/End tooltip values, point presence and full source/session scope remain asserted. No assertion, timeout or tolerance was loosened. Raw logs are losslessly gzipped; the native source145 report and source hashes are retained.

[Corrected desktop single point](images/en-dark-1672-single.png) · [Corrected Thai/light mobile single point](images/th-light-390-single.png) · [Multiple buckets](images/en-dark-1672.png). These before/after images use different owned fixtures/viewports and are not a controlled pixel comparison or approved concept baseline.

Reproduce from the repository with its existing dependencies:

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history-timeline.mts
```

Source145's675 repository tests/native cycles and full integration are historical evidence for that exact source, not newly run source146 checks. This source146 checkpoint still needs frozen native/ZIP validation. Source145's intermittent SSE count failure remains an open investigation; its later serial pass did not establish a cause. Main/origin and unrelated user files are preserved.
