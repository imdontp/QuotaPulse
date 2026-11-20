# Windows review271

Review271 includes the Overview single-observation marker, desktop Runtime Map legend and native dashboard visibility changes through commit 118a4b3a882ddb0c52ca31458800dab3a72c879c. The version tag is redesign-native-review-v1.85.271. The [comparison gallery](comparison.html) pairs all eight English dark dashboard screens with their original concepts at matching viewport sizes. The fixture data and reduced motion are specific to those captures.

The delivered ZIP is tmp/releases/QuotaPulse-v1.85.270-review271.zip in the main checkout. SHA-256 is 183229c114f88ee7b87fb44378fa59d9784bca2eadbd15829a5ec68d4d9dd591. Every entry was decompressed and compared with the unused source bundle. Six checks exercised reader opt-in, refresh and restart through the portable launcher using synthetic local logs. See the [archive receipt](archive.json) and [reader results](readers.json).

Extract into a dedicated folder on Windows x64 with Node 22.13.1 on PATH. Open PowerShell there and run ./scripts/start-review.ps1, then open the dashboard from the review tray icon. Stop with ./scripts/stop-review.ps1. To collect actual local harness logs, start again with ./scripts/start-review.ps1 -EnableReaders. The portable launcher stores data in review-data under the extracted folder.

This unsigned review remains under evaluation. Cross-version rollback to review262, real-account behavior, production performance and full concept acceptance require separate evidence.
The [native lifecycle test](native.json) used Electron, main, preload and web assets from the same ZIP extraction. Activity painting and the Runtime Map refresh stayed suspended during minimization. Restore displayed the latest synthetic data and the owned process terminated successfully.
