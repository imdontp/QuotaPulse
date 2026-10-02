# Shared modal and landmark access checkpoint - 1.17.0

Branch: `design/redesign-foundation`.
Tag: `redesign-modal-access-v1.17.0`.
Follows [Runtime Map access 1.16](REDESIGN-RUNTIME-DATA-ACCESS-V1.16.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

The shared Go to command palette now uses a native modal dialog. Its top layer
excludes background content from the browser accessibility tree and makes it
inert to programmatic focus. Existing search, arrows/Enter, click selection,
Ctrl/Cmd+K and dismissal behavior remain. The trigger exposes its dialog target
and expanded state. The searchbox has a translated accessible name and associated
keyboard help; a polite status exposes the highlighted destination or no result.

The dialog keeps explicit Tab/Shift+Tab wrapping: a targeted reproduction found
native Shift+Tab from the first input moving focus to body in this browser.
The original edge wrapping therefore remains alongside native isolation.
Outside dismissal prevents the mousedown default focus action before closing,
so the trigger retains focus. Escape, close-button selection and destination
selection close the native dialog before restoring focus. Search/index reset
with the opening event, preventing the previous query from briefly appearing
when reopening. Queued close events cannot clear a reopened dialog's state.

The redesign's sidebar is labeled Main navigation rather than Overview on every
route, and main landmarks have the destination's translated name. The existing
skip link still focuses the main content. Live's session dialog now takes its
accessible name from its translated heading and protects a newly opened session
from a stale close event, using the same guard validated for Overview in 1.16.

This changes no query, API, schema, preferences, usage data or dependencies.
The shared palette is also used by the legacy UI, so its regression suite is
included in validation. Installed application, tray and tasks remain untouched.

## Validation

Production web build passes; the existing legacy App chunk warning remains.
A focused production-browser run passes 36 modal/landmark cases: nine routes,
English/Thai, dark/light. Each checks:

- Named sidebar/main, skip-link focus and named searchbox.
- Real `:modal` state, trigger expanded state, initial focus, Tab/Shift+Tab wrap.
- Programmatic background focus rejection and Chrome accessibility tree showing
  dialog/searchbox while excluding background main/navigation landmarks.
- Arrow selection's status text, no-result Enter remaining open, Escape returning
  focus, shortcut reopening with empty search and outside dismissal returning focus.
- The actual pre-open hash/query scope remains unchanged on dismissal.

Four Overview cases check opened palette geometry and no horizontal overflow at
390/900/1280 px, with mobile review captures. Twelve Live detail interactions
open alternating sessions, verify selected identity and heading, then Escape and
return focus. These are browser accessibility-tree and keyboard checks, not a
claim that a human has tested a screen reader's announcements.

The complete `npm run test:stable` production gate passes 32 screenshot pairs:
30 byte-identical; Projects English/dark differs at one pixel by one channel level,
and English/light at 30 pixels by at most two levels, both within the unchanged
tolerance. All prior chart/API/table, Runtime Map, contrast, overflow and request
guards pass alongside the 36 modal cases. Every pixel is compared without masks.

`npm run test:ui` passes legacy navigation/filter/price states, headings, localized
dates, table semantics, 16 Live/Limits language/theme/viewport combinations,
popup/hidden-subscription preference, empty/unavailable/recovery and browser-error
guards. Its mobile-drawer assertion now names the drawer instead of selecting
all native dialogs, since the closed command palette is also a native dialog.

`npm run test:history` passes the complete functional suite and 144 responsive
page cases after all final code changes. This includes command palette click
selection to Settings and keyboard selection to Providers, existing exact scope,
pagination, pause, quota, drill-down, occupied layout and monetary fixtures.
Browser, Vite, daemon and in-memory DB close successfully.

Status: **Validated checkpoint**. `git diff --check` passes. Full human
accessibility and visual approval remain pending.

## Evidence and remaining work

See [production verification](redesign-v1.17/verification.json),
[functional verification](redesign-v1.17/functional-verification.json),
[responsive matrix](redesign-v1.17/responsive-matrix.json),
[concept regions](redesign-v1.17/review-candidates.json) and
[validation summary](redesign-v1.17/validation.json), alongside four mobile palette
captures in `redesign-v1.17`.
These are synthetic review candidates, not approved visual baselines or concept
SSIM results. Manual screen-reader checks, full typography/decoration and font
portability, reviewed concept baselines/SSIM and packaged tray/installer release
checks remain. Unit and desktop/installer suites are not repeated for this scope.
