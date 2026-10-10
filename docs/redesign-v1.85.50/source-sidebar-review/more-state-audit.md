# More state audit 50

## Verdict

Providers/Cost canonical captures do **not** show Quick Stats at421px. The initial
pixel audit selected a navigation border because its search window excluded the
actual card. More remains expanded, as intended by shell source. No browser or
application source/distribution mutation was performed for this audit.

## Direct retained-image evidence

Images read and hash-checked against `tmp/sidebar-fidelity-audit-51.json`:

- Providers SHA256 `6f5f6b16690c7fd27b86f989a7ee429d7bbd5a332f915f28449b126e6fe16451`
- Cost SHA256 `5f500b48a331550bb502f116130daf7dfc4c688b5af4d19934d27d6acc2b07c9`

Both1672×941 images visibly contain expanded More with Providers, Cost, Settings.
Actual card border peaks are y546 and834. Footer border peak is873. A diagnostic
sidebar contact sheet is `tmp/sidebar-more-native-50.png` (20px heading offset in
that contact sheet; measurements above use original image coordinates).

`tmp/sidebar-fidelity-audit-51.py:24` only searches400–474 for the card top.
Line25 searches690–779 for bottom. The actual546–834 card is outside both ranges;
the selected421 line belongs to expanded navigation. Those results were candidate
pixel maxima, not confirmed card bounding boxes. Providers original401 similarly
belongs to its selected navigation band; original Quick Stats is around444.

## Source/harness evidence (line numbers at audit time)

- `packages/web/src/redesign/shell.tsx:94` sets `open` when active is Providers,
  Cost or Settings. Lines95–96 render summary and all three destinations.
- `packages/web/src/redesign/overview.css:87–93` uses a normal flex column with
 24px top padding and38px sibling gap.
- CSS172 gives More summary min-height32;174 sets expanded details grid/gap5;
 175 gives its nested anchors min-height40. CSS247 applies Quick Stats margin−9.
- CSS1340 gives footer min-height64 with auto top margin. CSS1350 bounds sidebar
  to viewport height−60 and permits vertical scrolling; it does not force all
  expanded content to fit the original screenshot footprint.
- `scripts/check-stable-captures.mts:2671–2678` uses native viewport and a distinct
  document URL for each route, then waits for actual page/daemon/stats settling.
- Lines3033–3038 only collapse Overview's runtime options, blur focus, move the
  pointer, disable transitions/caret, and wait paint frames. They do not collapse
  More. Lines3041–3048 record sidebar paint inputs;3051 captures the image.
- **After** canonical capture,3065 calls `checkShellAccess`. Lines1337–1342 open
  More temporarily only if it was originally closed, then restore that state.
  Line1429 explicitly verifies More remains open on Providers/Cost/Settings.

Thus neither canonical preparation nor the later shell access checks explain a
collapsed menu: the capture itself shows expanded links. The failure was evidence
interpretation in the pixel audit.

## Next vertical layout slice recommendation

1. Replace blind fixed-window card estimates with authoritative DOM bounds before
   each screenshot: nav, More summary, More open flag/rect, each submenu anchor,
   Quick Stats, footer, sidebar scrollHeight/clientHeight/scrollTop. Bind that
   state to filename/index hash. Independently compare the corresponding source
   card crop with bounded scan regions that actually include the card.
2. Treat expanded More as OVR-001 layout substitution. The original PNGs have
   inconsistent six/seven-route navigation and no three-link More accordion;
   their card coordinates are not all directly feasible with the extra rows.
3. Current expanded card translation546−421=125px is consistent with three40px
   links plus one5px content gap; exact internal details formatting is not proven
   by pixel evidence alone. Do not assume three separate5px gaps or a135px shift.
4. The unapplied candidate's larger305px card and47.5px primary cadence will make
   expanded Providers/Cost stacks taller. Their footer min-height alone cannot
   return to source y861/866 while all required links remain expanded in flow.
   Capture actual expanded geometry before accepting that candidate for those
   two pages; retain natural growth/scrolling and never overlap or clip content.
5. Closed-More pages can use measured page-specific spacing without changing menu
   interaction. To achieve source-like compact composition on Providers/Cost as
   well, separately decide and implement a compact More interaction (for example,
   initially collapsed with explicit selected-route indication and all links
   available on opening). That changes the current default-open behavior and
   its explicit harness expectation; it requires an updated reviewed navigation
   baseline and keyboard/access checks, not a silent CSS/test adjustment.

No fidelity percentage, exact icon-font claim, or complete-goal verdict is proven.
