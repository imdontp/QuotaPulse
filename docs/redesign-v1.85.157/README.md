# Projects filter chips and scoped counts / source157

[Original / source155 / current gallery](review.html) · [Current Projects](after/projects.png) · [Thai/light mobile](images/th-light-390.png) · [Latest runnable ZIP review156](../redesign-v1.85.156/README.md)

Projects now follows the reference filter plate's compact chip, selected outline and numeric badge treatment. Its existing truthful filters remain All projects / Recent activity / Unassigned. Recency has a clock icon, rather than an invented Active lifecycle state; no Archived, Personal, Team, budget or authoring controls are fabricated. The original accessible button names and filtering actions remain intact.

Counts refer to distinct matching project groups within the current API period/source/harness scope and metadata search, before applying the tab filter. The existing detailed aggregate API returns every group without a LIMIT, and the metadata rows cover the same scope. Counts therefore do not use page length, record count or machine-wide Quick Stats. Null is the unassigned group; an empty project string remains a separate group, preserving existing behavior. Recent means lastObservedAt is not in the future and is within300000ms of the API snapshot now, inclusive of the exact boundary. Counts do not turn recency into proof that a project is currently running.

Each count is localized and described through the button tooltip/aria-describedby; its decorative badge is aria-hidden so it does not alter the established button name. Pending new scope shows an unknown dash, no old count or false zero, and aria-busy. A failed new request retains unknown counts with a could-not-load description and clears busy. Retry restores actual values. Successful empty results show real zeroes. A retained same-scope snapshot still follows the existing stale-data handling.

## Verification

The final production build passes. Sixteen compiled browser cases cover EN/TH, dark/light and390/900/1280/1672 widths using an isolated real HTTP/in-memory DB. Six groups come from seven records, including a null group, distinct empty string, an exact five-minute observation, one millisecond older observation and a future observation inside the explicit custom scope. Initial counts are6/3/1. Selecting Recent and Unassigned leaves the counts based on all matching groups, while showing3 and1 cards. Metadata search, source/harness scope, pending data,503 failure, retry, zero results, keyboard activation/focus and page overflow all pass.

All353 web tests and the full maintained integration pass. Its144 responsive cases keep at most one SSE server listener after navigation. The earlier initial implementation also passed integration; the final run includes the additional distinction between pending and failed count states. No test assertion, cleanup budget or numeric tolerance was relaxed.

All eight current canonical within-context screenshot pairs are byte-identical. The verified historical source155 baseline is index9a57fc2c0243d761bd576e1fed241ececd7ba154feec334b9f0349d26f5261ba, not a fresh run relabeled as before. Projects changes are confined to233,146–846,203 in the filter toolbar and its glow; card/detail/chart pixels remain unchanged. Six other full page frames are byte-identical. Providers still has105 differing global-header pixels, maximum channel delta4, matching the previously unexplained pattern; its gate remains open and no mask hides the differences. The earlier initial count-only build had seven unchanged pages; the final source-bound comparison is the six-page result above.

```powershell
npm.cmd run build -w @quotapulse/web
npm.cmd run test -w @quotapulse/web
node --import tsx scripts/check-project-filter-counts.mts
node --import tsx scripts/check-history.mts
```

The gallery uses complete unmasked frames and the SHA-verified original Projects reference. Consistent QA data and actual product data differ from the concept; no99–100% approval or similarity percentage is claimed. Review156 remains the latest runnable native ZIP and contains source155, not these source157 chips. No new native/ZIP, performance, tray/monitor or migration/rollback acceptance was performed here. Remaining visual/control/motion, customer/provider and desktop acceptance still need the full blueprint audit. Main and unrelated work remain preserved.
