# History and browser hardening checkpoint — 1.3.0

Branch: `design/redesign-foundation`. Tag: `redesign-history-hardening-v1.3.0`.
Follows [Compatibility 1.2](REDESIGN-COMPATIBILITY-V1.2.md). This is not an
application release or deployment.

## History implementation

The redesigned History page now includes a full filtered Usage Timeline and
summary before the metadata filters and paginated table. Token totals, records,
weighted call counts and distinct sessions are labelled separately. Native cost
and computed/estimated API value stay separate; missing price coverage is visible.
Effort is a recorded category distribution, not a numerical average. Missing
input/output components are disclosed instead of being inferred from total tokens.
The graph groups records by recorded time, including aggregate updates, and does
not describe its curve as individual call timestamps.

Desktop record details use a right-side modal rail; narrow layouts retain the
native dialog. Details expose recorded duration, effort, service tier and pricing
provider. Safe metadata copy uses an explicit field allowlist. Related session
links retain the displayed time/source/metadata filters. Escape restores the
record button's focus. The prior History page remains available in legacy mode
without adding a summary request to its existing read flow.

`GET /api/history-summary` is an additive authenticated read. It requires `from`
and `to`, accepts the same source/session/project/harness/provider/vendor/model/
metadata-search/grain filters as records and export, and rejects pagination or
unknown query fields. It returns `scope`, `now`, aggregate `totals`, `timeline`,
categorical `effort` and `bucketMs`. The shared parameterized predicates preserve
literal searches and null-project semantics. Three aggregate queries run in one
read transaction, with at most 120 rendered time buckets. The summary is for the
whole range, not the current table page. Separate records and summary requests
use the same resolved scope; they are not a cross-request database snapshot.
No schema migration or dependency was added.

## Browser and motion evidence

The redesigned matrix covers **144 cases**: nine pages × English/Thai × dark/light
× 390/900/1280/1440. It verifies loaded content, selected language/theme, nine
destinations, current-page navigation, one main heading, page overflow, visible
keyboard focus, exactly one active client EventSource and at most one server SSE
listener after bounded transport cleanup. All recorded cases have one server
listener. This matrix runs Vite development pages against the real authenticated
daemon with synthetic in-memory SQLite; it is not a packaged Electron or
production performance measurement.

The initial server-stream gate failed while the client already had one stream.
Direct and isolated browser tests did not reproduce duplication. Inspection found
Vite binds response-close cleanup after upstream headers. The harness now binds
upstream request destruction earlier, covering reload/StrictMode cancellation
before those headers arrive. The original complete reproduction then passed.
This harness fix does not change production stream code or relax the gate.

Pulse animation now observes the Pulse region, rather than the whole tall shell.
The visual harness verifies real animation pauses after scrolling it offscreen
and resumes when it returns. Reduced-motion and preview isolation checks remain.
History chart colors adapt to light theme. No measured CPU score is claimed.

## Validation and captures

- Daemon and web builds passed. The legacy App chunk still triggers Vite's
  warning at about 556 KB minified.
- Repository tests passed: daemon **88**, web **122**, tray **196**.
- `npm run test:history` passed and exited cleanly, including the new timeline,
  pagination independence, safe clipboard metadata, related-session link, focus
  restoration, prior pause/export/error checks and the 144-case matrix.
- `npm run test:ui` passed for the prior dashboard, Settings and popup.
- `npm run test:visual` passed: 21 preview captures plus offscreen pause/resume.
- `git diff --check` passed.

See [validation](redesign-v1.3/validation.json),
[browser matrix](redesign-v1.3/responsive-matrix.json),
[History concept-size capture](redesign-v1.3/history-concept-size.png),
[Thai light narrow capture](redesign-v1.3/history-th-light-390.png), and
[metadata-copy detail rail](redesign-v1.3/history-detail-en-light-1440.png).
The detail capture shows its scrolled copy state; it is not the initial open state.
Eight concept-size candidates include clock/browser/region metadata. They remain
review candidates; no approved baseline or SSIM score is claimed.

## Remaining release gates

Review geometry and typography of all eight screens against concepts and their
overrides, then establish named visual baselines and regional regression checks.
The matrix is a layout/navigation/stream gate, not complete keyboard/screen-reader
or contrast certification. Detailed visual refinement, runtime profiling, packaged
desktop verification, privacy/network release checks and rollback rehearsal remain.
The original checkout is unchanged; no installed daemon, scheduled task, tray
package, live provider account or user usage database was modified.
