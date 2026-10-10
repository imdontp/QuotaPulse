# Projects selected-card paint review (53)

Independent visual review of the native EN/dark capture after the selected-card paint candidate was applied. This report is read-only with respect to app source and build output.

## Provenance

- Reference `docs/redesign-v1.85.43/refs/projects.png`: SHA256 `279a3d044139bac6d8bf2f0abc0d4ddbc7dfcf82a67d3378992cca19bff74e75`.
- Before PNG `docs/redesign-v1.85.52/menus/projects-default-en-dark.png`: SHA256 `96f026a8e11193b06e274c4414eabc2fe58874c3d27405457b9b062b108cf1ad`.
- After PNG `tmp/project-paint53-en-dark/projects-default.png`: SHA256 `ad835eced4a88f8484ee75f3d417278ee2d0f06619a38bd789023c217ceeb01e`.
- After geometry `tmp/project-paint53-en-dark/geometry.json`: SHA256 `2663d4c3cca7316066aec99a7cf16bdc677d3f919dafcae2a3fef4979bfba3ca` (production index SHA256 `828a2c2bbb4ac9b60ffa10a0a928d69f52c64547b3e082284abffc592a21a833`).
- Measurements `tmp/project-paint53-comparison/measurements.json`: SHA256 `67925f6a22892d85573fb114b0729ec3c0f6866a592d0a86b2d732b47d4dfde7`.

## Findings

**The main paint change is supported by the measurements.** All four interior region medians move close to the reference, including exact RGB match at the right sample:

| Region | Reference | Before | After |
|---|---:|---:|---:|
| Upper | `(5,19,49)` | `(6,19,38)` | `(4,18,48)` |
| Far right | `(6,18,41)` | `(7,17,29)` | `(6,18,41)` |
| Bottom | `(3,20,59)` | `(6,16,30)` | `(2,20,60)` |
| Left interior | `(2,19,61.5)` | `(6,21,43)` | `(4,17,61)` |

The top-rim pixels also match when sampled on the actual border rows: source `y=207` versus current `y=206`. At x=300 and 475 the colors match exactly (`#1EA6FE`, `#5B6EFA`); at x=675 the current `#3A8DFF` is one red channel above source `#398DFF`.

**There is a one-pixel vertical frame offset, separate from paint.** The current card DOM starts at `y=206`, is `466.39 x 258` with a 1px border; the reference visible border starts at `y=207`. Do not compare source `y=207` against current `y=207`: current `y=207` is already interior (`#041536` near x=300). The paint-only rule changes no geometry, so the offset should be assessed independently.

**The left rim still has two localized color differences.** At x=243, y=280 and 330 now match within one channel, but at y=400 source is `#0DCCF1` and current is `#23BAF6`; the horizontal border gradient keeps cyan constant down that edge. The inner bevel at `(244,280)` is still dimmer in the candidate (`#073368`) than source (`#0A519D`). Samples x=245 and 246 are closer. A follow-up should preserve the matched top rim and tune only the y-dependent left edge and first inner pixel.

**No broad background banding is apparent at native size.** The interior stop transition is visually smooth in the comparison. The left wash is a narrow edge seam, not a wide panel stripe; its strongest abrupt transition is around x=244-245, where the reference also has a sharp bevel transition. Check it at 100% when evaluating any follow-up.

The existing shadow remains in place. Pixels outside the card mix shadow and page background, and the reference canvas is bluer than the current canvas (for example `(300,190)` is `#053284` in the reference and `#0C2333` after). That does not isolate a shadow mismatch, so no glow-specific correction is justified from these samples alone.

## Content and scope

The current view still uses live project facts and costs. The reference's demo budget, spend, description, and weekly delta were not introduced by this paint change. The measured frame height and facts row remain at 258px and around y=413; no content row was collapsed or replaced.

No source, JSX, distribution, browser, build, or Git files were changed as part of this review.
