# Overview recorded minute activity v1.57

Continues the real-data reference redesign after v1.56. The source activity
strip contains compact graphs. Production activity cards now render genuine
minute buckets from the existing daemon trend API.

## Changes

- Each of the four actual recent records requests call facts for its exact
  source, harness, provider and model. Source ID isolates the real profile;
  similarly named harnesses/profiles are not merged by a display-name match.
- The query covers the final at most thirty minutes of the selected period,
  bounded by the daemon clock. Custom past intervals retain their own end;
  future-only intervals and unknown provider/model identities are not queried.
- Equal route queries share one request per refresh, with at most four requests.
  Existing refresh coalescing and the route-key guard still apply.
- Graphs retain exact recorded token totals, zero buckets and partial first/
  last minutes. Straight segments connect actual buckets; no curve or live
  rate is invented from the four records. Aggregate/unknown records are not
  distributed into minute buckets.
- A visible desktop caption states call tokens/min and the bounded interval.
  Graph accessible names/tooltips include source, route, exact range and the
  partial-minute caveat. Caption is hidden on narrow screens; graph accessible
  names/tooltips remain. Empty series render an explicit no-minute-data message.
- A failed trend request renders an unavailable message and retains the real
  record/quota snapshot. Unknown identities render no chart. The main figure
  remains Recorded tokens for that individual record, rather than a minute rate.
- Existing record metadata and keyboard History destinations remain intact.
  The graph uses the existing ObservedTrend SVG component and theme colors.

## Validation

TypeScript/Vite production build passed with the existing large-chunk warning.
All **126 web tests** passed: [output](redesign-v1.57/web-tests.txt). New cases
exercise exact source/model/provider filters, thirty-minute bounds, custom/past/
future scope, missing identities, partial boundaries, zero gaps and observed
values without interpolation.

The full Overview production-browser run passed all four English/Thai and
dark/light functional sets and repeated captures. All four pairs are byte
identical; no masks or tolerance changes. Activity bottom is 989.922px within
the original 992px viewport; Runtime Map endpoint error remains 0.007508px.
The activity check queries the daemon independently for each actual route and
compares every rendered minute point with the returned buckets. Empty and
unknown series contain no fabricated points. Existing period/source/custom,
quota, core, forecast, insight, history, keyboard and responsive gates pass.
No external/write requests or browser errors were recorded. Readers are off
and the database is synthetic in memory.

[Browser manifest](redesign-v1.57/verification.json) and
[reference viewer](redesign-v1.57/reference-review.html), retaining v1.56 and
the unchanged Overview source image from v1.44. Repeatability does not establish
99–100% source likeness; visual acceptance remains open. This run covers
Overview. Full nine-page browser evidence remains v1.52; extracted runtime,
installer and manual release acceptance were not rerun. Trend request failure
handling was code-reviewed, not fault-injected in this browser run.

## Checkpoint and remaining work

Isolated branch `design/redesign-foundation`, existing QuotaPulse origin;
version tag `redesign-activity-minute-v1.57.0`. Original checkout is preserved.
Remaining source fidelity work includes Runtime Map column/card proportions,
hero decoration/motion and detailed composition of the other dashboard pages.
The four cards are genuine recent records and can repeat a harness, whereas
the source uses four distinct harnesses. No fake harnesses or rates are added.

Bundle/archive manifests are retained in `redesign-v1.57`. The unsigned review
bundle retains 87 existing runtime packages, Node22 ABI127, NoReaders and
disabled account probes. It requires an installed matching Node runtime and
does not contain a live application profile.

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.57-lsDrqt.zip`; 201560027 bytes, 3133 files.
SHA256: `e472bf0cee4c979c28a96fcf7feb607c3e2e67b48428837fa8bce2111d2c87e0`.
Every entry was decompressed and SHA256-compared with the bundle source.
The four document captures and bundled production index match the final browser manifest.
