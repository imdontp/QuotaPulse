# Projects recorded-trend color and markers

[Compare the original concept, current build and previous build](review.html). The dark-theme selected-project trend now uses a cyan-to-series gradient and a stronger colored area, with screen-space markers at up to seven existing bucket positions. Every bucket, line segment, axis, data-table entry and keyboard/pointer inspection still comes from the existing API response. No activity or values are added. Light theme and other uses of the shared chart retain their existing rendering.

The before and after images use a fixed isolated synthetic fixture: 504 records across six projects and seven days, English/dark, 1672 × 941, DPR 1 and reduced motion. Both captures repeated byte-for-byte. The before image and original reference were reused only after SHA-256 checks. The unmasked comparison changed 7,490 pixels in the project chart bounding box `(1195, 506)–(1628, 580)`; the Models image from the same fixture was byte-identical. Data density and values differ from the concept, so this is a bounded paint comparison rather than a whole-page fidelity score.

The final web build and 381 web tests passed. Projects passed all four English/Thai and dark/light stable capture pairs byte-for-byte. Those API-backed checks verify plotted values, scale, tooltip, complete data table, keyboard/pointer operation, responsive widths and that accented markers correspond to actual buckets. The comparison page loaded all three labelled images.

Review224 predates source `3b279d4`. Actual provider setups, physical desktop behavior, performance, source completeness and full concept acceptance remain open.
