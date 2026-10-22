# Actual-version upgrade and rollback v1.85.115

Status: partially validated for the whole goal. The actual four-stage upgrade/rollback cycle passes, and fresh builds/current655-test repository suite pass. Product UI remains114; no additional visual-fidelity improvement is claimed for115.

## Source-bound runtimes

Two distinct detached production checkouts are preserved:

| Role | Source | Commit | Rebuilt web index SHA256 |
| --- | --- | --- | --- |
| Previous | published v1.80.0 tag | `6f5759344e16756c41cf2e6e335e65b89ab5b777` | `90f510ea9ce8a148277768450604bcaef41bf373a1f522ff3fb9b41e0b9c0b18` |
| Current | v1.85.114 | `00bf157f0f6c7ed95746b56b35dba9f134e1676d` | `846cf0b7fce6ace26bf83afe671c6a298c44443c18000cf74a207e486ffd8020` |

Both daemon/web/tray/preload trees were freshly built. Previous tray packaging passes198 tests. Current `npm test` passes655/655: daemon122/web335/tray198. Existing approved runtime assets are validated/packaged;209 pet asset files per bundle match their respective checkout's approved output. This is packaging compatibility, not new pet work. Dependencies and lockfile are retained; no install/update was run.

Provenance binds257 previous/277 current compiled runtime and launcher files to their matching checkout builds. Full package inventories additionally cover3135 previous/3155 current files, including dependencies, assets, fonts and notices. The current web index reproduces the published114 hash exactly. The previous runtime is rebuilt from the actual tag, not claimed to equal a previously shipped ZIP byte-for-byte.

## Runtime test contract

[PowerShell coordinator](../../scripts/check-release-rollback.ps1) and [evidence helper](../../scripts/check-release-rollback.cjs) operate only on a new synthetic fixture. The original untracked `check-review-version-rollback.*` scaffolds are preserved.

The test verifies two genuinely different application commits/code trees, schema7, explicit readers-off scheduler code, separate Electron userData/sessionData and matching host Node ABI127 before boot. It installs the actual previous ZIP, starts/stops its real daemon/tray, seeds a disposable DB, initializes that old running mode, then requires previous -> current -> previous -> current.

The old readers-off detector settles the synthetic source's derived `enabled` state1 ->0. Before freezing the upgrade baseline, the helper permits exactly that transition and requires every other seeded field to match. All four subsequent stage snapshots must equal the settled baseline exactly. This transition is disclosed; no history is discarded or baseline silently reset after an upgrade failure.

Durable checks include three usage facts, null/empty model/provider/effort/session identities, computed/native/unknown monetary basis, stored component/cache costs, four quota readings (zero/high/full/unknown and separate first/last seen), one delivered threshold alert, an ingest cursor, two hourly rollups, schema/meta, hidden owners, notification off/snooze/overnight quiet hours and the stored1371×887 window-size file. Catalog rates deliberately differ from the historical computed cost; that stored cost must remain unchanged. Volatile app/notification updated_at fields are outside the settings-value snapshot.

At each stage the helper verifies every extracted file before boot and after stop, every served web asset against the exact expected raw bytes (HTML has one explicit synthetic-token insertion), real API usage records and settings, executable path/entry/data path/role/readers-off flags, PID/creation time and terminal status after scoped stop. API usage must still return221 tokens across the same three records with their stored monetary provenance. No browser UI rendering is inferred from API readiness.

## Completed cycle

| Stage | Actual source | Extracted files exact before/after | Served web assets exact | Stopped durable snapshot |
| --- | --- | ---: | ---: | --- |
| Previous initialized | v1.80.0 | 3135 | 66 | Exact baseline |
| Current upgrade | v1.85.114 | 3155 | 82 | Exact baseline |
| Previous rollback | v1.80.0 | 3135 | 66 | Exact baseline |
| Current recovery | v1.85.114 | 3155 | 82 | Exact baseline |

Every stopped durable snapshot SHA256 equals `fe468b85fef851d75a249691033adc8684c921b8075a6a437bc058fe18776e06`. This is a comparison of the documented schema/fact/settings values, not a claim of identical SQLite file bytes or unchanged volatile timestamps. Eight recorded root processes have terminal ownership checks; final scoped cleanup succeeds. The fixture/profile is retained for inspection, with no active test instance.

The tested rebuilt archives are previous SHA256 `3571246407dbd8692a2ce44645a4dd4776fc08ec7d19deffc27735c70d248367` and current `5c378261868f39f19fab364a27e04b6cbb7a3101c55cb3a5cc9eecdc72c23ab0`. The unsigned current package contains product114 and no embedded review profile; host Node ABI127 is required. It is distinct from the earlier114 review ZIP because it is rebuilt from the frozen checkout with exact launcher bytes and a verification checkpoint label.

[Machine-readable audited summary](evidence/summary.json). Raw successful stage results, source/package inventories, build/test logs, failed-run records and bounded diagnoses are retained in the evidence manifest.

## Diagnoses retained

1. An early receipt checker expected six steps for both builds. The previous build correctly has five because its package command includes its tests. The verifier now checks exact step names and successful exits; no build gate was skipped.
2. Initial preflight rejects active-worktree launchers with different raw line endings from the frozen checkout. LF-normalized contents match. The coordinator runs beside the exact frozen checkout launchers; the raw hash check remains strict.
3. The first archive writer uses .NET CreateFromDirectory, which emits backslash entries here; the installer correctly rejects its missing canonical script entries before creating an installation. The QA writer now emits forward-slash entry names explicitly. Installer validation is unchanged.
4. A deep worktree-based installation fails in Windows PowerShell5.1/.NET extraction before app launch, leaving an inactive marker and inert staging data. The same archive entry extracts at117 characters but fails at303; Node writes/reads identical bytes at that long path. The owned installation now uses a short temp path, cryptographically/structurally bound to its fixture, and rejects predicted installed paths≥260 characters. Arbitrarily deep installation paths remain an actual limitation; this is not a long-path-support claim.
5. A subsequent owned-process guard rejects Windows8.3 aliases although executable, creation time, role and readers-off flags match. A scoped fresh-process probe proves equivalent short/long entry/data paths. Expected paths now use GetFullPath; executable matching is additionally required. No PID/time/role/isolation check was removed.

Failed runs and diagnostic evidence are retained. All started test instances are stopped by their own scoped helpers; no user/production instance is restarted or inspected.

## Open full-goal requirements

The all-eight [114 visual comparison](../redesign-v1.85.114/review.html) remains current. Human reference acceptance, retained raster/Models Thai-dark ring failures, complete current native UI/settings/popup/alias/error/motion/resource coverage and the full [20-row requirement trace](../redesign-v1.85.109/REQUIREMENT-TRACE.md) remain open. This test does not prove populated native dashboard/preload readiness, localStorage language/theme/currency/rate persistence, physical window restoration, pet appearance preference preservation, cross-schema migration, production installation, signed distribution or a whole-release confidence verdict.
