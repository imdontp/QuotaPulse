# RC Readiness Report — Pet Mode v2 · 15 Sep 2026

Verdict: **RC1 = GO** (no open blocker; leakage paths fixed).

## Scope

Following `quotapulse_pet_mode_v2_wave5_pack.zip` (Phase A–F). Feature freeze in effect:
stable roster = Orbit Bot / Pulse Fox / Flux Blob / Capsule Cat; Bonus pets (nova, byte, mochi, kuro) remain Experimental / non-selectable. No new features were added in Wave 5 — bugfixes only.

## Release gate results (RELEASE_GATE_MATRIX.md)

| Gate | IO | Result | Evidence |
|---|---|---|---|
| G1 Startup | Yes | **PASS** | Build clean; Electron smoke test: launched from dist, alive after 10s, no exit (15 Sep). Renderer-crash-loop detection in place. |
| G2 Tray truth | Yes | **PASS** | `worst()` badge semantics + tooltip tests, tray frame tests `icon-frames.test.ts`. |
| G3 Pet focus | Yes | **PASS** | Focus tests: event > pin > active > rotation (presence.test.ts). |
| G4 State mapping | Yes | **PASS** | mood-resolver tests: every mood reachable + unknown safe (presence.test.ts). |
| G5 Alert dedupe | Yes | **PASS** | `alerts.test.ts` + wave3 dedupe tests + reset tolerance. |
| G6 Stable assets | Yes | **PASS** | Registry contains 4 mascots; real tree validation green; orbit_bot fallback chains enforced. |
| G7 Fallback | Yes | **PASS** | manifest fallback chain + cycle guard; corrupt manifests hard-rejected for stable; vector placeholder last resort. |
| G8 Placement | Yes | **PASS** | Clamp/idempotent repair/exclusion/persistence + recovery tests (wave3.test.ts). |
| G9 Multi-monitor | Yes | **PASS** | recoverPlacement, primary fallback, union-of-workarea tests; disconnected-monitor placements repair (no live reconnect soak on this machine). |
| G10 Reduced motion | Yes | **PASS** | reducedMotion setting + OS pref, downgrade to static/loops; locomotion gated. |
| G11 Persistence | Yes | **PASS** | atomic writes, backups, round-trips, no .tmp litter. |
| G12 Migration | Yes | **PASS** | Settings schema v4 migration + future-version last-known-good; placement legacy v2 shape migration. Wave5 tests added: repeated reads idempotent, hyphen id migration, round trip no drift (test/wave5.test.ts). |
| G13 Crash recovery | Yes | **PASS after fix** | Crash-loop detection tested; safe mode now a runtime-only downgrade that does NOT rewrite user settings to disk; tray menu gains explicit "Exit Pet Safe Mode" action. Spec extra triggers (asset-init storm, failed launch) deferred to RC2 (P2). |
| G14 Performance | Yes | **PARTIAL** | Simulated soaks (2h idle + event storm) pass; roaming cadence bounded; restart suppression verified; timers cleared in before-quit incl. bubbleDismissTimer. No live multi-hour soak run in this environment. |
| G15 Packaging | Yes | **PASS after fix** | `npm run package` aborts on validation errors; only allowed asset types copied; orbit-bot manifest guaranteed in output; **only 4 stable dirs shipped** (fixed below). |
| G16 Experimental isolation | Yes | **PASS after fix** | Gallery/beta gating + settings coercion + runtime registration restricted to stable; packaging now excludes unblessed directories (fixed below). |
| G17 UX polish | Usually | **PARTIAL** | Gesture threshold + hover/drag/bubble gating tested; IPC layer (qp-pet-hover etc.) reviewed, no automated test. |
| G18 Visual polish | No | **PASS (best-effort)** | Pet window height > bubble strip; popup clamped; no reported clipping defects. Pixel-level screenshot regression remains out of scope for RC1 (RC2 candidate). |

## Defects

| ID | Severity | Issue | Status |
|---|---|---|---|
| D1 Wave5 | P1 | `package-assets.ts` copied every directory matching generic hints — experimental candidate dirs could reach `dist-package/pets`, violating G16 isolation. | **Fixed** (roster-strict allowlist `isShippableCharacterDir` + wave5 test). |
| D2 Wave5 | P1 | Safe-mode downgrade (`render-process-gone` crash loop) was saved to disk — permanently rewrote user prefs and left no exit path. | **Fixed** (runtime-only downgrade + tray menu Exit action). |
| D3 Wave5 | P2 | `bubbleDismissTimer` not cleared in `before-quit`. | **Fixed**. |
| D4 Wave5 | P2 | Packaging script itself untested; packaging logic now pure-testable, G12 migration idempotence hardening test added. | Mitigated. |
| D5 Wave5 | P2 (deferred) | SAFE_MODE_SPEC extra triggers (asset-init failure storm, launch-failure flag) and visible safe-mode UX not implemented. | RC2 candidates. |
| D6 Wave5 | P3 | Electron-level e2e (hover IPC, network RO detection) lacks automated harness; only smoke run available. | RC2 / tooling backlog. |

## Validation summary

- `packages/tray`: 160/160 test pass (incl. new wave5 tests) — **Validated**.
- `packages/daemon`: 65/65 pass — **Validated**.
- `packages/web`: 25/25 pass — **Validated**.
- Build: `tsc` build/tray/daemon/web — success.
- Packaging: `npm run package` exited 0, 4 dirs shipped (orbit-bot, pulse-fox, flux-blob, capsule-cat) — **Validated** against G15/G16.
- Windows lifecycle (15 Sep manual smoke): app starts from `dist`; tray icon has popup; pet window renders without crash; no renderer errors observed. **Partially validated** (no multi-day soak, no monitor disconnect test run, no multi-monitor environment on this machine).
- Full live soak runs (interactive 30 min / idle 4 h): **Not run** in this session; the simulated soak equivalents in test suite pass. Recommend running on the dev machine in a real session before Stable.

## Files changed in Wave 5 RC1

- `packages/tray/src/main.ts` (safe-mode runtime-only + exit path, timer cleanup)
- `packages/tray/scripts/package-assets.ts` (G16 roster allowlist)
- `packages/tray/test/wave5.test.ts` (G12/G16 tests)
- `.gitignore` (wave5 pack zip as ignored design input)
- `docs/RC-READINESS-REPORT.md` (this file)

## Follow-ups for RC2

1. Run live soaks (interactive 30-min + idle 4h) on a real user session and record.
2. Dereference G16 for skin/whiskers: verify gallery roster+skins only reference shipped stable dirs (already covered by wave4 tests + wave5 packaging fix).
3. Add safe-mode visible indication (per SAFE_MODE_SPEC: user should know normal mode is degraded).
4. Add asset-init-failure storm safe-mode trigger guard.
5. Optional: Electron e2e harness for hover/drag IPC.
