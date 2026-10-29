# Settings native window-size reconciliation / checkpoint197

The isolated profile in [checkpoint196](../redesign-v1.85.196/README.md) demonstrated that a native window and the Settings controls could disagree when their separately persisted values differed. Settings now asks the dashboard's Electron bridge for the actual window size on mount, displays it and synchronizes its browser preference. The IPC handler only responds to the dashboard window. A missing, rejected or invalid bridge result retains the existing browser preference. A late response cannot replace an edit or reset made by the user, or update a page that has unmounted.

Validation uses the compiled application and isolated synthetic data, with readers disabled:

- `node --import tsx scripts/check-settings-window-size.mts`: eight browser scenarios cover native hydration, a browser without the bridge, an older bridge, rejection, invalid values, and delayed replies after an edit, reset or unmount.
- `node --import tsx scripts/check-native-window-size.mts`: real Electron dashboard and daemon, isolated profile, offscreen window. Starting with a native 1371×887 size and no browser preference, the controls and browser preference matched the actual window; reading did not rewrite the native size file. Editing to 1461×877 changed the actual window and file, and after clearing the browser preference and reloading, the controls again recovered the native size without rewriting the file.
- Web and tray builds passed; the web and tray test suites passed (376 and 198 tests respectively).
- `QUOTAPULSE_CAPTURE_SCOPE=settings npm run test:stable`: English and Thai in dark and light themes, two captures each; all four pairs were byte-identical, with no masks.

The native test uses a separate development profile and does not certify a packaged installer, physical-monitor placement or customer reader data. The latest review194 archive predates both this change and History commit `07035e4`; it does not include this fix. The prior upgrade/rollback validation covers the older packages, not this new source. Full dashboard visual acceptance and the other open release checks remain outstanding.
