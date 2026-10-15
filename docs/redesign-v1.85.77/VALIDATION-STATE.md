# v1.85.77 — Dashboard route loading and recovery

## Status

Validated bounded change. The overall concept/blueprint goal remains active and unachieved.
Based on `afe2467`, branch `design/redesign-foundation`, tag `redesign-visual-fidelity-v1.85.77`.

## Changes

- Deferred dashboard modules now show the actual common header/sidebar in the selected language/theme, with neutral reserved content instead of an unstyled English-only Loading line. The fallback has no fabricated records, counts, quota or charts; QuickStats scope is unknown until the route can supply it.
- One I18nProvider remains above the keyed route boundary, retaining preferences and its response guards through A-B-A-B navigation. Outgoing routes unmount when the destination changes. Fallback theme changes are persisted before the loaded route mounts.
- A rejected route import or descendant render failure keeps navigation and offers a localized retry button. Retry reloads the current document/hash, which actually recreates a rejected React.lazy import.
- Overview reuses its existing neutral region component and preserves the20px section gaps. Other routes reserve a generic panel during module loading; they do not yet implement their complete per-region API loading contract.
- History typography now explicitly retains its established inherited button font,15px headings and zero heading bottom margin, making its appearance independent of shared/page stylesheet order.

## Current validation

- Production web build exit0; existing bundle-size advisory remains.
- Web tests:205 passed, zero failures.
- Final sequential browser pipeline exit0: route lifecycle, all-eight native capture, then original History gate.
- Permanent command: `node --import tsx scripts/check-route-loading.mts`.
- 23 lifecycle cases:18 cold modules (nine routes × EN/TH; desktop, with narrow Settings), one A-B-A-B navigation with language/theme changes while Models is held, two narrow EN/TH503 chunk failures recovered using keyboard Enter/reload with changed theme retained, and two existing Thai legacy/popup entry smoke cases. Header/navigation frames match before/after the held module in all18 cold cases. Unknown pending counts, no horizontal overflow and no uncaught browser errors are asserted. History action13px and timeline15px are checked in both languages.
- Native EN/dark all-eight loaded captures: six pages are exactly equal to75. Overview differs by30 pixels/max channel delta35 confined to sidebar Alerts icon [29,320,50,335]; History differs by2 pixels/max2 confined to sidebar [29,694,57,695]. The cause of these small remaining icon differences is not established. Loaded page bodies are pixel-identical to75 in this comparison. This is preservation, not original-reference approval.
- History original gate: eight default/selected pairs across EN/TH dark/light, all byte-identical. Original maxChannelDelta10 / maxChangedPixelFraction0.00005 tolerance and no masks are retained. Existing record metadata, drawer frame, keyboard/focus and narrow layout assertions remain active. Same-build repeats do not by themselves prove prior-version drawer pixel parity.
- All three final browser manifests match the current production index. Source hashes, built JS/CSS hashes and archive hashes accompany the evidence. Rehashed all eight current Downloads refs: exact match to the immutable69 copies used in the viewer.
- Swarm read-only reviews found the Overview spacing issue and History cascade collisions; both are corrected. No other blocking or important scoped defect was identified. Reviewers did not run build/browser gates.

## Failures and causal evidence

Before implementation, deferred Overview in both EN/TH rendered zero dashboard shells and the English `Loading…` message. These captures are retained in before/.

The first expanded probe failed its dark-theme assertion because its browser-native-ready stub used an arrow that tsx transformed into a reference to unavailable `__name`. The init script failed before preferences were seeded (diagnostics/theme-cause.log). Using an object method removes that dependency; the original reproduction and final full lifecycle cases pass. No application theme change was made to mask the fixture failure.

Eager shared CSS changed History's equal-specificity cascade. Before correction, native History changed10144 pixels/max231. The aligned same-page minimal control changed button11px→13px and heading16px→15px, restoring the75 image to3 pixels/max2. Explicit History declarations apply this correction. A prior broad stylesheet reinsertion used an open detail state and was not a valid native image control; only the aligned minimal control is used as the parity evidence. diagnostics/history-order/ retains computed styles, control images and the pre-fix native result.

## Remaining scope and risks

This preserves visible chrome during lazy loading; fallback and loaded shells are separate instances. Persistent shell DOM/state identity is not established. Per-route initial API loading/error geometry and some last-good/scope transitions remain open. Header/nav equality does not prove whole-page zero layout shift. Narrow successful cold loading covers Settings, not every page.

The native bridge is stubbed to observe React-mounted readiness only. Actual Electron focus/watchdog/minimize/restore/unmount remains unverified by this browser test. Existing legacy/popup functionality smoke checks pass; eager shared shell JS/CSS now loads on those entry modes too, and its startup/performance budget is not certified here. No current full40, whole-repository or packaged release gate is claimed.

Whole eight-page source/art/state/action acceptance, remaining motion, performance/high-cardinality, packaging/rollback and manual accessibility/user acceptance remain open. The unexecuted PulseAmbient proposals in next-trial/ are future experiments; orbital contamination in an earlier bright-pixel diagnostic is explicitly corrected there. No 99–100% whole-source likeness claim is made.
