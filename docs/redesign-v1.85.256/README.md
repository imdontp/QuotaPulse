# Live token-flow time guides

[Compare the original concept and before/after captures](review.html). The app captures use an isolated synthetic fixture, fixed clock, English/dark, DPR 1, reduced motion and the 1672 × 941 reference viewport. They do not represent user data or certify overall concept parity.

The reference graph has vertical time guides; the previous Live plot only drew horizontal value guides. The seven added vertical guides use the same timestamp-to-position scale as the actual samples. Time-label anchors now use that scale too, correcting their previous small offset. The axes and guides do not add or modify usage samples, curves or counts.

Web build and all 382 web tests passed. The compiled Live browser suite passed in EN/TH and dark/light: each combination checked normal, zero, empty, partial and unknown-component data against the synthetic API, and measured visible label/guide alignment at 390, 900 and 1280px. Four capture pairs were byte-identical without masks. The initial browser run failed because its existing horizontal-grid selector included the new vertical lines; the selector was narrowed to the horizontal lines and the full suite reran successfully. See `browser-result.json`.

The reference-sized after capture repeated byte-for-byte, SHA-256 `6ba5800f3fbff8b97b10f9237f5407412e25b39b7674017e00812e29322aa3ae`; the original reference SHA-256 is `35f1e735c0d020824f666285038475a6be4af6413c02b3a20f9af75a54e46db6`. The compiled index SHA-256 is `ca16be89696ce45481f4e0c56f4840012bf745aee29fcf0de1259e33d172124a`. An unmasked RGB comparison against the previous gallery Live image changed 1,909 pixels within bounds (271, 622)–(1064, 738), covering the plot and its time labels. `capture-result.json` records the capture context and geometry.

Review249 predates this change. Actual provider setups, physical/native behavior, motion acceptance and the remaining dashboard concept/release gates are still open.
