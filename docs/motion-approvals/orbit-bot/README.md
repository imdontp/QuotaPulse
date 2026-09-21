# Orbit Bot motion approvals

This folder contains review-only art. Nothing here is loaded by the Pet runtime.

## walk_right

- `walk-right-frame-01-v1.png` through `walk-right-frame-08-v1.png`: approved source
  sequence. Frame 01 is the formerly approved v3 anchor, normalized to the same naming
  convention as the other production sources.
- `walk-right-keyframes-v1.png`: current eight-frame review sheet built from those exact
  approved sources. Superseded frame-01 and sheet candidates have been removed.
- Identity and poses are locked to `orbit_bot_animation_keyframes_reference.png` and
  `orbit_bot_animation_production_board.png` from the motion pilot pack.
- Required identity: compact cat-like robot with triangular cyan-lined ears, black face,
  cyan oval eyes, circular side modules and the proportions shown in the boards.
- Review PNGs remain transparent 1254x1254 ARGB source outputs. Approved production files
  are exported under `packages/tray/assets/pets/orbit-bot/motion-pilot/` at 1024, 512 and
  256 pixels, aligned to pivot `(0.5, 0.92)`. The visible alpha bounds are normalized to
  87-90% of the canvas height so the pilot reads at the intended size in the 64 px pet.
- Runtime status: `walk_right` active as an eight-frame 12 fps loop for healthy/working
  Orbit Bot locomotion. All eight frames are preloaded before the renderer switches from
  concept art; missing-frame and reduced-motion paths fall back to concept art.

## walk_left

- `walk-left-frame-01-v1.png` through `walk-left-frame-08-v1.png`: approved sources
  derived by deterministic horizontal reflection of the approved `walk_right` sources.
  This matches the reference board's opposing direction without regenerating or drifting
  Orbit Bot's identity, proportions, timing, or poses.
- `walk-left-keyframes-v1.png`: approved eight-frame review sheet.
- Runtime status: `walk_left` active as an eight-frame 12 fps loop for healthy/working
  leftward locomotion, with the same preload and fallback guarantees as `walk_right`.

## turn_right

- `turn-right-frame-01-v1.png`, `turn-right-frame-03-v1.png`, and
  `turn-right-frame-06-v1.png`: approved first, middle, and final key poses.
  They use the approved walk artwork as the identity anchor and the production board's
  `Turn Right` strip as the pose authority. The rear pose intentionally carries no
  front-facing quota mark.
- `turn-right-keyframes-v1.png`: approved three-key-pose review sheet.
- `turn-right-frame-02-v1.png`, `turn-right-frame-04-v1.png`, and
  `turn-right-frame-05-v1.png`: approved in-betweens generated between their adjacent
  key poses.
- `turn-right-sequence-v1.png`: approved full six-frame review sheet.
- Runtime status: this v1 sequence is retained as review history and has been superseded
  by the approved directional turn v2 correction below.
- Production: six frames, 10 fps, non-looping, fixed pivot `(0.5, 0.92)`, exported at
  1024/512/256 with visible alpha noise removed before scale normalization.

## turn_left

- `turn-left-frame-01-v1.png`, `turn-left-frame-03-v1.png`, and
  `turn-left-frame-06-v1.png`: approved first, middle, and final key poses.
  They reuse or deterministically mirror approved `turn_right` sources to follow the
  production board's rear-left -> rear-right -> right-facing progression without identity
  or material drift.
- `turn-left-keyframes-v1.png`: approved three-key-pose review sheet.
- `turn-left-frame-02-v1.png`, `turn-left-frame-04-v1.png`, and
  `turn-left-frame-05-v1.png`: approved in-betweens derived by exact reuse or
  deterministic horizontal reflection of approved `turn_right` frames.
- `turn-left-sequence-v1.png`: approved full six-frame review sheet.
- Runtime status: this v1 sequence is retained as review history and has been superseded
  by the approved directional turn v2 correction below.
