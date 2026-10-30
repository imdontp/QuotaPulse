# Projects and Models usage-trend guides

[Compare Projects and Models with the concept](review.html). Both captures use the same compiled build, English/dark, 1672 × 941, reduced motion and an isolated synthetic fixture. Real values and curve shapes depend on collected data; the captures are review evidence, not whole-screen visual acceptance.

The shared detailed usage chart draws up to seven decorative vertical guides at existing bucket indices, matching the visual structure in the two reference charts. The data, scales, area, points, accessible table and interaction are unchanged. Empty datasets produce no guides; short datasets have one per existing bucket. Other uses of the shared trend component do not receive guides.

Web build and all 376 web tests passed. Projects and Models each passed four English/Thai, dark/light browser capture pairs; all eight pairs were byte-identical on repeat without masks. The interaction tests checked guide coordinates against API-derived buckets as well as keyboard/pointer selection, tooltip, table, resize and scroll. Both concept-sized captures also repeated byte-identically. Compressed verification and build/test logs are retained in `evidence.tar.gz`.

Review206 predates this and the Cost change in [checkpoint208](../redesign-v1.85.208/README.md). The overall 99–100% concept target, physical desktop behavior, real-provider integration, production performance, cross-schema migration and the intermittent Runtime Map inspector issue remain open.
