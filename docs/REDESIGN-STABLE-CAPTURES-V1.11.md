# Stable production capture checkpoint - 1.11.0

Branch: `design/redesign-foundation`. Tag: `redesign-stable-captures-v1.11.0`.
Follows [Alerts and shared shell 1.10](REDESIGN-ALERTS-SHELL-V1.10.md).
This checkpoint establishes repeatable review candidates. Visual approval and
release approval remain pending.

## Capture controls

`npm run test:stable` serves the existing production web build through the actual
daemon on loopback port 7804, with authenticated requests and an in-memory
synthetic database. It freezes both daemon and browser Date at
`2026-05-17T13:42:00.000Z`, sets Asia/Bangkok timezone, DPR 1 and reduced motion,
waits for local fonts and API requests, and captures all eight concept routes in
English/Thai and dark/light. Overview uses 1586 x 992; other routes use 1672 x 941.
Each route loads a fresh document; each language/theme set uses a new Chrome
process. Two passes produce 64 screenshots and 32 comparisons.

The fixture has 12 sessions, 36 records representing 72 weighted calls, eight named projects,
eight recorded models, four providers, two quota owners and observed samples.
It is designed to exercise occupied layouts, not to resemble live user data.
Requests outside the test origin, API writes, page errors and horizontal overflow
fail the test. No installed tray, task or live provider is used.

## Image comparison and investigation

An initial strict PNG-hash gate was not consistently repeatable. Inspection found
small differences in background/rounded-control pixels: one Cost pair differed
at three pixels by one channel level; a Projects light pair differed at 35 pixels
by at most two levels. Independent renderer processes and fresh documents improve
isolation, but do not establish the precise internal raster cause. One strict
full run passed, and a following run failed; that pass alone is not proof of a
reliable byte-identical gate.

The final gate decodes both PNGs and compares every RGBA pixel. It allows at most
two levels of channel difference in at most 0.01% of pixels. There are no masks,
blur, excluded cards/labels/charts or content replacements. SHA-256 values and
actual changed-pixel counts/channel deltas are recorded for each pair. Identical
hashes remain visible in the evidence. This small raster tolerance is a separate
repeatability check, not the blueprint's SSIM >= 0.985 visual approval gate.

The browser decoder is executed for every pair, including identical hashes.
The success manifest is removed at the start so a failed attempt cannot retain
an earlier success report. An earlier decoder failure caused by a tsx nested
function helper was fixed before the final validation.

## Evidence and limits

See [verification](redesign-v1.11/verification.json) for final measurements,
renderer/browser versions, fixture and image hashes. First-pass captures are
stored in the same directory; nonidentical repeat captures are retained as well.
Byte-identical repeats are omitted because their files have the same hash.

Final `npm run test:stable`: **passed**, with all 32 comparisons decoded. Thirty
pairs are byte-identical. Projects English dark differs at 25 pixels, with maximum
channel delta 2; Projects Thai dark differs at one pixel, with maximum delta 1.
Both remain within the recorded gate. All overflow/request/browser-error checks
pass. `git diff --check` also passes. This is a **validated capture checkpoint**,
not validation of the project's remaining release gates.

Only the capture harness, package command and evidence/documentation change here.
Production app code remains the validated 1.10 checkpoint. The prior build,
unit, functional, production runtime and isolated desktop results are documented
in 1.10; these suites were not repeated for this harness-only change.

These are review candidates, not approved regression baselines. Settings has no
supplied concept and remains covered by the nine-route runtime checks. Final
concept typography/decoration, reviewed baseline/SSIM, contrast and screen-reader
review, and packaged tray/installer release gates remain open. Images on another
browser/OS/font version can differ; the recorded rendering configuration matters.
