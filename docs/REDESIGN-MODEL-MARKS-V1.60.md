# Overview model makers and full-page validation v1.60

## Objective and scope

Continue the reference redesign with actual application data. This step replaces
generic model boxes in the Overview model rail and Runtime Map when a model name
identifies its maker. It also refreshes the production-browser evidence for all
eight dashboard pages and Settings after the Overview changes since v1.52.

## Implementation

- Runtime Map adds optional `vendor` metadata to known model nodes, using the
  existing daemon classifier with the model name alone. A grouped model may
  traverse several providers; an unrecognized alias is not branded from its
  route. Null, empty and unidentified model keys omit this metadata.
- Overview uses the existing offline VendorIcon artwork. OpenAI, Anthropic and
  DeepSeek have appropriate icon tile colors. An em-sized wrapper preserves the
  Nous portrait's outer frame and internal proportions at 18px in the model rail
  and 15px in Runtime Map. Unknown identities and older daemon payloads retain
  the generic Box icon.
- Recorded model names, totals, shares, filtering, keyboard details and focus
  restoration retain their existing behavior. No schema, dependency, profile,
  pricing or quota changes.

Independent read-only review found the initial Nous frame sizing issue; it was
corrected before the final build and browser gate. No unresolved substantive
finding remained in the helper and fixture review.

## Validation — Validated

Daemon and TypeScript/Vite web builds passed using installed dependencies.
The existing Vite warning about chunks over 500kB remains.

- `node --import tsx --test packages/daemon/test/usage-events.test.ts`: 10 test
  nodes pass in the isolated memory database, including conflicting routes,
  null/empty/unidentified groups and scoped token/session/edge conservation.
- `npm.cmd run test -w @quotapulse/web`: all 126 tests pass in this checkpoint.
- `QUOTAPULSE_CAPTURE_SCOPE=all node --import tsx scripts/check-stable-captures.mts`:
  all four English/Thai and dark/light sets pass for nine pages, plus selected
  History details. **40 pairs / 80 screenshots; 38 byte-identical pairs**.
  Overview English/light differs in 32 pixels, maximum channel delta 2;
  selected History English/light differs in 10 pixels, maximum delta 1.
  The original maximum delta 2 / changed-pixel fraction 0.0001 remain unchanged;
  no masks. These are application repeat checks, not source-similarity scores.
- Four model-maker fixture sets exercise OpenAI, Anthropic, DeepSeek and Nous,
  four unbranded groups, SVG bounds within the em wrapper, keyboard details and
  optional metadata omission from an older daemon. Only synthetic model names
  change for this diagnostic; actual API totals and edge conservation are checked.
  The fixture and interception are restored before canonical captures.
- 52 Runtime geometry states, 12 Activity bitmap checks and four renderer state
  sets pass. Overview Activity bottom remains 989.922px in the 992px viewport.
  Existing period, quota, shell, chart, Settings, focus and narrow-screen checks
  pass. No browser errors, external requests or daemon writes were recorded.

[Browser manifest](redesign-v1.60/verification.json),
[artifact consistency](redesign-v1.60/artifact-verification.json),
[web tests](redesign-v1.60/web-tests.txt),
[memory API tests](redesign-v1.60/daemon-tests.txt) and
[nine-page reference viewer](redesign-v1.60/reference-review.html).
The viewer retains v1.52 and offers the known-model diagnostic for Overview.
All eight original references are hash-verified and unchanged.

## Review package and checkpoint

Branch `design/redesign-foundation`, existing QuotaPulse origin;
tag `redesign-model-marks-v1.60.0`. Original checkout remains separate.

Review ZIP: `tmp/review-bundles/QuotaPulse-v1.60-N5uf0j.zip`;
201563733 bytes, 3134 files.
SHA256: `7030a4a66b62385896abfb22a3aab6f5796d057a0167f34bc7f309809e7f2f41`.

The unused unsigned package retains 87 installed runtime packages, Node22
ABI127, NoReaders and disabled account probes, with no application profile.
Every ZIP entry was decompressed and SHA256-compared with its bundle source.
The archived web index and compiled daemon Runtime Map/classifier match the
build represented by the browser/API evidence. Extracted runtime/installer
acceptance was not rerun in this step.

## Remaining reference work

**99–100% visual acceptance remains open.** The full nine-page evidence now
belongs to v1.60; passing it does not certify source likeness. Source globe/pill
glow and other page compositions still need refinement. Read-only comparison
identified three concrete priorities: undimmed/narrower desktop History detail
rail, framed heading/section icons, and a Live activity matrix made from real
scoped minute buckets. Model diagnostic images are synthetic test data, not a
separate product mode or approved visual baseline. Static refs do not establish
animation equivalence.
