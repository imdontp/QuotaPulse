# Cost reference repair v1.40

Continue the complete production-data dashboard fidelity goal. Direct inspection
of `refs/cost.png` showed that the provider donut starts beside the Cost header,
summary cards have colored icons/trends, and tokens form a connected line over
the monetary bars. The previous app positioned the donut below the header and
used disconnected token marks.

## Implementation

- Cost header, summary and coverage occupy the left four of six desktop columns;
  the provider distribution starts at the same top edge in the right two.
  Main padding is 12px. Native/API basis and scope controls remain functional.
- Summary cards gain relevant colored icon tiles. The known-total card has a
  sparkline from actual monetary buckets, converted into the selected currency.
  Unpriced scopes do not display a fabricated monetary sparkline. Unsupported
  projections remain Unknown with the existing explanation.
- The provider donut is 170px with a restrained dark glow and a 120px center.
  Provider legend and model-route cells use actual recorded-provider marks.
  Narrow desktop legends stack amounts to preserve readable identities.
- Priced tokens now form a straight SVG line, centered on each monetary bucket.
  Its y coordinate uses the independent token axis from zero to its maximum;
  monetary bars continue using the independent amount axis. Zero buckets remain
  zero. Complete native chart tables and coverage/pricing distinctions remain.
- The shared renderer gains optional area/grid/axis-edge/bucket-center controls.
  Existing callers retain their defaults. The full dashboard capture run is used
  to verify the shared behavior after the change.

The browser gate independently queries the Cost API and checks both axes, amount
bar heights, token timestamps/values, y coordinates and bucket centers. It also
checks native/API/unpriced scopes, complete tables and responsive overflow. The
initial scoped run passed all four functional sets before the summary sparkline
was added; final evidence is recorded from the subsequent complete run.

No daemon API, dependency, account reader, tray or pet behavior changes. The work
remains in `design/redesign-foundation` with the existing QuotaPulse origin.

## Remaining acceptance

Cost still needs closer plot proportions, table share/identity decoration,
additional supported summary trends and insight-card treatment. Typography and
other per-page gaps remain in [reference repair](REDESIGN-REFERENCE-REPAIR.md).
The complete 99–100% visual target, original-reference similarity measurement,
named reviewed baseline, manual screen-reader review and broader release gates
remain open. Repeat captures do not measure similarity to the source concept.

## Validation and review artifact

- Web TypeScript/Vite production build passed. The existing large-chunk warning
  remains; no dependencies were installed or native modules rebuilt.
- `node --import tsx scripts/check-stable-captures.mts` passed the complete eight
  pages in English/Thai and dark/light, including selected History: 36 repeated
  pairs, all byte-identical, without masks. Cost API/native/unpriced checks,
  independent axes, token bucket coordinates, complete data tables, keyboard
  access and responsive overflow checks passed using an in-memory database.
- [Reference viewer](redesign-v1.40/reference-review.html) contains all eight
  original concepts and production captures from this build. All eight source
  SHA256 values were checked against the user's current refs. Captures remain
  review candidates; the viewer does not calculate source similarity.
- The ZIP's production index hash matches the browser-tested build:
  `fbba9e7d098ea6d08972352c7911db3e00dc2a47f7b147a9689a7f85167a4a5b`.
- Review archive: `tmp/review-bundles/QuotaPulse-v1.40-Z447sT.zip`,
  199850813 bytes, 3132 files. Every entry was decompressed and SHA256-compared
  with the bundle source; no app profile is included.
  SHA256: `e279ea784192b13b68825867c2a426306e5518e946db4282b021216ecf7ceedc`.
- Extract to a dedicated review folder and run `./scripts/start-review.ps1`;
  stop with `./scripts/stop-review.ps1`. Requires Windows x64 and existing Node
  ABI 127 (built with Node 22.13.1). Readers are off, so a fresh profile has empty
  usage. This is an unsigned review bundle, not the production release.
- Version tag: `redesign-cost-reference-v1.40.0` on the isolated redesign branch.

Evidence: [browser verification](redesign-v1.40/verification.json),
[bundle build](redesign-v1.40/bundle-build.json),
[archive verification](redesign-v1.40/archive-verification.json).
