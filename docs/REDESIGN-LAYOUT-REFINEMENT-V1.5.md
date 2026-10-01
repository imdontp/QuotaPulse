# Overview, Providers and Models layout checkpoint — 1.5.0

Branch: `design/redesign-foundation`. Tag: `redesign-layout-refinement-v1.5.0`.
Follows [Runtime 1.4](REDESIGN-REFINEMENT-RUNTIME-V1.4.md).
This is a validated implementation checkpoint; release visual approval is pending.

## Changes

- Overview has a more compact desktop Pulse Core, runway/insight spacing and
  activity cards. The redundant visible Usage details heading becomes an
  accessible hidden heading while all three coverage metrics and their caveat
  remain visible. Preview keeps its existing heading and layout.
- Providers uses four desktop owner cards per row, matching the concept's grid
  structure. A selected window's metadata uses two field pairs per row when it
  is the only window; multiple windows retain the narrower field layout. The
  comparison and reader-health regions are visible in the concept viewport.
- Models puts provider distribution directly below the comparison table in the
  primary column. The narrower detail rail uses compact summary stats and a
  donut beside its component legend; trend, effort and context sections remain.
  Tables, routes, scoped filtering and selection actions retain their behavior.
- The visually hidden utility moved from Projects CSS to the shared shell CSS.
  Opening Models directly now hides its accessible search label correctly,
  preventing a duplicate label beside the input placeholder.
- Providers previously used a past-observation date guard for reset timestamps,
  causing valid future resets to appear as Unknown. Reset dates and their card
  tooltips now allow future times. Observation/confirmation dates retain their
  future-time guard; null/non-finite times remain Unknown. The browser test checks
  that the fixture's published future reset is displayed.

No data rows, provider accounts, quotas, chart values or lifecycle states were
invented to fill the concept. No schema, daemon, tray or dependency changes.

## Regional checks and inspected captures

The eight-screen capture loop now records additional named regions and verifies
these three pages after the full functional flow, rather than only immediately
after seeding. The first attempt failed for Overview activity; compacting its
cards corrected the layout, and the original gate passed without relaxation.

| Region | Viewport | Recorded bottom |
| --- | --- | --- |
| Overview first activity record | 1586 × 992 | 987.97 px |
| Providers comparison/health region | 1672 × 941 | 816.69 px |
| Models provider distribution | 1672 × 941 | 660.19 px |
| Models complete detail rail | 1672 × 941 | 933.47 px |

See [Overview](redesign-v1.5/overview-concept-size.png),
[Providers](redesign-v1.5/providers-concept-size.png),
[Models](redesign-v1.5/models-concept-size.png), and
[capture geometry](redesign-v1.5/review-candidates.json). All three captures were
inspected after the passing browser run. These are fixture-specific regional
checks, not a promise that arbitrary data, expanded histories or long labels fit
one viewport. Overview's final caveat and main padding still extend below the
viewport; the activity records fit. Models' bottom main padding also extends
slightly below the viewport. Vertical scrolling remains available.

## Validation and next work

Web unit tests **122/122**, the complete functional History/browser script with
**144 matrix cases**, production web build, and preview visual checks with
**21 captures** passed. The existing approximately 556 KB legacy App build warning
remains. The matrix covers nine pages, English/Thai, dark/light and widths
390/900/1280/1440; it retains navigation, overflow, focus and one-stream checks.
`npm run test:runtime` also passed against the latest production build: nine
routes, 5,000 synthetic records, reconciled authenticated summaries and no
external or write requests while opening pages. See
[production evidence](redesign-v1.5/production-runtime.json).

The three concept-size images remain review candidates. The browser clock is
fixed for capture, but daemon time is real. Richer fixtures, remaining screen
refinements, shared-shell typography/decorative treatment, deterministic reviewed
baselines/SSIM, complete accessibility checks and packaged tray/RC sign-off remain.
The Overview/Models captures also expose a remaining monetary presentation issue:
native cost displays $0.00 for this fixture even though its records have computed
cost only. Review the coverage-aware unknown/partial labels before RC; this
layout checkpoint does not resolve that semantic issue.
Original checkout stays at `be8e145` without changes.
