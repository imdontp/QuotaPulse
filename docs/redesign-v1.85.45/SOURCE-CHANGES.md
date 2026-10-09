# Original-reference appearance repairs

This checkpoint continues the real-data dashboard. Original references are the
eight PNGs in the user's blueprint `refs`; they match the archived v1.85.43 refs
byte for byte. Values, charts, coverage disclosures and scope behavior remain
derived from the existing API contracts and blueprint v1.1 overrides.

## Implemented

- Projects: decorative session/call/harness icon plates with stacked counts and
  captions, and the dark selected-card blue perimeter. Desktop sparklines are
  36px instead of 48px to fund the taller footer inside the existing card. The
  underlying points and accessible count labels are unchanged.
- Cost: colored icon plates for the three existing factual insights. The model
  panel aligns its heading/table at the start instead of distributing spare
  vertical space through the grid. No fictional savings or recommendation.
- Providers: dark comparison gradients distinguish the actual OpenAI/OpenCode
  provider identity. The vendor comes from subscription/source metadata; other
  providers keep the blue fallback. Light appearance remains unchanged.
- History: blue/purple actual input/output series, five dotted horizontal grid
  levels and sampled real bucket-position vertical guides in dark theme. The
  selected row uses dark blue. Output caption text has a separate lighter shade
  to retain small-text contrast; the marker matches the plotted series.
- Live: saturated actual input/output/total lines and matching legend markers.
  Text colors remain readable. Ordinary Total values use 22px; strings longer
  than ten characters use 11px while retaining their exact value and title.
  Rail spacing was reduced to keep all rows inside the existing 72px rail.

## Corrections found during validation

The first stable capture failed because the Total row exceeded its rail by 3px
at 1280px. Reducing internal gaps fixed the layout without changing the original
visibility assertion or exact values.

The first authenticated workflow queried the first SVG line to measure History
plot width. Adding vertical guides made that first line vertical. Horizontal
guides now precede vertical guides; plot geometry and the width check remain.

The legacy Preview check used old accessible button names and expected remaining
quota (18/62/3 percent). Buttons now include owner/window separators and Pulse
Core displays used quota, as required by the implemented blueprint. The check
now verifies the same fixture's used values (82/38/97 percent) and still verifies
selection, critical state, focus restoration, storage/network isolation and
responsive behavior. Preview is a regression surface, not user-requested fake
data mode for production.

## Remaining original-reference differences

Overview's desktop brand caption is undersized (8px), and its globe has too much
diffuse glow. Live's plot and long Total display remain less prominent than the
source. Models detail typography/insets, Cost donut caption hierarchy, and Alerts
orb/risk icon composition need further comparison. These are open implementation
items; passing automated tests does not establish 99–100% reference likeness.
