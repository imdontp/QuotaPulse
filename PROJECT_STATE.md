# PROJECT_STATE — QuotaPulse

## Active track: Live redesign "The Pulse" (started 28 Sep 2026)

Branch: `feat/openai-subscription-quota`. **This track is a feature, and the Pet Mode RC
below is under a bugfix-only freeze.** They coexist deliberately: the freeze protects the
shipped Pet product, and the Live page is a separate surface. Treat the two releases as
independent — nothing in this track may change Pet behaviour, the tray, or the daemon.

### Why
The Live page says the same thing three times over (topbar AlertBell → AttentionPanel →
hero's three count tiles) plus a fourth status signal in the sidebar, and buries quota —
the only thing that matters — in the third block behind a 330px marketing hero. The
redesign makes quota the hero object and folds the rest into it.

### Non-negotiable design rule
**Never reward spending more quota.** A quota monitor that pays for burn trains the exact
behaviour it exists to prevent. Nothing in `lib/progress.ts` reads `total_tokens` or
`cost_usd`; volume is capped and worth almost nothing, and the multipliers are cache
efficiency plus remaining headroom. Pinned by a test.

### Phases
1. **Done** — progression logic, persistence, strings, backdrop tokens.
2. **Done** — quota ring, aurora field, ticker strip, old hero removed.
3. **Done** — level rail with badge shelf, reset timeline, one primary-reading rule.
4. **Done** — diagnostics folded to the foot of the page; subscription cards collapsed.
5. **Done** — dead strings and CSS removed. The redesign is complete.

### Live phase 5 state
Removed only what *this* work orphaned, and proved which that was rather than guessing:
`git grep` against the pre-redesign baseline (3e5e4b1) separates keys this track killed from
keys that were already dead.

- 6 strings orphaned by the deletions: `quota.eyebrow`, `quota.title`, `quota.blurb` (the
  marketing hero), `quota.availableHelp`, `quota.nextHelp`, `live.unpriced`.
- 7 strings added during the redesign and then never used: `pulse.burnLabel`,
  `pulse.active`, `pulse.since`, `progress.activeToday`, `progress.levelUp`,
  `progress.newBadge`, `progress.quotaHealthy`.
- CSS: `.quota-hero` (orphaned with the hero) and `.pulse-track` (added and never used — the
  meters ended up using the `bg-track` utility instead).
- **Deliberately left alone:** `quota.attention` / `check` / `available` and
  `pricing.empty` / `partial` / `complete` look unused to a text scan but are built
  dynamically as `` t(`quota.${status}`) ``. Deleting them would have broken the build
  quietly at runtime. About 40 other unused keys (`tab.today`, `gauge.alsoVia`,
  `live.accountQuotas`, the Hermes delegate strings) were already dead before this branch and
  are not this track's business.
- `noUnusedLocals` is off in `tsconfig.base.json`, so `tsc` will not catch an unused import.
  Scanned the fourteen files this track touched instead; none.

### Final validation
| | before | after |
|---|---|---|
| web unit tests | 27 | **65** |
| `check-ui.mjs` | 19/19 | **19/19** (3 new assertions) |
| `tsc -b` / `vite build` | green | green |
| tray | 196/196 | 196/196 (untouched) |
| daemon | 71/72 | 71/72 (untouched, same catalog-drift failure) |
| Live height at 1440px | ~1900px | **~1250px** |

### Live phase 4 state
The page now opens on quota. Order is the argument: hero, progression, the figures that
qualify it, resets, per-window reference, activity, then collection health.

- `DataHealthDisclosure` folds `DataStatusStrip` and `AttentionPanel` into one closed
  disclosure at the bottom. **Its summary line has to report health on its own** — a
  disclosure that only says "details" would let a stale quota feed look like a clean page,
  which is the exact failure the block exists to catch. It carries the worst tone as a dot
  plus a count.
- `useDataStatusItems` extracted so the collapsed summary and the expanded strip are two
  views of one computation; derived separately, the closed page would report health from a
  second, quietly divergent copy of the rules. Removed a dead `urgentOwners` set found
  alongside.
- `QuotaDetails` is collapsed to "Subscription · N tracked · per-window detail". The ring
  already answers "how much room is left" for every subscription, so the cards are
  reference. **The empty state is the exception and stays open** — if nothing is tracked at
  all, that must not hide behind a click.
- Both summaries gained a rotating chevron. A bordered bar with text and no arrow does not
  read as something to click, which is fatal for a block whose purpose is to be left closed.
- Page height at 1440px: ~1900px → ~1250px.
- `check-ui.mjs` updated for the two assertions that had to change, and both count-of-zero
  checks given a positive counterpart.

### Live phase 3 state
- `components/progression-rail.tsx` — level dial, streak, cache share, badge shelf. The
  scoring rule is stated on screen: "earned by caching more and leaving quota headroom, not
  by spending more". A score the user cannot explain is one they stop trusting.
- `components/reset-timeline.tsx` — replaces the four-row reset list.
  **Proportional-by-time was the wrong model and it broke visibly.** Rolling five-hour
  windows mean several subscriptions reset in the same minute, so the raw gaps were
  [0, 0, 0, 93] hours: the first three columns collapsed to nothing and their labels
  collided. Simultaneous resets are now one stop (`groupResets`), and column widths are
  proportional-then-clamped (`groupWeights`) so a cluster stays visibly tighter than a
  distant event without any label losing room to be read.
- `SubscriptionCard` now calls `primaryReading()` instead of repeating the rule inline, so a
  card cannot quote a different window than the arc above it.
- Web tests 63 → 65. `check-ui.mjs` 19/19, with the hidden-subscription check now paired
  with a positive case — the strip groups resets, so a count of zero on its own would have
  passed whether or not the names were still rendered.

### Still to do
One thing left alone on purpose: about 40 i18n keys (`tab.today`, `gauge.alsoVia`,
`live.accountQuotas`, the Hermes delegate strings) were already dead before this branch
started, per `git grep` against `3e5e4b1`. Removing them is unrelated cleanup, and a few may
still be reachable through a dynamic key, so it should be its own change with its own review.

### Live phase 2 state
- `lib/quota-ring.ts` — arc layout + the time track (where "now" sits in the window, and
  where the current rate runs out). Pure and tested; the projected-exhaustion marker is a
  claim about someone's quota, so its arithmetic is pinned.
- `lib/live-pulse.ts` — which windows earn an arc, ranked; and the throughput→intensity
  curve that drives the backdrop. Ranking rule: **the urgency band wins outright, fullness
  only decides inside a band.** Sorting on usage alone put a 60% window about to run out
  below a healthy 79% one.
- `components/aurora-field.tsx` — canvas field. Seeded (so screenshots are byte-stable),
  blobs pre-rendered to offscreen sprites, DPR capped, loop torn down when the tab hides.
  One static frame under reduced motion.
- `components/quota-ring.tsx`, `components/pulse-hero.tsx`, `components/live-ticker.tsx`.
- `QuotaOverview` → `QuotaDetails`; the marketing hero and its three count tiles are gone
  (the ring reports the same counts, and the alert bell already reported them too).
- The day trend query widened 7d → 30d for streak history. The week sparkline is the last
  seven points of that same series, so no extra round trip.
- Web tests 47 → 63. `check-ui.mjs` 19/19 with three new assertions (one arc per active
  subscription, an inactive subscription stays off the ring, and progression never hits the
  daemon).

### Constraints the redesign must respect
- `scripts/check-ui.mjs` pins Live's DOM: `stat-1` ValueDisplay, the `Data status` region,
  the `What needs your attention` string, exactly one `Pricing details — <name>` button,
  `.quota-card`, and an `<ol aria-label="Next resets">`. Three assertions need updating
  (see the plan); the rest the new design has to satisfy.
- Every request must be a `GET` except `PUT /api/settings`. **This is why progression is
  `localStorage` and not a daemon table.**
- All 16 committed screenshots run with `reducedMotion: 'reduce'`, so the reduced-motion
  frame is the one reviewed. The static composition is the finished look by design.
- `noOverflow` at 390 / 900 / 1280 / 1440, in both themes and both languages.

---

## Previous track: QuotaPulse Pet Mode v2

## Current phase
**Wave 5 — Release Candidate / Production Validation** (started 15 Sep 2026).

Policy: bugfix-only (P0/P1 + high-value P2 + low-risk polish). No new features.
Candidate flow: RC1 → bugfix → RC2 → Stable.

## Wave status
- Wave 1–4: feature-complete, **245 tests green** (tray 155, daemon 65, web 25) as of 15 Sep 2026.
- Packs: wave zips in `docs/` are deliberately ignored design inputs (see `.gitignore`); implementation for each wave is in the tree, not extracted pack copies.
- Wave 5 pack: `docs/quotapulse_pet_mode_v2_wave5_pack.zip` (also in temp dir when ZIP expands).

## Completed Wave 5 work
1. **Feature freeze declared** — stable roster frozen: orbit_bot / pulse_fox / flux_blob / capsule_cat; experimental roster: nova / byte / mochi / kuro (non-selectable until promoted).
2. **Gate audit G1–G18** (release gate matrix map) — findings recorded in `docs/RC-READINESS-REPORT.md` on this branch (accurate as of this state).
3. **Defect classification** (per Wave 5 defect severity model):
   - P1: experimental/uncertified asset directories could reach `dist-package/pets` via `package-assets.ts` (G16 leak) — FIXED.
   - P1: safe mode rewrote user preferences to disk (permanent loss of user choices; no exit path) — FIXED.
   - P2: `bubbleDismissTimer` not cleared in `before-quit` — FIXED.
   - P2: packaging script untested — test added.
   - P2 (accepted risk): no Electron-level e2e smoke test (G1), IPC-layer interaction tests (G17), visual pixel tests (G18) — logged as RC2 follow-ups.
4. **RC readiness report** written: `docs/RC-READINESS-REPORT.md`.

## Frozen product decisions (do not change without release-blocker justification)
- Tray = Global Alarm; Pet = Contextual Companion
- Movement default: minimal; roaming: opt-in
- Bonus Pets remain Experimental (never selectable in Stable)
- No cloud dependency / telemetry

## Validation status
- `packages/tray` npm run test: green (196)
- `packages/daemon` npm run test: green (74)
- `packages/web` npm run test: green (65); `npm run test:ui` (check-ui.mjs) 19/19
- Packaging validation: run `npm run package` in `packages/tray` — validates asset tree, includes only allowed asset kinds, aborts on errors.

### Resolved: the pricing-catalog vendor test
It used to fail on every machine whose `models.dev.json` had picked up a new upstream model.
`omen-alpha` and `space-bunny-free` arrived via the `opencode-go` and `opencode` routes,
neither of which was in the daemon's `GATEWAYS` set.

The old fix would have been to add the two names to the test's allow-list — the wrong axis.
The test allowed unknown **model names**, but these names say nothing about who built them and
nothing on the machine could; they were unknown because the *route* was a gateway, not because
a rule was missing. So the allow-list is now keyed on the route, and a new gateway model cannot
re-break it. `opencode-go` and `custom` were added to `GATEWAYS` as well — behaviourally inert
today, since neither is in `VENDORS`, but that inertness is the hazard: it is what lets a route
start answering with its own name the day someone adds it to `VENDORS` as a brand.

The guard still has teeth, and a test now pins that: a pair arriving through a route this
install has never heard of (empty, `some-unheard-provider`, near-miss `kilo2`) and matching no
family is still flagged. A maker route cannot produce an unknown at all, because
`PROVIDER_FALLBACK` is consulted last and always answers.

## Next steps (RC2 candidates)
- Electron-level smoke test where environment allows — if attempted and blocked by sandbox warnings, abort and record; do not force.
- Live soak on the dev machine (30-min interactive / 4-hour idle) — record observation in RC-READINESS-REPORT when run.
- User-visible safe-mode state/notification (spec: reduced asset cache + explicit retry exit) — implement only if classed blocker; otherwise defer to v2.1.
- Verify per-monitor DPI soak if test hardware allows.
