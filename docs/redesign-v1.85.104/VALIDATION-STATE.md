# Shared Workspace header checkpoint v1.85.104

Status: validated for this bounded header change. Full dashboard fidelity and original acceptance remain open.

## What changed

All nine production routes use the concept's shared desktop Workspace plate: a left icon/label segment and right machine-scope field inside one frame. Previously seven concept routes stacked the Workspace label over a small field, and Overview lacked the shared frame. A decorative Search mark with a center dot follows the original silhouette. The right field still says This machine / เครื่องนี้ and is read-only; it does not simulate the concept's unsupported account selector or chevron. Scope/data semantics and actual daemon status are unchanged.

Native English anchor estimates from original crops:

| Canvas | Plate x/y/width/height | Workspace text x | Scope field x |
|---|---|---|---|
| Overview1586×992 | 518 / 12 / 271 / 32 | 556 | 618 |
| Other refs1672×941 | 546 / 13 / 286 / 32 | 585 | 650 |

Current values are within1px of those estimates (plate x offsets0.125px and field x offsets0.328px). These are local bounds, not whole-page similarity. The prior stable-gate Overview x518 assertion measured the label's old position where the original actually has the plate's left edge. The revised assertion measures the plate, nested label text and field independently.

Dark frame/background samples come from refs/cost.png: outer border #15253a (existing token); label surface #060c19; field surface #070f1b. The mark uses blue #008cff; the source's filtered antialiased icon median is RGB6,119,220, which is diagnostic rather than an exact solid-stroke color. Light mode retains the accessible existing palette. The plate activates at1536px; compact layouts retain the existing stacked scope treatment, with the decorative mark hidden.

## Validation

- TypeScript/Vite build exit0. Existing >500KB bundle warning remains.
- Ordinary Chrome, no deterministic renderer flags: 324 header layout cases =9 routes ×EN/TH ×dark/light ×9 widths (390,900,1100,1280,1500,1536,1586,1672,1920). Checks cover control/status/workspace separation, no horizontal page overflow, complete localized native scope text, read-only semantics, expected native icon visibility and canonical English anchor estimates. Settings is included in addition to the eight reference screens.
- 36 Ctrl+K/Escape cases: actual native command dialog opens with input focus; Escape restores its trigger. No page errors or forbidden external/write requests. This is header/keyboard coverage, not a native performance or complete all-state app gate.
- Fresh current canonical captures: all eight immediate repeat pairs byte-identical; Overview1586×992, other seven1672×941. Source/index fingerprints bind matrix and captures to the same compiled build.
- Compared to the retained103 captures, all main/sidebar/headings/QuickStats DOM geometry is exactly equal on all eight routes. Every pixel is counted: Overview9108 changed pixels, other seven12092 each, all inside y<60. There are zero changed pixels outside the intentionally edited header, no masks and no raster tolerance. This is a cross-build control for this change, not original-reference likeness.
- Full repository tests, native motion, packaging and rollback were not repeated for this presentation-only change. Their earlier evidence remains tied to its own versions. One attempted canonical capture hit EADDRINUSE because the still-running matrix owned7816; after that exact matrix session completed, the capture ran successfully. No live process was restarted on an observation timeout.

## Review

[All-eight original/103/current viewer](review.html) offers header-only/full-page, side-by-side, overlay and unmasked difference. Current frames use isolated synthetic test data; application data remains real at runtime. Responsive Thai dark/light evidence is linked from the viewer. Source crops are enlarged inspection aids, not application assets.

## Remaining scope

The green header-only control does not clear the earlier103 cross-build Bell/stat-icon/header-corner findings or the native timing diagnosis. Full all-eight palette/type/art/layout acceptance, shared Search field sizing/materials, Cost plot vertical alignment, ranking-rail project colors, native/package/performance/rollback and the requirement trace remain open. See [103 retained controls](../redesign-v1.85.103/VALIDATION-STATE.md) and [the full continuation obligations](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md). No99–100% likeness or user acceptance is claimed.

## Reproduction

Build: npm run build -w @quotapulse/web. Extract archived .mts harnesses to tmp so imports resolve. Run node --import tsx tmp/check-workspace104-matrix.mts, then node --import tsx tmp/capture-workspace104.mts sequentially (both use isolated port7816). Pixel control: node --import tsx tmp/controls-workspace104.mts, with103 and104 capture folders retained. Full324-case observations are gzipped in evidence/header-matrix.json.gz; a readable summary and per-route canonical bounds are separate. Raw logs and exact harnesses are retained. Source LF hashes and index hash are in evidence/source-fingerprints.json.
