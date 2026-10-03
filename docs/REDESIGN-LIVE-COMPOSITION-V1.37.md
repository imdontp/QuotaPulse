# Live composition repair v1.37

## Scope

Continue the production-data dashboard requirement using the supplied
`quotapulse_build_blueprint/refs/live.png`. The reference's desktop sessions,
chart and activity feed fit together in 1672 × 941. The v1.36 app's session
table pushed its feed below this viewport. This checkpoint repairs that
allocation and advances the observed-activity rail. The 99–100% fidelity
target remains open; browser repeatability is not a reference similarity score.

- Desktop session table has a 194px scroll area, compact rows and sticky
  headers. All ten loaded rows and existing pagination remain available.
- The metric explanation is retained below the session pagination, bringing
  the session panel directly under the summary.
- The feed has a 76px scroll area. All eight loaded records and existing
  pagination remain available. Both regions have translated accessible names
  and keyboard focus. Narrow layouts retain their unbounded stacked content.
- Advisory rows have individual bordered cards and a restrained warning tint.
  Advisory and provider/model headings have relevant icons.
- Provider/model rows use existing offline provider marks and proportional
  token-share bars from the current thirty-minute API response. These bars
  are aggregate recorded shares; they do not represent service health, latency,
  or an invented minute-by-minute heatmap.
  Warning color is restricted to advisory icons so it does not recolor provider
  marks in the adjacent matrix.

No API, reader, dependency, native tray or pet behavior is changed. Work remains
in the isolated `design/redesign-foundation` worktree with the existing origin.

## Validation

The Live capture scope uses the existing production browser fixture, frozen
daemon/browser clocks, independent browser instances and unchanged unmasked
raster tolerance. It also checks occupied feed bounds, all loaded rows,
keyboard End scrolling in both regions, last-session detail data, Escape/focus
restoration, and matrix token totals/shares against independently queried API
data. Existing complete chart tables, tiny/zero points, responsive overflow,
shell and font gates remain.

The first added keyboard assertion read geometry as soon as scrolling began.
Native keyboard scrolling had not finished. The assertion now waits for the
actual scroll end before checking the last record's position. The intermediate
run is not counted as passing evidence. The subsequent initial layout run
passed four byte-identical pairs before the final row-density/rail refinements.
The final build passed TypeScript and Vite; the existing >500KB chunk warning
remains. The final command was
`QUOTAPULSE_CAPTURE_SCOPE=live node --import tsx scripts/check-stable-captures.mts`.
All four pairs (English/Thai, dark/light) were byte-identical, without masks or
tolerance changes. Feed/pagination bottom is 932.078125px in all four 941px-high
captures. Ten loaded sessions, eight loaded feed records, keyboard scrolling,
last-session detail/focus restoration and API-matched matrix shares passed.
See [verification](redesign-v1.37/verification.json) and the captured
[English dark view](redesign-v1.37/live-en-dark.png) and
[Thai light view](redesign-v1.37/live-th-light.png).

The final app index and copied review-bundle index share SHA256
`f7cc07068974b7fba8a56ef8b371e56468f5d49e2c4e0c7829b6e295703729d9`.
No dependencies were installed or native modules rebuilt. This is scoped Live
evidence; the complete eight-page capture suite was not rerun in this checkpoint.
The preceding combined/focused evidence is retained in v1.36.

## Review artifact

`tmp/review-bundles/QuotaPulse-v1.37-WZrLtw.zip` is the final unsigned Windows
x64 review bundle, requiring external Node module ABI 127. It contains 87
installed runtime packages and no app profile. Readers are disabled. All
3,128 ZIP entries were decompressed and SHA256-compared with their bundle
source. ZIP size: 199,846,443 bytes.

SHA256: `40b96080fd2cdb04bd1c7d844b7aefde626654199693eefe1ebf1686f6434ec6`.
See [bundle inventory](redesign-v1.37/bundle-build.json) and
[archive verification](redesign-v1.37/archive-verification.json).
Extract to a new dedicated folder and run `scripts/start-review.ps1`.
Use `scripts/stop-review.ps1` to stop that review instance. New review profiles
are empty; the screenshot fixture is a separate synthetic memory database.

Checkpoint tag: `redesign-live-composition-v1.37.0`.
The original checkout remains clean at
`be8e145039247958992fa7673a9c77e1bff35db1`. Scoped process inspection found no
remaining build/capture processes. Earlier review ZIPs are preserved.

## Remaining work

Live's final typography, source-advisory density and richer recorded-activity
presentation still need reference review. Reference status/latency/runtime
labels require corresponding measured data before they can be displayed.
Overview/Models and the other five pages retain the gaps in the
[reference repair register](REDESIGN-REFERENCE-REPAIR.md).
Manual visual acceptance, screen-reader review, full release regression and
extracted installer/runtime checks are outside this scoped validation.
