# History compact range controls / source152

[Original / source151 / current gallery](review.html) · [Current History](after/history.png) · [Open range controls](images/en-dark-1672-open.png) · [Last runnable review150](../redesign-v1.85.150/README.md)

Validated bounded implementation. History now presents its existing range, source and custom date controls through a compact calendar capsule, with outlined Export Logs and icon Pause/Resume actions. Resolved dates come from the actual displayed API scope; custom dates retain exact requested bounds, with an inclusive end caption. All-time and pending requests use their actual translated preset labels. An active source remains visible outside the disclosure. Pausing freezes the caption/source to the retained snapshot even when the hash changes; resuming loads the new route. Export keeps the existing exact CSV scope. Full accessible names, tooltip text, legacy controls and actual data semantics remain available. No fake sort, export menu, lifecycle status or customer data is introduced.

The disclosure uses native details/summary and the existing UsageRangeBar. Enter opens it, Tab reaches existing controls, Escape closes and restores summary focus, and outside pointer/focus dismissal leaves focus with the chosen destination. Viewport clamping handles narrow anchors without horizontal overflow. Native date popups may emit a null relatedTarget, which is deliberately ignored. It is nonmodal. Pause disables opening and its controls.

## Validation

Production build and351 web tests passed. Sixteen compiled browser cases cover EN/TH, dark/light and390/900/1280/1672 widths: keyboard, outside dismissal, popover bounds, source/session retention, pending data, disabled pause and retained-snapshot captions. The unchanged42 calendar scope/display/edit assertions pass across Bangkok/UTC/New York, including DST and cleared date fields; only the helper opens the new disclosure conditionally. The first run caught a real negative-left popover at900px, fixed by viewport clamping. The first calendar driver blindly toggled an already-open disclosure on hash-only navigation, corrected by checking native open state. Original failure logs are retained; no assertion or numeric tolerance was relaxed.

The maintained full integration passes with144 responsive cases, paging, CSV, scopes, live updates, pause/in-flight protection, monetary bases and at most one SSE stream. The first integration run failed on Overview with2 server listeners versus1 client EventSource. A temporary per-connection diagnostic copy then passed, followed by the unchanged suite run serially. This does not establish a root cause or fix: the intermittent SSE integration failure remains unresolved. All3 deterministic direct-HTTP SSE abort/disconnect/shutdown regressions pass. Original failure, diagnostic lifecycle trace and subsequent logs are retained; no assertion, retry budget or product transport was changed.

All eight current canonical within-context screenshot pairs are byte-identical. The historical baseline is the already-verified source151 capture, index f5f103f6e2292019d95ac13cdb05e50243b9b902b6c34f6bed8be0b677e2b45f; it was not rerun against source152. Six other frames remain byte-identical. History differences are restricted to702,80–1363,125 in the header; the table remains1124px wide without horizontal overflow and its ten33px rows fit941px. Providers still has105 unexplained global-header pixels, maximum channel delta4; that gate remains open without masks or tolerance changes.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-history-range-picker.mts
node --import tsx scripts/check-usage-calendar.mts
node --import tsx scripts/check-history.mts
```

The gallery contains complete unmasked frames and original refs verified against the maintained manifest. QA uses isolated consistent synthetic data; production displays actual data. Source/index/artifact hashes, exact compressed logs and capture/diff reproducers accompany this change. These checks do not constitute99–100% reference approval, native or performance acceptance. Review150 remains the previous runnable ZIP and does not contain source151/152. Remaining visual/control/motion, native/customer/provider, physical tray/monitor, performance and migration/rollback acceptance remain open. Main and unrelated work remain preserved.
