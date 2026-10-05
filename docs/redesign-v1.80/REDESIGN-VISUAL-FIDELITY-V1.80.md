# QuotaPulse visual fidelity checkpoint v1.80

## Alerts navigation badge

The sidebar Alerts link displays an orange count of current quota-risk windows. It uses `/api/overview` and the same shared risk calculation as the Alerts page. Duplicate readings collapse to the freshest reading for each owner and quota window; hidden subscriptions and stale or expired readings are excluded. A fresh reading crossing 50%, 80%, or 95%, or a valid forecast reaching full use before reset, contributes one risk. A zero count or unavailable overview hides the badge.

The localized accessible name and hover title describe current quota risks; the count is not an unread-event count. The badge follows the theme and responsive sidebar layout. The concept screenshot shows `3`; this build shows the count from current data. The deterministic review fixture produces `4`.

The shared implementation is in [alert-risks.ts](../../packages/web/src/redesign/alert-risks.ts). Quick Stats and quota summary requests settle independently so a failure in one does not discard the other request's fresh result.

## Validation

- Web unit suite: **148 passed**. See [unit-tests.log](unit-tests.log).
- `npm run build -w @quotapulse/web`: passed. Vite reports the existing 532.87 kB `App` chunk advisory.
- Repeated production Overview gate passed in English/Thai and dark/light: 4 screenshot pairs, 2 byte-identical. The English/dark pair differed by 94 pixels (maximum channel delta 2); Thai/dark differed by 12 pixels (maximum delta 1). All pairs stayed within the recorded tolerance. No masks were used. See [overview-verification.json](overview-verification.json).
- The production browser gate compared the sidebar badge with `/api/overview`, checked localized accessible labels, and checked badge bounds at 390, 900, and 1280 pixels. Alerts route checks also compared the page summary with the sidebar count.
- The Alerts layout assertions completed on the canonical capture pass for all four language/theme combinations. A strict second-pass image comparison is still unstable for English/light: 42 changed pixels, maximum channel delta 52. An isolated repeat after explicitly waiting for the Thai font still changed 47 pixels, maximum delta 52. The changed areas were toolbar controls, the page-heading icon, and sidebar card edges; the badge was not among them. No masks were used. See [alerts-verification.json](alerts-verification.json).
- `npm run test:history` did not reach the Alerts checks: it timed out at `scripts/check-history.mts:209` waiting for the Overview metric `7,525`. A separate direct run of the Alerts layout helper passed the new badge assertions, then failed its `Quota chart uses stretched coordinates` assertion. These failures remain open; they are not reported as passes.
- The review bundle was built for Windows x64 and external Node ABI 127. All **5 extracted-runtime checks** passed with readers disabled and an isolated profile. The verified ZIP contains 3,135 files (201,581,025 bytes), SHA-256 `b713a08ab146d21195cde11f37cc7311750a60a48cf7b8dd00dd8e869128618f`. Every archive entry was decompressed and hash-compared with its tested bundle source. This is a review build, not a signed production installer; matching host Node is required.
- All eight original reference-image hashes remain unchanged. Browser captures use an in-memory synthetic fixture; the running app remains connected to daemon data.

Open [reference-review.html](reference-review.html) to compare the concept references with the production captures, including the Alerts page.

The overall 99–100% visual-fidelity target remains open. The Alerts badge closes one visible gap. Topbar and page chrome, quota details and denominators, and Pulse Insights content and styling remain on the comparison list.