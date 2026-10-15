# Alerts source art review 75

## Review scope and goal

Read-only review of the current three-file diff: `alerts.tsx`, `alerts.css`, and new `forecast-orb-art.tsx`. Goal: replace the dark decorative forecast texture and ring painting with the selected Source art trial while preserving real forecast data, accessibility, component dimensions, and light fallback. Applied `review-code-changes`. No application edits, browser runs or builds by this reviewer.

## Verdict

**Approve with conditions:** no blocking or important code defect found in the inspected diff. Capture evidence must confirm compiled registration, unchanged layout and light fallback before treating this as a validated source-art checkpoint. This review does not establish 99–100% Source likeness or release readiness.

## Positive observations

- `alerts.tsx:161`: the projected-days expression, ready/unknown checks, daemon-based projected time, reset time, owner identity, reader origin/age and warning condition are byte-for-byte preserved in the diff. The only forecast subtree addition is `<ForecastOrbArt/>`. No Source value, quota state, percentage or warning is fabricated.
- `forecast-orb-art.tsx:5`: `useId` makes the gradient reference unique per mounted component. The SVG has `aria-hidden=true` and `focusable=false`; it exposes no fake accessible gauge, legend or extra keyboard stop. Ring segments are static decorative geometry and add no timers, event listeners or animation lifecycle.
- `alerts.css:237–246`: `.qp-alert-reference-ring` is hidden by default and is displayed only for `production-alerts` with dark theme. Its absolute positioning and pointer-events none leave layout and input behavior unchanged. Existing orb width, height, padding, margin and inner grid/text rules remain intact. Light theme retains the prior conic ring/interior because the SVG is display none and new background overrides are dark scoped.
- The Earth image uses an existing repository asset at `packages/web/public/redesign/pulse-earth-v4.png`. It is decorative CSS background painting without an added dependency or remote request.
- The old dark glow pseudo-element inherits the now-transparent background, removing its old conic duplicate; the SVG provides its own segment glow. Existing orb outline, box shadow and outer halo remain. This is a purposeful paint change rather than a new factual state.

## Validation gaps

- Author reports build passed; this reviewer did not independently run or inspect its terminal log. Production captures are pending at the time of this review.
- The ring outer stroke extent is 86.5 viewBox units around center85, so painted glow/stroke may extend slightly beyond the 170px SVG box with overflow visible. Geometry is unchanged by construction; visual registration and surrounding paint isolation require current compiled screenshots.
- A dark scoping check supports unchanged light code paths but is not pixel proof. Capture light and narrow/Thai states, confirm the forecast text stays readable and focus remains unaffected.
- Source art gain must be established using the declared texture/ring masks excluding real text. Do not infer whole-component Source identity from a text-excluded regional improvement.
- Static SVG filters add painting work; this bounded review does not claim overall renderer/CPU performance or native lifecycle acceptance.

## Recommended next actions

Inspect the compiled selected variant against the Source and baseline using the existing registered art regions; confirm forecast/API checks and geometry. Archive candidate rejection evidence alongside selected gain evidence. Keep Cost source unchanged because its three shading proposals were rejected by all registration comparisons.

## Reviewed working-file hashes

- `packages/web/src/redesign/alerts.tsx`: `5345c60979af771ae15c26e679fd1ad4fd4f771f15f4334ce6e8d8d1681d1f22`
- `packages/web/src/redesign/alerts.css`: `5524bdbe69be3e3c0684ecaf328b9f7e9eb73fee5d4d8c686ac13da7761f4c08`
- `packages/web/src/redesign/forecast-orb-art.tsx`: `a42d20d9e812f286f57531c6cbdd93b838e74755848466443a39c24cda34f737`
