# Motion Extension runtime notes

The four stable companions ship optional `motion-extension/` sheets beside their concept
art. Each sheet is a five-cell, transparent strip on a shared 2172×724 export canvas. The
renderer crops a cell into the fixed 64px viewport; the main process still owns desktop
translation, safe zones, monitor changes, and Return Home.

| Sheet | Cells (left → right) | Runtime use |
| --- | --- | --- |
| `core-pose-sheet.png` | idle, blink, look-left, look-right, happy | quiet idle and hover/click reactions |
| `action-pose-sheet.png` | walk-left/glide-left, walk-right/glide-right, turn, stop, sleep | locomotion and rest states |

Warning, critical, reset, and unknown states continue to use the authored concept-state
viewport so quota severity remains visible. Flux Blob uses the same action slots as a glide
and never adds artificial legs. Missing sheets (including the bonus set) fall back to the
concept art without changing the state engine or the interaction contract.

The source images are generated from the approved concept sheets and
`docs/motion_extension_reference_board_a.png`; the original concept PNGs are untouched.
