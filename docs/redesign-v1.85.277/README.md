# Windows review277

Review277 includes the Live minute axis, observed refresh samples, narrow-screen card labels and Cost currency icons through source commit a1ef7b24326defd33fb3114f7b4fd8290d6105be. The source tag is redesign-native-review-v1.85.277.

The delivered ZIP is tmp/releases/QuotaPulse-v1.85.276-review277.zip in the main checkout. Its SHA-256 is 4f4e2a2768ea3de5c8141abb33f58908ed0c4ff725e6254d9325c2d19a484be0. Verification decompressed every entry and compared its bytes to the source bundle. See the [archive receipt](archive.json).

Extract to a dedicated folder on Windows x64 with Node 22.13.1 on PATH. Run ./scripts/start-review.ps1 from PowerShell there, then open the Dashboard from the review tray icon. Run ./scripts/stop-review.ps1 to stop it. To read actual local harness logs, start with ./scripts/start-review.ps1 -EnableReaders. The portable profile is stored in review-data under the extracted folder.

The [comparison gallery](comparison.html) pairs all eight original concepts with English dark captures at matching viewports using an isolated fixture and reduced motion. Each capture repeated identically. [Capture details](captures.json), [reader checks](readers.json) and [native visibility checks](native.json) are bound to the same ZIP web entry point. The reader test uses synthetic local logs. The native check exercises show, hide, minimize and restore on Windows.

This unsigned review still needs full visual acceptance, production performance evidence, real-account validation and a review277 cross-version rollback check.
