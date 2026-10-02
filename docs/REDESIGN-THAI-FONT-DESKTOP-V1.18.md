# Bundled Thai font and desktop checkpoint - 1.18.0

Branch: `design/redesign-foundation`.
Tag: `redesign-thai-font-desktop-v1.18.0`.
Follows [Modal access 1.17](REDESIGN-MODAL-ACCESS-V1.17.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

The web application now bundles an unmodified variable Noto Sans Thai font.
Its font-face is limited to Thai's U+0E00-0E7F range and supports weights 100-900.
Both sans and monospace stacks use it after the existing Geist faces; the
redesign uses the shared sans stack. Latin remains assigned to Geist, while
Thai no longer depends on whichever Thai font is installed on the machine.
The English language toggle also contains Thai glyphs and uses this face.

The font is served locally from the production web build. There is no remote
font-face URL or runtime font download from a third party. The uncompressed
font file adds 218,652 bytes; it is the original upstream TTF, not a new package
dependency or an installed system font. The existing font-display swap behavior
allows rendering during initial loading; verification waits for fonts to settle.

The [pinned Google Fonts source](https://github.com/google/fonts/tree/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosansthai)
is recorded beside the font with its SHA-256:
`5a1c559bb539583c8a1fd99d1c5b9491e5e14478c9cd2bd0970d5c3096cc9ef8`.
The [OFL-1.1 license](https://github.com/google/fonts/blob/8b0a1d0f5983c89bc2b93f1b5fb55f9e252744b5/ofl/notosansthai/OFL.txt),
copyright notice, upstream metadata and provenance JSON ship in the same public
directory. Production verification checks the copied font hash and exact license
bytes against the vendored source.
The upstream license has one trailing space; its exact path receives Git's
blank-at-eol whitespace exception so it remains verbatim. Code whitespace
checks retain their defaults.

## Validation

Production web build passes; the existing legacy App chunk warning remains.
The production browser gate now queries the actual rendered platform fonts using
Chrome's CSS protocol. Each of nine routes in English/Thai and dark/light checks
that its Thai label uses Noto Sans Thai with custom-font glyphs and no system
fallback. This supplements font-ready checks with evidence of actual glyph use.

The isolated desktop harness also checks the native command palette's real modal
state, Tab/Shift+Tab wrap, background focus exclusion and Escape restoration.
It switches the built dashboard to Thai, queries its actual custom font, captures
the Thai desktop and switches back. This extends the existing production popup,
compiled preload, sandbox, IPC, alias and isolated-user-data checks. Its main
process remains a fixture; it does not load the installed tray/main lifecycle.

Validation results after the final web changes:

- `npm run test:stable`: 36 actual-font cases pass; 32 screenshot pairs pass,
  31 byte-identical. Projects Thai/dark differs at one pixel by one channel level,
  within the unchanged tolerance. Every pixel is compared without masks. Existing
  modal, chart/data, quota, Runtime Map, contrast, overflow and request guards pass.
- `npm run test:history`: complete functional suite and 144 responsive page cases
  pass, including occupied panels and existing exact scopes, money, pause and
  navigation. Browser, Vite, daemon and in-memory DB close successfully.
- Tray/preload build and `npm run test:desktop` pass. Electron reports Noto Sans
  Thai as a custom font with six rendered glyphs in the selected Thai label.
  Existing production dashboard/popup, compiled sandboxed preloads, readiness/
  action IPC, legacy sessions alias and external-request gates pass.
- `npm run test:ui`: legacy dashboard/popup and 16 Live/Limits language/theme/
  viewport combinations pass, including empty/unavailable/recovery and no page
  errors. This covers shared font-stack changes in the legacy UI as well.
- `git diff --check` passes. No unit suite is repeated for this font/CSS scope.

Status: **Validated checkpoint**. See
[production verification](redesign-v1.18/verification.json),
[functional verification](redesign-v1.18/functional-verification.json),
[responsive matrix](redesign-v1.18/responsive-matrix.json),
[concept regions](redesign-v1.18/review-candidates.json),
[desktop verification](redesign-v1.18/desktop-verification.json),
[Thai desktop](redesign-v1.18/dashboard-production-thai.png) and
[validation summary](redesign-v1.18/validation.json). Eight focused Thai browser
captures and the popup capture are synthetic review candidates, not approved
visual baselines. The desktop verification success file is removed before a run,
so a failed attempt cannot leave a prior successful result in its output path.

## Remaining work

These checks prove local webfont use on this Chrome/Electron environment. They
do not certify every OS or screen reader, nor establish an approved visual
baseline. Full typography/decoration and manual screen-reader review, concept
baseline/SSIM approval, packaged tray/installer recovery and release sign-off
remain. No installed app, user usage DB, provider account or scheduled task is
accessed. The original checkout is preserved.
