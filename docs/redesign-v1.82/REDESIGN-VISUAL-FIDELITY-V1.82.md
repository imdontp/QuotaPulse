# QuotaPulse visual fidelity checkpoint v1.82

## Runtime Map header

The project selector and graph-data disclosure now sit with the Runtime Map title and breadcrumb. The right side of the heading is reserved for the token-flow and active/idle legend, closer to the supplied concept. The visible record-count chip was removed; the table disclosure retains the count in its accessible name and `data-record-count` attribute.

The selector is compact at desktop size. The map scroll region was adjusted to preserve its prior card geometry after the heading controls moved.

## Layout measurements

At the 1600 x 1000 review viewport, the Runtime Map panel measures x=228, y=473.19, w=1337, h=231. The bottom dashboard row measures x=228, y=714.19, w=1337, h=176.38. This keeps the lower row near the concept's y=715 placement and 173 px height. Detailed measurements for all four language/theme combinations are in [overview-verification.json](overview-verification.json).

## Remaining concept gaps

This checkpoint does not claim 99-100% fidelity. The application continues to render daemon-backed readings, so the content and calculated insight values differ from the fixed concept. The current data model does not provide a trustworthy denominator for the Pulse Core allowance display. The machine workspace label, More navigation item, and usable project/data controls also differ from the supplied image. These captures use a deterministic in-memory fixture for review; they do not replace live daemon data in the application.

The images are repeatable review captures, not approved visual baselines. Compare the latest Overview screenshots with the supplied reference in [reference-review.html](reference-review.html).

## Validation

- `npm run --workspace @quotapulse/web build`: passed. Vite retains the existing advisory that the `App` chunk is 532.87 kB, above 500 kB.
- `npm test`: passed across all workspaces: daemon 100 tests, web 152 tests, tray 198 tests; 450 total, 0 failed.
- `QUOTAPULSE_CAPTURE_SCOPE=overview npm run test:stable`: passed for English and Thai in dark and light themes. Four repeated screenshot pairs passed; three were byte-identical and the remaining pairs were within tolerance (maximum channel delta 2, changed-pixel fraction at most 0.0001). No masks were used.
- `git diff --check`: passed; Git may report its usual CRLF-to-LF advisory for edited files.

The overall visual-fidelity objective remains open. Next, compare the remaining shell labels and visual details with the reference while keeping displayed values sourced from the daemon.
