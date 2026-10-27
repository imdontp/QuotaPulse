# Alerts forecast and risk display / source177

[Eight-screen concept/current gallery](review.html) reuses seven previous current images and all eight original refs. The Alerts image is from this build; its data comes from an owned in-memory fixture. The running application displays actual collected readings and computed forecast state.

The forecast/risk panel uses the concept's heading in English with a corresponding Thai translation. At English/dark desktop widths ≥1536px, its decorative heading icon is hidden and the title starts at x≈1230 in the 1672px capture, matching the reference position. Other themes, languages and widths retain the existing icon.

The reference forecast orb uses a compact two-line label. In the same desktop state, it displays “DAYS / TO FULL” in that shape while preserving “Forecast days until full use” as accessible text. The shorter text is hidden from assistive technology. The longer wording remains visible in Thai, light theme and narrower layouts. The numerical value, forecast calculation, unknown-state behavior, selected owner, reset time and warning are unchanged.

A fresh production web build passed. At 1672×941 a compiled Chrome capture repeated byte-for-byte; 3,758 pixels changed within the heading and orb regions, with no changes outside them and measured main-region geometry unchanged. A synthetic-data layout run passed English/Thai × dark/light, widths 1672/1280/900/390, title overflow, number/label fit, full accessible copy, fallback icon, keyboard interactions and an unknown forecast case. No real user data or account was accessed. The other seven gallery images were reused, not recaptured.

Review174 does not contain this source change. Full original/concept-plus-overrides baseline approval, native display/performance and the complete application goal remain open.
