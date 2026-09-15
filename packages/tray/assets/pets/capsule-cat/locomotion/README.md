# capsule-cat locomotion skeleton

Wave 2 runtime files the asset agent delivers here (see WAVE2_MOTION_BIBLE.md):

Required:
- blink.webp
- look_left.webp
- look_right.webp
- idle_variant_1.webp
- idle_variant_2.webp
- walk_left.webp
- walk_right.webp
- turn_left.webp
- turn_right.webp
- stop_left.webp
- stop_right.webp

Recommended extended:
- sit.webp
- lie_down.webp
- sleep_loop.webp
- wake_up.webp
- stretch.webp

Until a clip exists the renderer uses its expression/locomotion fallback; a missing clip
must never crash the Pet (WAVE2_ACCEPTANCE_TEST_MATRIX.md section F).