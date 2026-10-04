# Framed page headings and History detail rail v1.61

## Objective and changes

Continue the real-data redesign after v1.60 with two observed reference gaps.

- Live, Projects, Models, Cost and Alerts use one shared PageHeading. Projects,
  Cost and Alerts have 46px framed tiles; Live and Models have 30px tiles with
  title/subtitle beside each other on desktop and wrapping on smaller screens.
  Models uses the source-like cube mark. Existing text, controls, queries and
  chart dimensions retain their behavior.
- The shared component retains one h1 and decorative, unfocusable SVGs.
  Its explicit framed class resets Overview's older hidden-heading rules only
  for this component; Overview's hidden heading remains unaffected.
- At widths at or above 1280px, selected History details use a 288px side rail,
  top 72px, right 8px and a transparent visual backdrop. The content reserves
  296px, leaving a 12px gap. Narrower screens retain the existing modal styling.
- Native modal focus handling, Escape, background inert behavior, record
  identity and actual API fields remain intact. A transparent backdrop does
  not make the background controls interactive.

## Validation — Validated

The TypeScript/Vite production build passes with the existing large-chunk warning.
The complete production-browser gate passes all nine pages plus selected History
details, English/Thai and dark/light: **40 pairs / 80 screenshots; 37 pairs are
byte-identical**. Remaining changes are selected History EN/light 12 pixels
(max delta 2), TH/dark 4 pixels (max 1), TH/light 3 pixels (max 1). Original
maximum channel delta 2 / changed-pixel fraction 0.0001, no masks.

Twenty heading checks confirm the specified tile sizes, single h1 and decorative
markup. All four History rail states measure x1376, y72, width288, height861
and content gap12 at 1672×941, with a transparent backdrop. Source rail x≈1374
is a visual estimate, not a whole-image equivalence measurement.

Existing 390/900/1280 History overflow, wrapping/scroll, focus trap, background
focus exclusion and Escape restoration checks pass. All previous chart, quota,
shell, Settings and data interaction checks pass. 52 Runtime geometry states
have maximum endpoint error 0px; four model-maker/legacy states, 12 Activity
bitmap checks and four renderer states pass. Overview Activity bottom remains
989.922px. No browser errors, external requests or daemon writes are recorded.
The browser database is synthetic and in memory.

The retained 126 web tests and 10 memory API test nodes were run at v1.60.
Business data helpers are unchanged in this presentation checkpoint; the logs
are retained and labelled historically, rather than represented as new runs.

[Browser manifest](redesign-v1.61/verification.json),
[artifact consistency](redesign-v1.61/artifact-verification.json),
[nine-page viewer](redesign-v1.61/reference-review.html),
[selected History](redesign-v1.61/history-selected-en-dark.png).
The viewer retains v1.60 and displays selected History for comparison with the
source rail. All eight original refs are hash-verified and unchanged.

## Package and checkpoint

Isolated branch `design/redesign-foundation`, existing QuotaPulse origin;
tag `redesign-framed-headings-v1.61.0`. Original checkout is preserved.

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.61-CEkrND.zip`;
201565201 bytes, 3136 files.
SHA256: `d839c1bb626c638bf56f103645172bbc6816d97365a9dab4616d165aba360dc3`.

Every ZIP entry was decompressed and SHA256-compared with the unused bundle.
The compiled web index and daemon runtime classifier match the documented
browser build. The unsigned review package retains 87 installed runtime
packages, Node22 ABI127, NoReaders and disabled account probes; no profile or
dependency/native rebuild. Extracted installer/runtime acceptance is not rerun.

## Remaining work

**99–100% source likeness remains open.** Heading frame hue/saturation and
section markers still need refinement; source globe/pill glow and other page
layouts remain open. The next Live step replaces aggregate share bars with
actual provider/model minute strips and explicit grain coverage. That work is
separate from this checkpoint and is not included in its ZIP or evidence.
Repeated application images establish repeatability, not source similarity;
static references do not establish motion equivalence.
