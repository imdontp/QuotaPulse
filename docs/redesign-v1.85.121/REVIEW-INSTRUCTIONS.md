# Local review: product120 / checkpoint121

This is an unsigned Windows x64 review bundle. It requires installed Node with module ABI127 (Node22.13.1 was used here). It has no embedded test/customer profile. Readers and account probes are disabled by the review launcher; a fresh launch correctly shows empty usage. Existing installations and user databases are not adopted by these helpers.

1. Extract `QuotaPulse-v1.85.120-review121.zip` into a new dedicated folder.
2. From PowerShell in that folder, run `./scripts/start-review.ps1`.
3. Use that review tray icon to open the native dashboard, or open `http://127.0.0.1:7807/#overview` in a browser.
4. Stop this instance with `./scripts/stop-review.ps1`.

Archive SHA256: `8fef215787427a180f2439b5fdcb1257fb3df1385dae9948daeebca580330501` (206481595 bytes). See [archive.json](evidence/archive.json) for the local ZIP path and all-entry verification receipt.

The images in [the native viewer](review.html) use a separate synthetic fixture through the real daemon/main/preload. Those facts are not bundled into the review application and are not a Concept Preview mode. This delivery supports isolated review; all-eight reference acceptance and the remaining native/behavior/resource obligations are still open. Deep Windows PowerShell installation paths retain the known limitation documented in115; no new long-path support is claimed.
