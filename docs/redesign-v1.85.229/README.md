# Transcript discovery and Diagnostics at narrow widths

This checkpoint reports incomplete transcript discovery for Codex and Claude Code instead of silently presenting a partial scan as healthy. Accessible files continue to be ingested; the reserved `(discovery)` health error counts consecutive incomplete passes and clears after a complete scan. A missing Claude `projects` root remains a valid empty profile. An uninspected symbolic link or directory beyond the existing traversal depth is conservatively reported as incomplete. Errors do not expose filesystem details in this diagnostic message.

The Settings grid now allows Diagnostics tables to scroll inside their cards on narrow screens instead of making the entire document wider than the viewport. English and Thai diagnostics text explains the discovery status.

## Verification

- Daemon build and full suite: 146 tests passed. Adapter fixtures cover failed enumeration, retry counts, recovery, partial accessible data, depth limit and an absent Claude root.
- Web build and full suite: 381 tests passed. The build reports the existing large-chunk warning.
- `node --import tsx scripts/check-transcript-discovery.mts`: eight compiled-browser cases covering both languages, both themes and 390/1440px widths; table scrolling on narrow viewports and two recovered views also passed. The server and profile were isolated fixtures.
- `npm run test:ui` passed, including navigation, existing popup, responsive Live/Limits and empty/error/recovery checks.
- The build and web tests initially failed in the restricted sandbox because child process creation returned `EPERM`; the recorded passing runs used the permitted environment with process creation.

This change does not establish source completeness for forecasts. Cost monthly projection remains unavailable unless all eligibility conditions can be proven. Discovery may remain incomplete when the existing walker encounters symbolic links or deeper directory trees; the walker does not follow them. Other sources and missing or malformed records require separate evidence. In particular, the JSONL reader counts malformed complete lines and advances the cursor, but its current adapters do not persist the `parseErrors` result; a later clean pass cannot prove those earlier lines were complete. The most recent review ZIP at this checkpoint predates these changes.
