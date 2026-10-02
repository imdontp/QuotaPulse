# Runtime Map data access checkpoint - 1.16.0

Branch: `design/redesign-foundation`.
Tag: `redesign-runtime-data-access-v1.16.0`.
Follows [Overview quota history access 1.15](REDESIGN-OVERVIEW-QUOTA-ACCESS-V1.15.md).
Overall visual/accessibility/release approval remains pending.

## Implementation

Runtime Map now offers a native disclosure with complete node and relationship
tables from the existing scoped runtime-map response. The visual map retains its
eight-node-per-column view. Opening the disclosure mounts all returned rows;
closing removes them. The closed summary shares the heading row on desktop.
Tables have captions, column scope headers and localized exact integer values.

Node rows identify dimension and name, recorded tokens, record counts and distinct
sessions. Relationship rows identify both adjacent dimensions, both names and
recorded tokens. Null identities receive their existing Unassigned/Unknown labels;
empty strings receive a distinct Empty name label. A note explains that the same
usage appears in each adjacent dimension pair, so summing those pairs duplicates
usage. These relationships do not establish execution order or call counts.

Every node name is a button opening the existing metadata detail dialog, including
nodes outside the visual eight. Empty names now have a nonempty dialog heading.
Rapid keyboard close/reopen testing reproduced a queued native close event arriving
after the next dialog had opened and clearing its selection. The close handler
now clears selection only while the dialog is closed. Focus still returns to
the triggering button after Escape.

No query scope, daemon API/schema, dependency, provider reading, installed tray
or scheduled task is changed. All test database changes are owned synthetic rows
in memory, deleted in a finally block with the original 38-record count checked.

## Validation

- Production web build passes. The existing legacy App chunk warning remains.
- `npm run test:stable` passes all 32 screenshot pairs, all byte-identical, with
  every pixel compared and no masks or changed raster thresholds.
- Four Runtime Map cases cover English/Thai and dark/light. Each uses a real
  authenticated runtime-map response with temporary synthetic additions, yielding
  47 nodes and 45 relationships, with more than eight projects/models and both
  null and empty identities. Every row identity, token weight, record/session
  count and displayed numeric value is checked against the API. Each adjacent
  pair's token total independently equals the scoped total.
- Twenty detail interactions cover a hidden model plus null/empty project and
  model identities. Enter opens details; headings and token/session/call/aggregate
  facts match the selected API node; Escape closes and returns focus. Consecutive
  interactions retain coverage for the reproduced delayed-close failure.
- Enter opens/closes the data disclosure and closing removes both tables.
  Expanded pages have no horizontal overflow at 390/900/1280 px.
- Existing Live/Projects, Models/Cost and Overview/Alerts chart checks pass, along
  with semantic text contrast, browser-error and external/API-write request guards.

The first full capture attempt failed at the same Models heading/search SVG
regions seen in 1.14: 63 changed pixels, maximum channel delta 13, bounded by
x=255..262 and y=82..179. The existing geometricPrecision hint alone did not
prevent recurrence. Adding translateZ(0) only to those two icons passes four
Models-only pairs byte-identically, followed by the complete 32-pair gate.
Chrome's internal raster/cache cause is not established. The failed pair and
targeted results are retained in [raster investigation](redesign-v1.16/raster-investigation.json)
and [failed attempt](redesign-v1.16/failed-raster-attempt/models-en-dark.png).

`npm run test:history` passes the complete functional suite and 144 responsive
page cases, including existing scope/navigation, quota, monetary, pagination,
occupied layout and concept viewport gates. This run follows all final code
changes. Browser, Vite, daemon and in-memory DB close successfully.

Status: **Validated checkpoint**. `git diff --check` passes.

## Evidence and remaining work

See [production verification](redesign-v1.16/verification.json),
[functional verification](redesign-v1.16/functional-verification.json),
[responsive matrix](redesign-v1.16/responsive-matrix.json),
[concept regions](redesign-v1.16/review-candidates.json) and eight focused
collapsed/expanded candidates in `redesign-v1.16`. Expanded screenshots are full
pages with the temporary many-node fixture; their taller hero is existing
all-model behavior. Default captures use the unchanged 12-session fixture.
These images are synthetic review candidates, not approved baselines or concept
SSIM results.

Manual screen-reader checks, full typography/decoration, approved visual baselines,
concept SSIM and packaged tray/installer release checks remain. Unit, desktop and
installer suites are not repeated for this frontend checkpoint. The original
checkout and installed application remain unchanged.