- Production: six frames, 10 fps, non-looping, fixed pivot `(0.5, 0.92)`, exported at
  1024/512/256 by exact reuse or deterministic reflection of approved `turn_right` assets.

## directional turn v2 correction

- `turn-right-frame-01-v2.png`, `turn-right-frame-03-v2.png`,
  `turn-right-frame-04-v2.png`, and `turn-right-frame-06-v2.png` are corrective key poses
  for a continuous left-facing -> rear-left -> rear-right -> right-facing transition.
- Frames 1 and 6 reuse the approved neutral standing pose, with frame 1 reflected
  deterministically. Frames 3 and 4 reuse approved rear three-quarter artwork.
- `turn-left` v2 uses the exact reverse key-pose order, so both directions share identity,
  scale, pivot, and transition boundaries instead of maintaining two drifting sequences.
- `turn-right-keyframes-v2.png` and `turn-left-keyframes-v2.png` normalize visible height
  and baseline for review only. Source candidates stay untouched at 1254x1254.
- `turn-right-frame-02-v2.png` and `turn-right-frame-05-v2.png` fill the outer
  three-quarter transitions using approved artwork; frame 2 is the deterministic reflection
  of frame 5. The complete `turn_left` v2 sequence is the exact reverse of `turn_right` v2.
- `turn-right-sequence-v2.png` and `turn-left-sequence-v2.png` are the complete six-frame
  review sheets, normalized to a common visible height and baseline so source-size drift does
  not mask the rotation path during review.
- Approval status: the complete v2 sequences are approved.
- Production: active at 1024/512/256. Every frame is normalized to the existing 90% visible
  height and pivot baseline `(0.5, 0.92)`; `turn_left` is the byte-exact reverse of
  `turn_right` at every tier.
- Runtime: active before directional walking. `turn_right` finishes on the byte-exact
  `stop_004` neutral anchor before `walk_right`; `turn_left` starts from that same anchor
  and reverses the path before `walk_left`.
- Regression coverage verifies the six-frame reverse pairing and neutral endpoint at all
  three production sizes.

## stop

- `stop-frame-01-v1.png` and `stop-frame-04-v1.png`: first and final key-pose review
  poses approved for the four-frame stop/idle transition. Frame 01 settles the final step;
  frame 04 is the balanced neutral stance.
- `stop-keyframes-v1.png`: approved two-key-pose review sheet.
- `stop-frame-02-v1.png` and `stop-frame-03-v1.png`: in-between review candidates that
  progressively retract the forward foot, straighten the torso, and lower both arms.
- `stop-sequence-v1.png`: approved full four-frame review sheet, normalized to a common
  90% visible height and pivot baseline for flicker/jitter review. The source candidates
  remain untouched at their original 1254x1254 canvas.
- Identity and pose direction are locked to the approved Orbit Bot walk art plus the
  production board's `Stop` and `Stop / Idle Transition` strips.
- Runtime status: active after a walk reaches its destination. Desktop translation remains
  stopped while all four frames finish; only then is movement completion reported and the
  idle cooldown started. The single authored right-facing clip mirrors for a left-facing stop.
- Production: four frames, 8 fps, non-looping, fixed pivot `(0.5, 0.92)`, exported at
  1024/512/256 with visible alpha noise removed before scale normalization.

## sit_down

- `sit-down-frame-01-v1.png`: transition anchor reused byte-for-byte from the approved
  `stop-frame-04-v1.png`, so entering the rest sequence cannot flash or change identity.
- `sit-down-frame-04-v1.png`: approved key pose for the deepest compressed lowering point;
  the head pitches forward while the knees fold under the body and the arms brace low.
- `sit-down-frame-06-v1.png`: approved key pose for the balanced final seated posture.
- `sit-down-keyframes-v1.png`: approved three-key-pose review sheet. Every source uses the same
  0.30 review scale and is aligned to a common 92% baseline; the naturally shorter seated
  silhouettes are not independently enlarged.
