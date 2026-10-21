# Integration evidence v1.85.109

Status: partially validated. No production source or visual change; source cf75234 and web108 remain current. [Read20-row requirement trace](REQUIREMENT-TRACE.md).

Fresh gates:650/650 repository tests (daemon121/web331/tray198), daemon build, tray/preload build and hidden isolated Electron fixture-host compatibility all pass. Native host uses Electron44.1.1, actual compiled sandboxed preloads, in-memory DB and a private userData/sessionData directory. Dashboard/popup hash override, ready/action IPC, sessions alias, command dialog focus isolation/return, actual custom Thai font and language switching pass with no external requests or preload errors. Existing popup compatibility was checked; no pet implementation was added.

[Native dashboard](images/dashboard-production.png), [Thai custom-font dashboard](images/dashboard-production-thai.png), [existing popup](images/popup-production.png). These are functional fixture screenshots, not reference-comparison/approved visual baselines. Old failure HTML files found in the ignored runtime output folder were not relabelled or packaged as current results; the harness deletes its verification file at startup and its current run exits0.

A265-file local compiled inventory covers daemon/web/tray/preload outputs and is bound by SHA256. This is not a portable bundle, dependency/license/notices audit, installed production-main lifecycle or an actual two-version rollback. [Current108 all-eight viewer](../redesign-v1.85.108/review.html) remains the visual evidence; its History/Providers/Cost strict raster controls stay RED. No99-100% fidelity, source visual acceptance or completed release claim.

The approved v1.1 ledger has20 GAPs; original download has9. Exact authority copies and ZIP hash are retained. Current minute/runway/History/Alerts and Cost/Providers presence implementations supersede dated source-absence findings, while timing/stress/native gaps remain open. See the trace for per-row evidence limits and required next work.

Reproduce: npm test; npm run build -w @quotapulse/daemon; npm run build -w @quotapulse/tray; node --import tsx scripts/check-desktop-runtime.mts. The web build used here is the unchanged108 build/index recorded in validation-summary.json. The desktop gate uses hidden fixture windows/local port7803 and isolated profile; it does not launch production main, live readers or a user DB. Gzipped full logs and exact harness sources are included.
