# Checkpoint v1.85.98 — content-sized Providers grid

Incremental work toward the original all-eight redesign. Synthetic evidence below is for layout verification only and is not a product-data screenshot.

## Change

- Reduced the desktop Providers grid's reserved minimum height from 485px to 360px. This retains room for the existing loading skeleton and a quota-bearing card, while letting the loaded layout follow the cards it actually has.
- Added a browser assertion that checks the gap from the last real owner card to Selected owner details.
- Kept the observed four account owners and quota/reader information unchanged.

## Verification

- `npm run build -w @quotapulse/web`: exit 0; the existing Vite chunk-over-500KB warning remains.
- Synthetic in-memory Chrome browser gate: 28 stages; exact native duration/identity/lifecycle checks passed; zero browser errors and forbidden requests.
- At 1672×941, Providers has 12px from the last card to Selected owner details. Cost Quick Stats top is 445px and Providers is 442px; More starts collapsed and exposes the sibling route when opened.
- The captured image [providers-after-layout-synthetic.png](evidence/providers-after-layout-synthetic.png) uses the browser gate's synthetic DB.
- Compiled production index SHA256: `9d691fe8289fcb909c72ec581f1098dbe99486e312388a3f5784242d5fac6b2a`.
- Visual frame sampling still has two gaps for the existing Models same-model/distinct-provider 180ms case. This is not a rendering smoothness pass.

## Still open

Reference fidelity across all eight screens remains in progress. Remaining reference-specific repairs and human review, locale/viewport/state coverage, native/package and performance checks, rollback evidence, and full blueprint trace remain open. See [remaining work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md).