- `sit-down-frame-02-v1.png`, `sit-down-frame-03-v1.png`, and
  `sit-down-frame-05-v1.png`: in-between review candidates. Frames 2 and 3 progressively
  lower the head, pelvis, arms, and bent knees into frame 4; frame 5 lifts and settles the
  body from the deepest crouch into the final seated pose.
- `sit-down-sequence-v2.png`: approved six-frame review sheet. It corrects small generated
  component-scale drift using head-width scanlines, preserves the natural pose-height arc,
  and aligns every frame to the common 92% baseline. Source candidates remain untouched.
- Identity and pose direction are locked to the approved Orbit Bot stop art and the
  production board's six-frame `Sit Down` strip.
- Runtime status: active when the idle scheduler selects `sit`. All six frames finish before
  frame 6 is held as the seated posture; interaction, alerts, and movement wake the Pet.
- Production: six frames, 10 fps, non-looping, fixed pivot `(0.5, 0.92)`, exported at
  1024/512/256 with component-scale drift corrected and visible alpha noise removed.

## sit_idle

- `sit-idle-frame-01-v1.png` is reused byte-for-byte from the approved final `sit_down`
  pose, so entering the loop cannot change identity or posture abruptly.
- Selected loop sources are frames 1/2/3/5/6 v1 plus `sit-idle-frame-04-v2.png`.
  Frame 4 v2 replaces the earlier unselected v1 candidate, which lowered and shrank the
  character beyond the adjacent key-pose range.
- The six-frame arc is neutral -> early eyelid close/lift -> half-blink high point ->
  eyes-open recovery -> relaxed low point -> neutral return.
- `sit-idle-sequence-v1.png` uses one fixed 0.30 review scale and a common baseline rather
  than independently normalizing each pose, so any source scale or pivot drift remains
  visible during approval. Source candidates stay untouched at 1254x1254.
- Approval status: the complete six-frame sequence is approved.
- Production: active at 1024/512/256 using a fixed scale derived from the final `sit_down`
  anchor and a common pivot baseline `(0.5, 0.92)`. Frame 1 is byte-identical to
  `sit_down_006` at every tier, and the remaining frames preserve the approved breathing arc.
- Runtime: active as a six-frame 8 fps timer-paced loop immediately after `sit_down`
  finishes, avoiding a continuous 60 fps animation-frame loop while the Pet is resting. It
  keeps looping while seated and stops on interaction/wake; reduced-motion and incomplete-
  asset paths retain the static final `sit_down` frame.
- Regression coverage verifies asset shape, the byte-identical transition anchor, looping
  lifecycle, wake cancellation, packaging inclusion, and master exclusion.

## stand_up

- `stand-up-frame-01-v1.png` through `stand-up-frame-06-v1.png` reuse the approved
  `sit_down` sources in exact reverse order. The transition therefore starts byte-for-byte
  from the neutral seated anchor and finishes on the approved neutral standing anchor.
- This follows the production board's seated -> lift -> crouch -> stand arc. The board's
  final movement-leading pose is intentionally replaced with the direction-neutral standing
  anchor so the runtime can choose `turn_left`, `turn_right`, or direct movement afterward.
- `stand-up-sequence-v1.png` is the exact cell-order reverse of the approved, normalized
  `sit-down-sequence-v2.png`, preserving its component-scale correction and common baseline.
- No generated artwork is introduced, so materials, identity, scale, and intermediate pose
  geometry remain identical to the already approved transition.
- Approval status: the complete six-frame sequence is approved.
- Production: exported as the contract clip `wake_up` at 1024/512/256. Every production
  frame is byte-identical to the corresponding `sit_down` frame in reverse order.
- Runtime: active as a six-frame 10 fps non-looping transition whenever an interaction or
  movement wakes the seated Pet. A movement command received while seated is queued until
  the standing transition finishes, so `turn_left`, `turn_right`, and walking cannot overlap
  the rise. Reduced-motion and incomplete-asset paths retain the existing immediate wake.
