# Actual production-main review checkpoint121

Status: partially validated for the whole goal. Product source is published120 (`67df80bc7687039e46af714f4206c2b1898aa507`); this checkpoint adds current native/runtime evidence, a reusable QA runner and a verified review ZIP. It does not add a UI design change or establish final reference acceptance.

## Frozen build

A separate detached120 checkout freshly builds daemon, web, tray and preloads. Its full repository suite passes655/655: daemon122, web335 and tray198. Approved runtime assets validate and a fresh87-package review folder is assembled. Dependencies and lockfile are retained without installation/update. Source and compiled launch/runtime files are matched to that checkout;3156 bundle files compare unchanged after native testing.

Web index SHA256: `2bbbad3034eabc907b040a7cb78054832ab81b577cf5fe44fa234f2a682826bd`, reproducing published120 exactly. [Audited summary](evidence/summary.json). Tests were executed on October22; the saved results and current artifact hashes were audited again on October23.

## Actual daemon, main and preload

[check-review-dashboard.mts](../../scripts/check-review-dashboard.mts) starts the bundle's real task entry, compiled daemon and production Electron main in a new owned temporary profile. Readers, harness detection, account probes, external price caches, notifications and Pet display are disabled. This is not the earlier desktop fixture entry or an in-memory HTTP substitute: the actual daemon reads a new on-disk SQLite fixture.

The existing open-dashboard IPC action is dispatched from test main. The renderer loads the exact compiled preload source, verified through its isolated-world debugger script; real ready IPC reaches the production show handler. Both Electron cycles verify sandbox, context isolation, disabled node integration and isolated userData/sessionData.61 served files are compared against bundle bytes, including one exact synthetic-token insertion into HTML. No renderer errors or forbidden/external requests occur.

Eight pages load before restart in EN dark, and the same eight load after restart in TH light: Overview, Live, Projects, Models, History, Alerts, Providers and Cost. Each capture has no page overflow. The legacy sessions URL resolves to History with the original range. These are16 native page captures, not the complete four-combination theme/language matrix or all-state interaction coverage.

## Real Settings persistence

Settings UI selects THB, applies37.25 as a synthetic display rate, sets window width1371 and height887 through the actual preload/main IPC, switches language to Thai and selects light theme. Electron exits with an explicit storage flush and restarts using the same profile. Language, theme, currency, rate and local window-size preference are exactly restored; the production main also restores native window size1371×887. The actual size request reaches the production JSON persistence path; no test writes that size file on its behalf.

All three usage facts and221 tokens remain identical, including native/computed/unknown monetary bases and nullable model/provider fields. SQLite integrity is `ok`. Only synthetic data is used. Sources are disabled in readers-off mode, so these native images exercise an unknown/empty quota presentation; they do not establish populated native quota-owner/window acceptance. The fixture is outside the unused review bundle and is not shipped in it.

## Presentation limits

The real production window is placed beyond every display, made nonfocusable and omitted from the taskbar for automation. Anti-occlusion flags, a background-throttling override and reduced motion are test-only. This proves bounded native data/render/preload/settings paths, not physical tray clicking, foreground/focus, minimize/restore, monitor changes, exact motion or resource behavior.

The test requests initial content1672×941; observed viewport/native capture is1688×980 at DPR1. These actual dimensions are retained in the evidence. They are not treated as exact reference-size images or a99–100% similarity result. The Settings restart checks the actual native size separately.

## Retained QA corrections

1. `getLastWebPreferences().preload` returns undefined on this host despite a working bridge. The runner instead verifies the exact loaded compiled script and real ready/size IPC. The original failed run is retained.
2. Playwright screenshot and hidden-window `capturePage` attempts time out on this host. Off-display native windows plus explicit test-only anti-occlusion configuration allow actual frame capture; no production constructor or renderer is replaced.
3. Waiting for the first Cost bar to be visible is incorrect for a real zero-height bucket. Readiness now waits for the loaded plot container and uses the intended month scope. No zero is inflated or excluded.
4. An earlier cleanup boolean considered only exitCode; Windows signal termination leaves that null. It now checks exitCode or signalCode. The two earlier owned daemon PIDs were separately audited as stopped. Current success records terminal SIGTERM and no cleanup errors. Failed evidence is preserved without rewriting its original booleans.
5. The first packaging action was not executed because the automatic approval service could not complete its review due to workspace credits. A later retry through the same approval service was allowed. No alternate path bypassed that service. The initial fresh PowerShell packer then lacked the explicit System.IO.Compression assembly; adding it before FileSystem resolved the type lookup before any ZIP had been created.

## Review delivery and full goal

The unsigned Windows x64 ZIP contains206481595 bytes and3156 entries. Each entry was decompressed and SHA256-compared against the tested unused source folder. Archive SHA256: `8fef215787427a180f2439b5fdcb1257fb3df1385dae9948daeebca580330501`.

A fresh copy of that byte-equivalent folder outside repository dependencies passes five real start/WhatIf/stop/restart checks. Its daemon/tray use a new empty readers-off profile; scoped stop preserves that DB and ends the recorded processes. Node ABI127 is an external prerequisite. This tests a standalone folder plus ZIP byte equivalence, not a current versioned ZIP installation or installer upgrade. [Archive receipt](evidence/archive.json), [standalone smoke](evidence/standalone-smoke.json), [review instructions](REVIEW-INSTRUCTIONS.md).

The full [20-row trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md), all-eight visual acceptance, current full native/settings/error/motion/resource matrix and retained raster controls remain open.120's Cost evidence and119's ring evidence remain scoped to their own executions.115's actual two-version rollback remains historical; this checkpoint tests same-version Electron restart, not another install/upgrade/rollback cycle. No production installation, customer database, real collectors, signed release or new Pet feature is introduced.
