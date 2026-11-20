# Overview interaction and motion

The current compiled web build passed the [Overview checks](overview.json) in English and Thai, in dark and light themes. Both dark screenshot pairs matched exactly. In each light pair, ten pixels differed by one channel level at most. Captures used a fixed synthetic fixture and no masks. The checks include keyboard navigation from the model list, project selection, quota history, and horizontal overflow at 390, 900 and 1280 CSS pixels.

In the [Runtime Map motion check](runtime-motion.json), an inserted synthetic call reached the UI through the local API and SSE. Its particle moved and expired after approximately 693 ms. Duplicate observations, aggregates, offscreen states and a same-document route change did not replay the motion. Reduced motion and stale quota states paused the orbit.

The [Quota Runway check](runway-motion.json) covered a new observation, a clock-only refresh, reduced motion, stale data, reset changes and removal of the selected reader. The stale marker retained its last observed position. These browser checks used synthetic records and manually triggered scheduler notifications. They do not exercise physical window minimization or establish visual parity with the concept.
