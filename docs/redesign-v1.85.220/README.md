# Runtime Map inspector focus

Checkpoint205 recorded an intermittent Overview test failure: after sequential keyboard interaction, the inspector showed the previous unassigned-project title when the empty-project title was expected. Earlier repeated probes did not reproduce it, so its cause remained unknown.

A controlled browser probe now demonstrates a related concrete race on the pre-change build. Closing the native dialog restores its former opener, then a new target can receive focus before the queued `close` event runs. The old `close` handler subsequently focused the former opener again. If Enter is pressed after that unexpected focus change, it can open the former identity. The trace supports this as a plausible mechanism for the original intermittent failure; it does not prove the historical run followed the same event order.

The close handler now restores the opener or fallback only when focus is still in the closing dialog or has fallen to the document. If another element already has focus, it is preserved. The controlled sequence that previously failed now passes. Eight API-backed browser cases cover normal Escape restoration and the queued-close sequence in English/Thai, dark/light and 390/1586px viewports; pressing Enter on the new target then opens the expected distinct null/empty project and its actual synthetic token count. The web build and 381 web tests passed.

The Overview stable suite, including the original sequential keyboard checks, passed all four language/theme pairs without masks. Three screenshot pairs were byte-identical; Thai/light differed in 14 pixels with a maximum channel delta of 1, within the existing raster tolerance. `npm run test:ui` also passed, including the existing legacy and popup checks.

Review218 predates this fix. This finding does not establish whole-dashboard visual fidelity or prove that all possible inspector races are resolved. The test uses an isolated in-memory database and does not exercise actual provider accounts or physical desktop behavior.
