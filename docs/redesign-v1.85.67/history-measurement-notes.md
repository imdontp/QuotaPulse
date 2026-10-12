# History native dark table paint 67

## Inputs and measurements

Source: original Downloads refs/history.png, SHA-256 `c1955ddc3343731812a4995223f0134cdba9dfa5932a7d25b6fa2e7f7eab5edf`.
Native before: docs/redesign-v1.85.66/native-en-dark/history-default.png, SHA-256 `670a3f419ce6f8724ae1be57be250914687b607d788e0dcd8276bf076d20fdbf`.

Read-only screenshot measurement via Pillow; no browser/service/build/test/Git mutation.
Blank row strips x1014–1025, y±2; RGB median of pixels with max channel<80 to exclude text ink. Each strip has60 pixels. These sample alternate unselected row interiors, not selected blue first row. Source contains texture; current paint is perfectly flat.

| Strip center y | Source background median | Native66 background median |
|---:|---|---|
| 599 | (5, 17, 33) | (8, 22, 35) |
| 630 | (6, 15, 27) | (18, 24, 33) |
| 664 | (6, 16, 29) | (8, 22, 35) |
| 699 | (6, 16, 28) | (18, 24, 33) |
| 730 | (6, 16, 29) | (8, 22, 35) |
| 765 | (6, 16, 29) | (18, 24, 33) |
| 799 | (6, 16, 29) | (8, 22, 35) |
| 831 | (7, 16, 30) | (18, 24, 33) |
| 864 | (6, 16, 28) | (8, 22, 35) |

Footer empty ROI x990–1039/y903–919: source mode(5,14,26)92px, near neighbors(5,15,26)63px/(5,14,25)55px; native66 uniform(18,24,33)850px.

## Causal rule inspection and implemented change

Card in sections/history.tsx inherits global `bg-card` from components/ui/card.tsx. Dark global --card is oklch(0.207 0.020 258), producing native odd rows/footer RGB(18,24,33). history.css:55 assigns even rows color-mix(accent3%,qp-panel), producing(8,22,35). These are unrelated broad gray/bright-blue stripes compared to the measured reference near(6,16,28).

Only packages/web/src/redesign/history.css changed, append-only with original CRLF preserved. Rules require production-history, dark theme and minimum1536px:

- Card background#050e1a matches empty footer mode; sticky thead retains its explicit existing qp-panel surface.
- Unselected resting rows#06101c match most source row medians.
- Even rows#06101d keep only1 blue channel difference; source strips show1–2-channel variation rather than current10-red-channel alternation.
- Explicitly exclude data-selected=true, :hover, :focus-within from both row overrides. Selected existing#06234d, hover utility, focus/interaction styling, text, dividers, padding, sizing, records/pagination/detail and accessible data remain owned by existing rules.

No source screenshot copied into app, no fake content, no new geometry, no model/API/translation changes. Root cost.css work untouched. Notes tmp only.

## Required root checks

After both67 slices freeze: web build; native History default+selected EN/TH dark at1672/1536; fallback/light unchanged; five-width overflow; original scoped History repeat-capture gate(all4 contexts, default+selected=8pairs). Measure same row strips/footer again; verify selected color, row hover, focused detail control and table keyboard focus retain interactions. Compare rectangle geometry/row heights/divider/text placement against66. A screenshot of resting rows does not prove interaction preservation; browser checks should exercise those states. No tests run by this agent; change is source-reviewed and not yet runtime validated.
