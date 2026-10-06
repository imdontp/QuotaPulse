# Cost route compatibility v1.85.23

Blueprint v1.1 requires existing bare `#cost` bookmarks to retain All time.
The redesigned shell now links to `#cost?range=month` from both the sidebar and
command palette, and the Cost route parser falls back to All time. Explicit
custom scopes, monetary basis and bucket choices remain parsed independently.
Canonical design captures also specify month; their selected period is visible.

## Validation

- `npm run build -w @quotapulse/web`: pass.
- `npm run test -w @quotapulse/web`: 152 pass, zero failures after Cost repair,
  before the subsequent Live CSS/list accessibility change.
- `QUOTAPULSE_CAPTURE_SCOPE=cost npm run test:stable`: four language/theme
  repeat pairs, all byte-identical; actual API values, chart access and responsive
  overflow checks pass. See `cost-capture-verification.json`.
- `QUOTAPULSE_CAPTURE_SCOPE=live npm run test:stable`: four language/theme
  repeat pairs, all byte-identical on the Live repair production build. Complete
  minute/grain checks, refresh races, token-flow states and overflow pass.
- The three actual HTTP route/navigation checks pass: bare Cost requests from0;
  sidebar and command palette request from local calendar month start. See
  `cost-route-compatibility.json`.
- All 16 responsive combinations across nine pages and pricing semantics pass.
- Authoritative `npm run test:history` run68375 exits1 at occupied Cost layout,
  after the compatibility checks and all four occupied Live and Projects suites
  pass. No full workflow success manifest exists. This checkpoint is validated
  for those bounded repairs; overall workflow/visual acceptance remains open.

## Source likeness still open

This compatibility repair does not close visual acceptance. Next supported
Cost work is the common heading/card frame, card top/height, donut size and
trend/table proportions measured in the v1.85.22 source audit. Values and graphs
must continue to use actual application data.

## Occupied Live regression

The broad workflow reached a genuine failure with 13 recent sessions, twelve
matrix pairs and eight feed rows: the unconstrained matrix list expanded the
right rail to bottom 1040.453125px in the 941px viewport. The feed still fit.
The desktop matrix list now has a 360px scrolling region, a localized accessible
name and keyboard focus. All pairs and their minute data remain available.
The original occupied rail bound passes in all four language/theme cases,
including keyboard End/Home, visible focus and all twelve identities. English
rail bottom is821.453125px and Thai804.953125px. The219px English reduction
matches matrix content579px minus visible360px, supporting the causal fix.

## Projects gate alignment

The next full run stopped at a legacy expectation that six complete cards fit
the desktop viewport. Direct inspection of `refs/projects.png` shows four full
cards; the third row starts around y739 and is cut at the941px image boundary.
The source-sized258px card rhythm intentionally uses the bounded scrolling
container. The gate now must verify four full cards, container/rail bounds and
keyboard access to the final eighth card with identities retained. The container
has a localized accessible name, keyboard focus and a visible focus outline.
This replaces an incompatible visibility assumption; it does not authorize
truncating or removing cards.

The corrected gate passes all four cases: cards container bottom926px and
rail bottom902.5625px, with all eight identities retained and final-card
End/Home access. The first rerun exposed native keyboard scroll animation:
waiting merely for positive scrollTop was premature. Waiting for actual final
card bounds fixed the test timing without changing its visibility assertion.

## Remaining Cost layout gate

The occupied custom/source Cost route renders summary at y314.796875 and provider
panel at y72. Existing CSS explicitly pins provider to rows1/3 while ScopeNotice
is an intervening direct grid child before summary. The preserved gate demands
equal summary/provider y, which also contradicts the source: provider begins at
y72 but the cards begin near y131 within a shared overview frame. The app still
lacks that shared frame, and the scope notice displaces summary excessively.

The next repair must implement the source frame and place the scope notice
coherently, then check equality of outer frames and the inner card positions,
complete data/keyboard access and occupied viewport bounds. Do not erase this
failure or label the broad workflow passing in this checkpoint. See the bounded
native repair in `COST-REFERENCE-NEXT-REPAIR.md`.