- Regression coverage verifies asset shape, exact reverse ordering, non-looping playback,
  movement queuing, packaging inclusion, and master exclusion.

## lie_down

- `lie-down-frame-06-v1.png` is the approved awake lying endpoint. It was produced from the
  approved seated production anchor and checked against both pilot-pack animation boards.
- The pose keeps the approved white/silver shell, glossy black face, cyan identity marks,
  three-quarter orientation, and mechanical limb construction. The head rests low over the
  folded front limbs while the rear body settles to the side, making the state readable as
  lying rather than sitting.
- Eyes remain open and no sleep symbols are present. This leaves expression closure and the
  subtle breathing cycle to the later `sleep_loop` clip instead of baking sleep into the
  transition endpoint.
- `lie-down-frame-01-v1.png` is byte-identical to the active `sit_down_006` master anchor.
  Frames 2-5 progressively move the hands forward, lower the head and torso, fold the front
  joints, and settle the rear shell before frame 6 completes the awake resting pose.
- `lie-down-sequence-v3.png` is the selected six-frame review board. It applies the intended
  component-scale corrections while keeping every pose on the shared `(0.5, 0.92)` pivot;
  this exposes the short mechanical settle at frame 4 without allowing generated source
  scale drift to make the character appear to grow.
- Approval status: the complete six-frame v3 sequence is approved.
- Production: active at 1024/512/256 with the v3 component-scale corrections and shared
  `(0.5, 0.92)` pivot. Frame 1 is byte-identical to `sit_down_006` at every tier.
- Runtime: active as a six-frame 10 fps non-looping transition when the `lie` posture is
  selected. After completion it holds the awake frame 6 without a 60 fps render loop until
  an interaction clears the posture. Reduced-motion and incomplete-asset paths retain the
  existing static CSS fallback.
- Regression coverage verifies dimensions, alpha, the exact seated transition anchor,
  non-looping lifecycle, final-frame hold, fallback isolation, packaging inclusion, and
  master exclusion.

## sleep_loop

- `sleep-loop-frame-01-v1.png` is the approved neutral sleeping pose derived from the
  approved `lie_down_006` endpoint and checked against both pilot-pack sleep-loop rows.
- The lying silhouette, three-quarter orientation, mechanical limbs, shell materials,
  cyan identity marks, and resting baseline are preserved. The awake oval eyes are replaced
  by two calm cyan closed-eye arcs; no `Z` symbols or other effects are baked into the art.
- `sleep-loop-frame-01-v1.png` through `sleep-loop-frame-08-v1.png` form a deterministic
  low-amplitude breathing cycle around the shared `(0.5, 0.92)` pivot. Frame 3 is the inhale
  peak, frame 7 is the exhale trough, and frames 1/5 are neutral crossings. Horizontal scale
  stays within 0.2% and vertical scale within 0.4%, which is roughly one runtime pixel at
  256px rather than a distracting whole-body bounce.
- `sleep-loop-sequence-v1.png` is the selected 4x2 review board. Every frame is derived
  directly from the approved neutral key pose rather than regenerated, preventing identity,
  limb, material, and expression drift. Symmetric pairs 2/4 and 6/8 are byte-identical.
- The complete loop is approved. Production assets are normalized to transparent
  1024x1024 masters plus 512x512 and 256x256 runtime tiers.
- Runtime enters `sleep_loop` only after `lie_down` completes, advances the eight-frame loop
  with a 6 fps timer instead of a continuous animation-frame loop, and remains asleep until
  user interaction wakes the Pet. Reduced-motion and incomplete-asset paths retain the
  static CSS sleep fallback.
- Regression coverage verifies dimensions, alpha, symmetric-frame identity, timer pacing,
  `lie_down` sequencing, persistent sleep lifecycle, wake cleanup, runtime packaging, and
  master exclusion.

