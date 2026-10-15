# Code review — checkpoint79

## Verdict

Approve the bounded seven-route API pending/error implementation after the recorded corrections and runtime checks. Whole-concept and release approval remain unproven.

## Scope and independent work

- loading77_audit implemented Models/Providers and independently reviewed Live/Projects/Alerts plus final Cost/History and shared state paths.
- pending79_route_audit implemented Live/Projects/Alerts and independently reviewed Models/Providers and InitialRegion.
- refs77_priority implemented Cost/History and independently inspected final runtime evidence and visual composition.
- Root implemented InitialRegion, permanent executable browser fixture, integration and native validation, final corrections, documentation and staged provenance verification.

## Material findings resolved

- Fixed custom-detail failures needed their own retry generation; a main refresh with unchanged keys does not re-run a useEffect.
- Live filters/search had to stay in the same rendered DOM branch, not duplicated conditional copies.
- Projects local sort/tab updates must not clear an API error without starting a query.
- A Live no-op update must not invalidate the active request or erase its error.
- Localized status and actual Retry must be mounted at the destination when moved out of metric cards.
- Retry geometry must be reserved before failure; the final executable matrix measures zero loading/error region movement.

## Correctness and safety

Successful loaded markup, values, selected facts, query scope and formatting stay on their existing paths. New placeholders are named and expose real loading/error/paused semantics; their neutral rows are hidden from accessibility. Query-only retries preserve main focus before removing a button and keep API failure keys/epochs aligned. No credentials, prompt contents, outward network, dependency additions, schema changes or live writes are introduced. The isolated browser fixture asserts no non-GET/external requests. InitialRegion has no timer/animation. Existing refresh/pause and unmount behavior is retained except the documented guards and no-op fix.

## Validation limits

The current build,509 unit tests,36 browser lifecycle cases, all-eight native preservation and responsive checks support this scope. They do not certify every race, complete lazy-module fallback geometry, actual Electron/package behavior, all performance budgets or original-reference likeness. Pending/error stability is not evidence that every loaded region keeps identical height with arbitrary real data. History's retained selected-row scope behavior and broad existing background error details remain outside this change. See VALIDATION-STATE.md and the raw manifests.

Final independent runtime review by refs77_priority confirmed36 records, exactly0px loading/error deltas in all28 main cases, accepted-data retention and empty page-error/forbidden-request lists. The reviewer inspected actual native Live error, narrow Cost/History error and native History loading images. Scope caveats remain: paired configurations, EN-only detail/pause checks and no general identity/race certification. No browser/build or mutation was performed by that review.
