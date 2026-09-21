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

`idle_loop` is an approved eight-frame, 8 fps grounded breathing/blink loop. It runs only
while Orbit Bot is quietly standing in a healthy or working mood. The renderer advances it
with one frame-paced timer—not a permanent animation-frame loop—and resets it when walking,
rest postures, hover, stretch, alerts, or reduced-motion take priority. Missing/incomplete
assets keep the existing authored WebP/CSS fallback.

The approved production set currently includes direction-specific `walk_right`, `walk_left`,
`turn_right`, and `turn_left` clips plus the shared `stop` and `sit_down` transitions. Both
turn clips are six-frame, 10 fps, non-looping transitions: desktop translation pauses until
the turn finishes, then the matching walk clip starts. Each turn and walk direction is shipped
as authored pixels and is never mirrored again by the renderer.

`stop` is a four-frame, 8 fps, non-looping transition authored facing right and mirrored by the
renderer when the completed walk faced left. Desktop translation has already stopped while it
plays. Movement completion is reported, and the roaming idle cooldown begins, only after all
four stop frames finish. Reduced motion, unavailable frames, and non-pilot moods keep the
existing static/CSS fallback behavior.

`sit_down` is a six-frame, 10 fps, non-looping rest transition. Its first frame is
byte-identical to the approved final `stop` frame. After all six frames play, the renderer
holds frame 6 as the seated posture until an interaction, alert, or movement wakes the Pet;
this prevents a flash back to standing while `sit_idle` is still awaiting production. Reduced
motion and unavailable-clip paths retain the existing static posture fallback.

The source images are generated from the approved concept sheets and
`docs/motion_extension_reference_board_a.png`; the original concept PNGs are untouched.
