# Overview, Models and Alerts source repairs

## Implemented

- Overview desktop brand caption uses 11px instead of the 8px override. The
  original native reference's bright glyph bounds are 160px wide and 8px tall;
  v1.85.45 was 118px wide and 6px tall. The first new capture measures 163px
  wide and 8px tall. This corrects the large mismatch; the remaining 3px width
  and 1px vertical difference still need refinement. The shared font is retained.
- Overview dark globe uses a smaller, lower-opacity whole-art shadow, a subdued
  unfilled track and lighter inner-ring shadows. Four fixed decorative SVG
  glints restore selective highlights. They have no state, handlers or timers,
  are outside the animated orbit and are aria-hidden. Light styling, quota
  values, zero/unknown handling, progress length and all factual captions remain.
- Models' three desktop lower detail panels have a 10px inline inset. Native
  source raster edges were approximately x1290–1649, versus x1279–1660 in
  v1.85.45. This corrects their missing nested-card hierarchy without changing
  the identity panel, outer column, factual sections or mobile layout.
- Alerts risk rows have 40px decorative icon plates keyed to their actual reason:
  forecast, stale or threshold. Reader advisories use a connection icon. Existing
  severity labels now sit beside the existing title and can wrap. Actual values,
  reasons, vendor identities, links and complete records remain unchanged; the
  bounded scrolling list is preserved. Glow is restricted to dark mode.

The changes were reviewed against original refs by the authorized swarm.
Independent review found no correctness blocker in Overview, while explicitly
not accepting its remaining layered ring appearance as a 99–100% match.

## Remaining work

Refine the measured brand width and remaining globe bands. Cost's source donut
has an amount, caption and date hierarchy; the real-data donut currently has
only an amount, lower than the source. Add truthful monetary basis and committed
date scope rather than copying concept numbers or dates. Live plot/Total
prominence and other eight-page source-region differences remain open.

These are incremental source repairs, not final visual or release acceptance.
