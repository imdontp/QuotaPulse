# Next Cost reference repair

Read-only source comparison by the authorized swarm. These are region estimates
at 1672 x 941, not an image similarity score or an implemented change.

| Region | Current | Source target |
| --- | --- | --- |
| Shared overview frame | Absent | x238, y72, width960, height258 |
| Summary cards | y152, height147, first x238 | y131, height187, first x250 |
| Provider frame | x1194, width466, height231 | x1206, width456, height258 |
| Donut | diameter170 | diameter184 |
| Trend/model row | y315, model starts x1075 | y341, model starts x1035 |
| Trend height | 333 | 302 |
| Lower row | y661, height274 | y654–655, height273 |

## Bounded implementation

1. Add a real top-row grid containing an overview panel (existing heading,
   toolbar, summary) and provider panel. Ratio2.115:1, gap8px, overview padding12px.
2. Use compact Cost heading with 32px icon, 18px title and retained subtitle.
   Compact controls retain accessible names, basis/bucket choices and refresh.
3. Make summary cards187px high, retaining unavailable projection explanation.
4. Restore upper row as a real grid, ratio1.255:1 and gap10px, replacing its
   desktop `display:contents` and twelve-column child placements.
5. Make donut184px with approximately130px center and21px type.
6. Preserve the190px plot. Move redundant range text into a compact legend or
   accessible descriptions; place coverage and collapsed chart-data disclosure
   in one footer. Expanded data retains complete tables and may grow the page.

Target collapsed occupied bottom: 72 + 258 + 11 + 302 + 12 + 274 = 929px.
Verify all languages/themes, long identities, zero/unpriced values, exact
History scopes, keyboard scrolling and 390/900/1280 widths after implementation.
