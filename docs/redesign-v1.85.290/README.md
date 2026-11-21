# Windows Review290

Source 6d778751b5cc2bcdd329c8fc201493d09908942b includes the Providers, History and Live changes since Review277. The source tag is redesign-native-review-v1.85.290.

Extract tmp/releases/QuotaPulse-v1.85.289-review290.zip on Windows x64 with Node 22.13.1 on PATH. Run ./scripts/start-review.ps1 in the extracted directory and open Dashboard from the tray. To enable actual local log readers use ./scripts/start-review.ps1 -EnableReaders. Stop with ./scripts/stop-review.ps1. The portable profile lives under review-data.

The [archive receipt](archive.json) covers all 3,164 entries. ZIP SHA-256 is 17427c7d6f3ba790c0afa5443183ce0b065f622f0fc7c431fc76608fac53d373. The extracted build passed [reader opt-in checks with isolated synthetic logs](readers.json) and [native window lifecycle checks](native.json).

The [interactive comparison](comparison.html) includes eight repeatable English dark fixture captures at reference viewports with reduced motion. The [measurements](verification.json) show smaller mean RGB differences on Providers and History, a marginal increase on Live and identical captures on five routes relative to Review277. The delivered ZIPs passed upgrade from Review277, rollback to Review277 and recovery to Review290 in the same isolated schema 7 profile. See the [four-stage results](../redesign-v1.85.291/result.json), [test evidence](../redesign-v1.85.291/evidence.tar.gz) and [runtime cleanup](../redesign-v1.85.291/cleanup.json). Overall visual acceptance, production performance and real-account validation remain open.