## stretch

- `stretch-frame-04-v1.png` is the approved peak key pose. It preserves the production
  identity, three-quarter orientation, materials, calm expression, grounded feet, and shared
  `(0.5, 0.92)` pivot while opening the shoulders and extending both arms.
- `stretch-sequence-v2.png` is the approved six-frame non-looping arc: neutral,
  anticipation, rising stretch, approved peak, release, and neutral. Frame 3 uses the v2
  correction so its hands remain below the approved peak rather than overshooting it.
- Frames 1 and 6 are byte-identical neutral anchors derived from `stop_004`. All review
  frames use 1254x1254 transparent RGBA canvases and a common foot baseline.
- Production assets are active at 1024/512/256 with the shared `(0.5, 0.92)` pivot.
- Runtime plays the clip once at 10 fps when the idle scheduler selects `stretch`, then
  returns to neutral and resumes scheduling. Hover, click, alert, or movement may interrupt
  it immediately; reduced-motion and incomplete-asset paths retain the CSS fallback.
- Regression coverage verifies dimensions, alpha, byte-identical neutral anchors,
  non-looping completion, interruption cleanup, packaging inclusion, and master exclusion.

## hover_react

- `hover-react-frame-03-v1.png` is the approved peak curious reaction, derived from the
  approved neutral production anchor and the pilot-pack Interaction / Hover references.
- Orbit Bot remains grounded in the established three-quarter orientation while the head
  tilts subtly, one forearm lifts in a questioning gesture, and a single cyan question mark
  supplies the lightweight reaction effect shown in the concept.
- `hover-react-sequence-v1.png` is the approved four-frame non-looping arc: neutral,
  notice, approved curious peak, and neutral. The question mark appears only at the peak;
  frames 1 and 4 are byte-identical production-neutral anchors so returning to idle cannot
  flash or jump.
- Production assets are active at 1024/512/256 with the shared `(0.5, 0.92)` pivot.
- Runtime starts the four-frame 10 fps pilot once per resolved hover entry, then holds its
  neutral final frame without a render loop until the interaction layer exits. Pointer exit,
  click, alert, or movement clears the pilot; reduced-motion and incomplete-asset paths keep
  the existing manifest/CSS fallback.
- Regression coverage verifies dimensions, alpha, byte-identical neutral anchors, one-shot
  playback, no-RAF final hold, interaction cleanup, packaging inclusion, and master exclusion.

## idle_loop

- `idle-loop-frame-05-v1.png` is the approved mid-loop inhale and soft-blink key pose,
  derived from the approved `stop_004` production anchor and the pilot-pack Idle reference.
- The pose keeps both feet grounded, preserves the three-quarter Orbit Bot identity, and
  limits the motion to a calm upper-body breath with relaxed cyan closed-eye lines.
- The floating companion drone and sleep symbols from the broader concept board are
  intentionally excluded: they would distract during the always-visible base idle and
  overlap the responsibilities of `sleep_loop`.
- `idle-loop-sequence-v1.png` is the approved eight-frame loop: neutral, inhale,
  half-blink, blink, approved inhale peak, reopen, exhale, and neutral. Frames 1 and 8
  are byte-identical; mirrored return pairs 2/7 and 3/6 are also byte-identical.
- Every review frame is a 1254x1254 transparent RGBA PNG on one grounded baseline. The
  0.985-1.0 breathing range deliberately stays subtle for an always-visible base motion.
- Production assets are active at 1024/512/256 with the shared `(0.5, 0.92)` pivot.
- Runtime advances the standing loop at 8 fps with a single timer rather than a continuous
  animation-frame loop. Walking, posture changes, hover, stretch, alerts, and reduced motion
  stop and reset it; returning to quiet standing restarts from frame 1.
- Regression coverage verifies dimensions, alpha, symmetric return-frame identity,
  timer pacing and cleanup, layer priority, atomic activation, packaging inclusion, and
  master exclusion.
