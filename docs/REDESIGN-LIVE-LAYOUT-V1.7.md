# Live layout checkpoint — 1.7.0

Branch: `design/redesign-foundation`. Tag: `redesign-live-layout-v1.7.0`.
Follows [Monetary coverage 1.6](REDESIGN-COST-COVERAGE-V1.6.md).
Status: **Validated checkpoint**. Overall visual/release approval remains pending.

## Changes and scope

Live's desktop layout now has compact summary cards, smaller panel gaps, and a
session toolbar with search beside the heading and recent/all controls. Source
names appear beside session identifiers on desktop, and record-grain labels sit
beside feed metadata. Narrow layouts retain wrapping and stacked controls.
The main/rail column ratio is 2.6:1 with a 320 px minimum rail.

The existing chart's included-call count moves into its heading row. Its desktop
plot is 96 px tall; call-only data, empty buckets and aggregate/unknown exclusions
are preserved. The observed provider/model rail has more compact rows and text
spacing. No sessions, feed records or metadata are hidden to fit the viewport;
existing 10-session and 8-record pagination stays intact.

Changes are confined to `live.tsx`, `live.css`, the existing browser harness and
checkpoint evidence/documentation. No daemon, schema, dependency or tray changes.
Original checkout remains clean at `be8e145`; work stays in its separate worktree.

## Occupied fixture and geometry

The browser harness adds 12 synthetic sessions only after its original functional
flow, screenshots, responsive matrix and monetary scenarios. This gives 13 recent
sessions, 14 observed sessions, a full 10-row session page, an 8-row feed and a
12-row observed provider/model rail. It uses a fresh source timestamp at this
stage so earlier test duration does not age the fixture out of the recent window.
Extra records and changed source timestamps are restored afterwards.

| Region, at 1672 × 941 | Bottom in all four language/theme cases |
| --- | --- |
| First usage feed record | 930.58 px |
| Complete observed-activity/advisory rail | 901.36 px |

The original sparse fixture's first feed record also passes the new concept-size
gate. The complete feed continues below the viewport in the occupied fixture;
this gate verifies the first record and rail, not that every record fits one screen.
Long Thai session/project names remain readable on mobile and increase page
height. No fixed-height clipping or ellipsis was introduced.

See [occupied geometry](redesign-v1.7/live-occupied-layout.json),
[English dark](redesign-v1.7/live-occupied-en-dark.png),
[Thai light](redesign-v1.7/live-occupied-th-light.png), and
[long Thai mobile metadata](redesign-v1.7/live-occupied-th-light-390-long.png).
Captures were visually inspected against the original Live concept and factual
blueprint overrides. They remain review candidates, not approved pixel baselines.

## Validation

- Web unit tests: **124/124** passed.
- Production web build: passed; existing 555.60 KB legacy App chunk warning remains.
- Complete `test:history`: passed, including **144** responsive cases, existing
  pause/filter/drill-down/navigation/focus/SSE and other-page regional gates,
  the four monetary cases, and the occupied Live checks.
- Occupied Live: English/Thai × dark/light geometry, 10 → 3 → 10 session
  pagination, overflow at 390/900/1280, long Thai metadata, Escape focus restore,
  and empty filtered sessions/feed passed. A first run stopped at the empty-state
  assertion because its Thai test literal differed from the existing dictionary;
  correcting that literal allowed the unchanged behavior check to pass.
- `test:runtime`: all nine production routes passed with **5,000** synthetic
  records, authenticated summaries and no external/write requests or browser errors.
- `git diff --check`: passed.

See [validation and artifact hashes](redesign-v1.7/validation.json) and
[runtime evidence](redesign-v1.7/production-runtime.json). Preview, daemon and tray
tests were not rerun in this checkpoint; those surfaces were not modified.

## Remaining work

Continue Projects ranking/detail placement, Cost grid and Alerts chart/density
refinements in the [visual queue](REDESIGN-VISUAL-REVIEW.md). Shared-shell styling,
richer fixtures on other pages, chart axes/value accessibility, deterministic
daemon/browser clocks, reviewed baseline/SSIM, full accessibility/contrast review
and packaged tray/RC sign-off remain. Live's sparse chart still uses actual
recorded calls rather than invented streaming curves. This checkpoint does not
claim complete concept parity or release readiness.
