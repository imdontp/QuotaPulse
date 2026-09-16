# Motion Extension runtime notes

The legacy `motion-extension/` sheets remain in the source tree as visual references. They
are not release assets and the renderer does not select them: their identities do not match
the approved concept-state art closely enough for production use. The package task therefore
excludes those sheets until replacement clips pass the motion visual gate.

The renderer crops an approved clip into the fixed 64px viewport; the main process still owns
desktop translation, safe zones, monitor changes, and Return Home.

| Sheet | Cells (left → right) | Runtime use |
| --- | --- | --- |
| `core-pose-sheet.png` | idle, blink, look-left, look-right, happy | quiet idle and hover/click reactions |
| `action-pose-sheet.png` | walk-left/glide-left, walk-right/glide-right, turn, stop, sleep | locomotion and rest states |

Warning, critical, reset, and unknown states continue to use the authored concept-state
viewport so quota severity remains visible. Flux Blob uses the same action slots as a glide
and never adds artificial legs. Until an individual motion clip is approved, the concept art
is the safe fallback without changing the state engine or the interaction contract.

The Orbit Bot pilot contract is recorded in `assets/pets/orbit-bot/motion-pilot.json`: 15 clips,
94 total frames, fixed pivot/runtime sizes, and reduced-motion requirements. The manifest is
validated and packaged as metadata; final frame artwork is added only after each clip's
keyframes and in-betweens are approved.

The source images are generated from the approved concept sheets and
`docs/motion_extension_reference_board_a.png`; the original concept PNGs are untouched.
