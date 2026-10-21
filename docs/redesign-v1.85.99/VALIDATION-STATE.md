# Checkpoint v1.85.99 — expanded secondary navigation

Incremental work toward the all-eight reference redesign. Synthetic browser screenshots are clearly labeled and do not represent production data.

## Change

- The compact More control stays alongside the selected Providers or Cost Analysis link when closed.
- When opened, remaining routes expand in the sidebar's normal document flow. Quick Stats moves below the menu instead of being covered by an overlay.
- The browser gate now verifies the expanded menu's bottom remains above Quick Stats and captures the open Providers state.

## Verification

- `npm run build -w @quotapulse/web`: exit 0; existing Vite chunk-over-500KB warning remains.
- Synthetic in-memory Chrome gate: 28 stages; exact native duration/identity/lifecycle checks passed; zero browser errors, forbidden requests, and visual sampling gaps in this run.
- At 1672×941 on Providers: Quick Stats starts at y=442px with More closed; the open menu ends at y=547px and Quick Stats starts at y=562px. The sibling Cost Analysis route is visible.
- [Open menu screenshot](evidence/providers-more-open-synthetic.png) uses only the synthetic gate database.
- Compiled production index SHA256: `291e60476fa8a44e0052b2123701f6b6d6113aa5e83b694499d355dacc761f3b`.

A complete frame sample on this one run does not clear the earlier intermittent Models sampling gaps or establish a general smoothness/performance pass.

## Still open

The full reference comparison, remaining blueprint work, broad locale/viewport/state checks, native/package performance and rollback proof, and human visual approval remain outstanding. See [remaining work](../redesign-v1.85.95/NEXT-REQUIRED-WORK.md).
