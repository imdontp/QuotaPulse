# Models provider overview cards

[Compare the concept and before/after captures](review.html). Captures use an isolated synthetic fixture, fixed clock, English/dark, reduced motion, DPR 1 and the 1672 × 941 reference viewport; they do not contain user data or certify whole-page parity.

The provider overview's 49px scrolling region previously contained 61px-tall cards for this fixture, clipping their lower content. The cards now show a compact `pair`/`pairs` label, with a shared visible explanation that these are model/provider pairs. Each card keeps its full original text in its accessible name and a tooltip; totals, counts, provider identities and sparklines still derive from the same data. Reduced vertical padding allows the four fixture cards to fit the 49px region. Longer real names or additional providers can still require scrolling; the region remains keyboard reachable.

The web build and 382 web tests passed. The compiled Models browser suite passed English/Thai × dark/light, independently checked each provider's counts and token history against the synthetic API, verified its full accessible name and tooltip, and checked that the four canonical cards fit. All four capture pairs repeated byte-for-byte without masks. A prior attempt placed the explanation inside the heading and failed the existing heading-text check; the final version places it beside the heading and the suite passed. `browser-result.json` records the final build and cases.

The final reference-sized capture repeated byte-for-byte, SHA-256 `e88155ff0ad0010a6aa99414d6da3a0f79106d2331719caf9230eef43b8ffaec`; its compiled web index SHA-256 is `2dade76196ed349f983152c65f795f7c785c257281738e7019a88612da96d24d`. The before capture is byte-identical to `../redesign-v1.85.254/models.png`. An unmasked RGB comparison changed 12,800 pixels, of which 12,797 are in the provider panel's y=846–940 band; three pixels differ above it. `layout-evidence.json` records the before/after heights and texts.

Review257 predates this change. Real provider setups, physical/native behavior, and remaining full concept and release acceptance are still open.
