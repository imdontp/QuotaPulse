# Current eight-page review and motion evidence / checkpoint193

[Open the concept and current-build comparison](review.html). This is an interim review, not final concept acceptance. The application source is commit `5f31bc30639cc79bfed1046a0a3a96349441893a`. All eight English/dark pages were captured from the same compiled build against the same isolated, in-memory synthetic dataset and local API, with fixed time, reference viewport sizes, DPR 1 and reduced motion. The reference PNG hashes match the supplied blueprint manifest. Actual usage, identities and graph shapes depend on the user's real data.

Every screenshot pair repeated byte-for-byte within its context; all 16 gallery images loaded and eight tabs and keyboard navigation worked. These are repeatability and gallery checks, not proof of 99–100% reference fidelity. Six existing committed PNGs were reused only after confirming they are byte-identical to the new captures. Overview and Models are newly stored. After capturing, a fresh web build reproduced all 88 compiled file hashes, including index `88e35437de251ef21b8e1fc656099a7779bbc2672e8d33b14d2e68040b1600ac`.

Three previously incomplete motion drivers were run once against that same web build with real browser animations, local API/SSE and synthetic data:

- History/Alerts: four timeline stages plus both lifecycle helpers, selection and focus restoration, reduced motion, duplicate/filter behavior and rail matrix passed.
- Projects/Runtime/Providers: 27 stages passed, including selection, duplicate updates, reduced motion, offscreen return and unmount.
- Aggregate presence: 28 stages passed; actual animation durations and identity/lifecycle checks passed and the visual-sampling gap count was zero.

The earlier intermittent frame-sampling failure did not reproduce in these single runs. Its cause remains unresolved; these passes do not establish that it is fixed or quantify physical desktop performance. The aggregate diagnostic recorded 12 long-task entries (50–206 ms) while its test instrumentation was active; the attribution and effect on production remain unverified. Motion reports, driver hashes and build hashes are retained here in compressed files and `manifest.json`.

The latest runnable review191 ZIP still contains source190 and does not include the later Model Details presentation at `5f31bc3`. Full concept acceptance, actual customer-reader setups, physical desktop/tray testing, performance, and cross-version upgrade/rollback remain open. The goal remains active.
