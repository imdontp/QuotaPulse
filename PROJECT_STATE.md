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

### Live phase 6/7 state — validated against the real database
`scripts/shoot-real.mjs` copies the live `usage.db` to a scratch directory and points a
throwaway daemon at the copy, so the page can be judged as a healthy install actually looks
without writing a sample to real data. This exists because every other capture was either
`shoot.mjs` (a scratch database, so the *no data* case) or the check-ui fixture (a crisis:
88%, dead quota feed, incomplete pricing). Neither is the state a user spends 95% of their
time in.

**Three bugs came out of it that the fixture could never have shown**, all fixed in `103e4c3`:

1. A red "will run out" arc on a healthy page, and the 1% account behind it promoted to the
   hero headline. A weekly window at 1% with six days to reset carried a burn record
   projecting it full within the hour. `willExhaust` now delegates to `credibleProjection`,
   which believes a projection only if the observed rate could plausibly reach full in the
   time claimed. Deliberately not a "must be half full" rule — a window at 20% genuinely on
   pace to run out is exactly the case worth interrupting someone for.
2. `primaryReading` fell back to `limits[0]`, which is the API's row order. Claude Company's
   weekly 55% was hidden behind its five-hour 0% and the page opened on "1%". It now takes
   the fullest live window.
3. 0% and 1% drew a sub-pixel nub, so three tracked accounts rendered as one dark empty
   ring. `MIN_ARC_FRACTION` keeps every window visible without inflating a small number.

Four test fixtures had to change with them. Every one asserted a projection no rate could
produce — one claimed a window full in a second at 10%/h, another paired 8%/h with a
projection an hour away, two carried a burn with no rate and no sample count. Nothing
checked that before, so the tests were asserting an impossibility.

### Live phase 7 state — motion
`scripts/shoot-motion.mjs` runs with `reducedMotion: 'no-preference'`, three timestamps, and
both themes, then measures. Two measurement mistakes had to be corrected first, both of
which would have reported a comfortable lie:

- Sampling rAF measures the browser's vsync, not this loop, so it reported 60fps whether or
  not a pixel was drawn. The canvas now counts real paints in `data-frames`.
- The app shell owns its scroll container, so `window.scrollTo` moved nothing and the hero
  never left the viewport. The script now finds the real scroller, moves it, and refuses to
  measure if it did not.

Result: **120 paints → 0 once the hero scrolls away (100% saving)** at 390px. At 1440px the
saving is genuinely 0%, because the hero is ~550px tall and the whole page scrolls 512px —
it never leaves the screen. That is the honest number, not a failure.

Intensity is **1** on real data (224M tokens today), so the backdrop has been reviewed at
full strength in both themes. Light mode does not blow out under additive compositing.

### Still to do
One thing left alone on purpose: about 40 i18n keys (`tab.today`, `gauge.alsoVia`,
`live.accountQuotas`, the Hermes delegate strings) were already dead before this branch
started, per `git grep` against `3e5e4b1`. Removing them is unrelated cleanup, and a few may
still be reachable through a dynamic key, so it should be its own change with its own review.

## Competition track: the whole-app visual pass (28 Sep 2026)

### The finding that shapes everything

The app does not have a taste problem. It has a **distribution** problem: every piece of
craft it already has is quarantined.

| What is good | Where it lives | Where it does not reach |
|---|---|---|
| Aurora backdrop, severity halo, measurement grid | `pulse-hero.tsx`, one file | the other 10 surfaces get flat `--card` |
| Motion, and a genuine respect for reduced motion | 11 call sites, Live-led | no duration/easing token; the house curve was a literal 5× |
| Playfulness, idle tiers, celebration | **100% in the Electron pet** | the web has a streak chip and 11 badges, and no shared grammar |
| Loading | nothing | no Skeleton, no shimmer, `aria-busy` zero times, one centred "loading…" line |

So the work is not "decorate more". It is **export Live's existing discipline to every
surface**, then add one new idea per surface.

### Locked direction

- **Judged as:** data-viz / product craft. Not Awwwards-style novelty — pushing an eight-tab
  dashboard with real numbers at visual novelty buys a screenshot and loses the product.
- **Scope:** web first, tray after. The tray holds the most unused potential and the largest
  bill (`main.ts` 2796 lines, `pet.html` 2230, `gallery.css` 95 hex literals).
- **Playfulness:** the transitions and the acknowledgement, never the data. A quota
  dashboard's job is to be right; the fun lives in movement, in being acknowledged, and in
  the companion. A streak that flatters and a bar that lies are the same mistake.
- **Theme:** dark and light are both first-class. The token system already supports it, so
  there is no cost to doing it now and a large one to retrofitting.

### Consolidated backlog

**A — Bugs a user can see, independent of design**

1. Models claimed "no models match this filter" on every cold open. `loaded` was false while
   the request was in flight, and the fallback branch tested the same empty array. **Fixed**,
   with a regression test that holds the response open — an instant fixture could not see it.
2. Settings' Notifications card sits on "loading…" forever if that one endpoint fails
   (`.catch(() => undefined)`, no retry, no error).
3. Limits shows an empty 8-column table under its empty state; Health's Adapters table has
   no empty branch at all.
4. Seven surfaces render frozen data with no on-page indication after a failed refresh.
5. Six of eleven surfaces have no heading element — `CardTitle` draws a `<div>` — so they are
   missing from the screen-reader heading outline.
6. Dates and numbers use the OS locale rather than the chosen language, at ~5 call sites.

**B — Dead code, so there is less surface to redesign**

7. `components/analysis-filters.tsx` in full, including the saved-views feature; all of
   `sections/today.tsx`; `AnimatedNumber`; `ChartTooltip`/`ChartLegend`/`useChart`;
   `api.today`/`compare`/`limits`; ~40 i18n keys. Each verified by import-site grep.

**C — Duplication that makes a visual pass cost double**

8. The language/currency/rate block exists twice (~70 lines). Section headers 5×, stat grids
   4×, window-kind labels 3×, status→badge maps 4×, series-colour rules 4×, `numCell` used by
   one table of seven, focus traps hand-written 3×, and two independent tab systems.

**D — The design foundation, which is the actual work**

9. No Skeleton primitive; 5 surfaces have no loading branch. **Started.**
10. No motion tokens; 16 `transition-colors` at Tailwind's unnamed 150ms. **Done.**
11. Interaction state barely exists: 1 `whileHover` in the codebase, 0 `whileTap`,
    0 `whileInView`/`useScroll`.
12. Four design systems, not one. `pet-popup.css` redeclares the same token *names* with
    different values, so `--primary` means two things inside one bundle; `gallery.css` is
    dark-only, Segoe UI, with visibly different warn/crit reds. The tray is English-only.
13. Gallery clips every mascot (132px SVG in a 116px box), has no loading state, and its
    "Make it yours" panel omits six settings that exist in the pet's context menu.

### Progress

**Phase A — the shared language** (so per-page work is not re-invented per page)

- **A1 done.** Motion tokens (`--motion-*`, `--ease-*`, named duration utilities), a z-index
  ladder, the first `@keyframes` in the app. Fixed three quiet bugs found on the way:
  `rounded-2xl` was used in ten places and was never on the radius scale, so it silently fell
  through to Tailwind's default; the card-lift rule matched `section[...]` while `Card` is a
  `div` and so had never applied; the topbar carried two competing blur radii in one element.
- **A2 done.** `lib/motion.ts` — one `useMotionPref()` replacing three hand-rolled
  reduced-motion idioms, and named intents (`reveal`/`draw`/`snap`) instead of numbers.
  `test/motion-tokens.test.ts` pins the CSS and TypeScript halves together, because a token
  drifting from its twin is invisible by construction.
- **A3 done.** `components/skeleton.tsx` — shimmer via CSS, shaped to the real layout,
  `aria-busy` and a required label.
- **A4 done.** `components/page-parts.tsx` — `PageHeader` (closes the missing-headings gap)
  and `StatTile`/`StatTileRow` (collapses four drifted stat grids).
- **B started.** Models: the false empty state, plus the first real use of the new primitives.

### Phase B — states and headings, per surface

Deliberately done before any visual restyling. A page cannot be judged until it tells the
truth in all four of its states, and a "competition screenshot" taken on a page that is
quietly lying about its data is worth nothing.

**Bugs fixed**

- Settings' notification card now admits a failed endpoint and offers a retry, instead of
  reading "loading…" for the rest of the session. The failure was still swallowed from the
  shared error state, so nothing anywhere reported it.
- Limits no longer renders the empty message *and then* the mobile grid, an eight-column
  desktop table and its footnote over a zero-row body. The two empty cases are now distinct
  sentences — "nothing read yet" and "your filter matched nothing" — and the filters stay
  mounted in the second one so a reader can widen them again.
- Health's Adapters table had no empty branch at all, so an install with no discovered
  harness got a seven-column header over nothing. Same omission as Models, different costume.
- The Limits status dropdown borrowed `quota.all` ("All statuses") as its accessible name —
  it named the control after its first option rather than after what it filters. It is now
  "Status", and it uses the `Select` primitive instead of a raw `<select>` that rendered at a
  different size from every other filter in the app.

**Headings**

`CardTitle` drew a `div`, and it is the title primitive for every section card in the
dashboard. So six of the eleven surfaces had no heading element anywhere in their subtree:
absent from a screen reader's heading list, from the rotor, and from jumping between sections
by heading — a navigation aid that needs no assistive technology at all.

`CardTitle` takes `as` now, and the levels are set explicitly. Two related corrections fell
out of doing it properly rather than spot-fixing six pages:

- Figure tiles were `Card`s, which made each one a page region with no name. `StatTile`
  says structurally that a tile is a labelled number, not a region, so tiles are correctly
  absent from the outline while the sections around them are present.
- Alerts wrapped its list in a card that had no title once the page header was added — a
  second border and a second surface around a list that already draws its own. Removed.

`check-ui.mjs` now asserts the outline of all eleven surfaces: a heading exists under the
tab's h1, no second h1, no skipped levels, and **every top-level region is named**. That last
clause is the one that matters — a page with four regions where one carries a heading
satisfies a weaker check and is still three regions a reader cannot reach. Writing that
assertion is what found the Live page's own unnamed cards, which the audit had missed.

### Phase C — motion behaviour, then interaction

**Reduced motion is a behaviour, not a duration.** The stylesheet clamps
`animation-duration` under `prefers-reduced-motion`, which is the right backstop and
insufficient alone: every `motion` animation is JavaScript, so a component that animates
without asking the preference moves regardless. The symptom is invisible — to everyone else
the animation looks correct.

Four components were in that state, and the worst of them was the sidebar's tab pill, since
switching section is the most basic thing anyone does here. It still moves under reduced
motion (removing it would leave the active tab unmarked) but arrives rather than springs.
`StaggerItem` had no preference of its own at all: it relied on `Stagger` passing
`initial={false}` down the variant chain, so it was correct exactly as often as it was used
inside a `Stagger`. The house easing curve is now spelled out zero times in components, and
`AnimatedNumber` — dead since before this branch, and the last user of the numeric spring —
was deleted rather than migrated.

Three hardcoded English strings surfaced in the same files and were translated: `'no data'`
in both bar lists.

**Interaction.** The app had 37 hover states, 17 focus rings and one pressed state. A button
that tints on hover but does nothing when pushed reads as a label rather than a control, which
on a dashboard feels like sluggishness. Press is a 3% squash on `--motion-instant`. Cards a
person can act on say so with a shadow rather than a transform, since scaling a tall card
would move its contents.

### Phase D — the ambient backdrop

The instinct was to put an aurora on every tab, since the technique works and the Live page
proves it. That is the expensive wrong answer: a per-frame loop per surface on top of the one
that exists, an ambient animation fighting a twelve-row chart, and a field of moving particles
is the opposite of something meant to be felt. So it is **one element, one gradient, two
custom properties** — composited by the browser, with no frame budget and nothing to measure.

`lib/ambient.ts` is a pure function with eleven tests, because this is the one piece of
decoration in the app that makes a claim about the data, and the rules are invisible in a
screenshot — a backdrop that is subtly wrong looks like a backdrop:

- The colour comes from `severityOf`, the same function the rings use, so the backdrop cannot
  disagree with the rings. Crossing to warn and crit happens at 60% and 85%.
- A reading that is expired, missing, or older than six hours may not colour the present.
- A window that could not be measured is **idle, never calm**. Painting green because nothing
  is wrong, when the truth is that nothing could be established, is the single most dishonest
  thing this component could do — a calm backdrop is the one thing on screen a person is most
  likely to trust without checking.
- The worst window decides the mood, not the mean: one window in trouble is the answer.
- Intensity is capped at 0.55, so a full ring and a full bar remain the loudest things on
  screen.
- Hidden subscriptions do not tint anything, and a fully hidden set is idle rather than blank.

Writing the tests found a real bug in the first draft: a tone map was defined and never
used, so the dead-feed guard did not exist. It also caught a test I had written that
contradicted another test — the hidden-subscription case, where the two possible answers
cannot both be right and one of them is a bug wherever it lives.

Verified in both themes on real data. The wash reads as a faint tint rather than a colour in
light, which is the right way round: on white a saturated wash reads as a rendering fault,
where on near-black it reads as light.

### Phase D5 — acknowledge: a figure that moved says so

A dashboard that repaints about once a second has a real problem with numbers: almost every
figure is always changing, so "this moved" is background noise. Both usual treatments are
wrong. No signal and a working machine is indistinguishable from an idle one. A signal on
every change and the page strobes, which is worse than silence.

`useChangePulse` thresholds on a **fraction of the previous value** rather than an absolute
count, because 10,000 more tokens means something very different on a figure showing 40,000
than on one showing 40 million, with an absolute floor for figures near zero. Plus a 30s
cooldown, without which a steadily climbing figure re-tints every couple of seconds and the
page reads as broken. The visual is a background fade and nothing else — no transform, no
counting number — so it is one paint, it cannot strobe, and it needs no entry in the motion
vocabulary.

Two things worth recording:

- **The first draft watched the wrong value.** It inferred the number from the rendered
  value, which by the time it reaches a tile is a string like `"660.0k"`. `typeof value ===
  'number'` was never true, so the pulse silently never fired — and the browser test caught
  it, because "the class lands on the element" is exactly what a unit test of a pure
  threshold cannot see. The prop now takes the raw figure explicitly.
- **It is exempt from the reduced-motion clamp**, which is the one exemption in the
  stylesheet. A background fade is not movement, and since the number deliberately neither
  counts up nor slides, it is the only remaining way to report that anything happened — a
  reader who asked for less motion should not also be the one who never finds out. The count
  of exemptions is pinned by a test, because a second one is always added for a good reason
  and the reasons stop being good after the first.

### Phase E1 — dates follow the chosen language

Six call sites formatted dates with `toLocaleDateString()` and no locale, which means Intl
used the **operating system's** language. Someone running the app in Thai on a machine set to
English read English dates, and the trend chart's two axes ended up in different languages. In
a bilingual app that is not a cosmetic slip: the reader has said which language they read in
and one kind of value ignored it.

`useFormat` now has a `day` formatter, sharing the locale choice `clock` already made, with
the year shown only when the date is outside the current year — so a range crossing new year
reads as six days rather than eight months.

Two things about the test that needed a second and third attempt to be worth anything:

- **Chromium is now launched with `--lang=en-US`.** Without it, "the OS is English" and "the
  app passes the locale" produce the same result on this machine, so the test could not tell
  the difference it existed to check.
- **The fixture returned `from: 0` for every range**, which is the "all time" sentinel, so the
  usage view short-circuited to a label before formatting anything. A `range=month` request
  could not exercise the date code at all, and the test was passing on whichever call site
  happened to still be correct while the others went unchecked. It returns a real range now.

An earlier version of the assertion compared two whole pages and required them to differ —
which is vacuous, because every label differs between a Thai and an English build. Scoping it
to an element containing nothing but a date is what made it a real check: with the fix
reverted it renders `8/30/2026 – 9/29/2026` in both languages and fails.

### Still to do
The dead-code sweep is not done, and the audit behind it needs re-checking rather than
trusting: it called `components/analysis-filters.tsx` dead, but `projects.tsx` imports it. The
precise finding is narrower — `AnalysisFilterBar` is unreachable, because `ProjectsSection` is
called from exactly one place and always passes a `period`, so the `!period` guard around the
bar is never true, and with it the `filters.days` and `filters.sourceId` the hook was feeding
it. Deleting on the audit's word would have removed a feature from a live page.

### Phase E2–E5 — removing what is not reachable, and what is not true

**Two files, 89 keys, one correction to the audit.** `sections/today.tsx` and `api.today` had
no importers at all. `analysis-filters.tsx` did — the audit was wrong, and the real finding is
narrower: the bar is behind a `!period` guard on a section that always receives a `period`, so
it and the filter state feeding it are unreachable rather than the module being unused. With
the bar gone, `ProjectsSection` no longer needs its `sources` prop or a fallback range.

**`scripts/find-dead-i18n.mjs`**, because doing this by hand does not scale and does not
survive. Its first version was **wrong in the dangerous direction**: it reported
`quota.attention`, `quota.check` and `quota.available` as dead, because they are read as
`t(\`quota.${status}\`)` and a literal search cannot see a template. Deleting them would have
broken three status labels. It now treats any prefix that is interpolated at runtime as live
and prints those prefixes, so "alive but unprovable" is visible instead of looking like a
dead list. 89 keys went; the dictionary is 545 → 456, and the two dictionaries stayed in step
because `DICTS` is typed `Record<Lang, Record<MessageKey, string>>` and `t()` takes a
`MessageKey` — so a removed key still referenced by a literal cannot compile.

It is a script and not a test on purpose. Keys get added ahead of the code that will read them,
and a gate that fails the build for a forward reference teaches people to delete the key and
re-add it later.

**`scope="col"` in the table primitive**, not at eleven call sites. **`aria-sort` was
deliberately not added**, which contradicts this file's own backlog: no table in this app has
a sort control — every `.sort()` is a fixed ranking by cost or tokens — so `aria-sort` would
advertise an affordance that does not exist. A test now checks both, so a future sort control
has to add it and a future table cannot inherit a lie.

One thing to know about the diff: the two dictionaries were committed with CRLF despite
`.gitattributes` mandating `eol=lf`, so pruning them also normalises them and the raw diff
looks like the whole file. `git diff --ignore-cr-at-eol` is the readable one.

## Post-Live track: the other sections (28 Sep 2026)

Live is done and pushed. The remaining tabs were surveyed against the same rule Live was
built on — show the number once, and only show what changes a decision. Four phases, each
committed on its own so a regression names its own change.

### Phase 1–2 — duplication and dead structure (`d90bde9`)
- `sections/trend.tsx` deleted. There is no Trend tab: `App.tsx` redirects `#trend` to
  `#usage?range=month&view=summary`, and the day-trend sparkline is the last seven points of
  a series the Usage page already holds.
- `SourceTable` moved out of `sections/live.tsx` to `components/source-table.tsx` — two
  sections used it, so it was never a Live component.
- The all-time cost was printed twice on the cost view: once in the headline card, again in
  the breakdown's total row, each with its own copy of the pricing modal. The table total is
  plain text now; the headline keeps the one interactive figure.
- By-model panels get explicit loading and no-data states.

### Phase 3 — Health (`b152567`)
- Unpriced models and ingest errors each rendered a titled card unconditionally, so a healthy
  install showed two boxes whose entire content was "nothing to report". They now collapse
  into one `Nothing to flag` line and only appear when they have something.
- `health.allPriced` and `health.noErrors` removed — the emptiness flags were duplicating
  what the card's presence already said.

### Phase 4 — Sources identity
The Sources page rendered one row per database source. That is not what a person thinks they
are looking at: on a real install it was **16 rows for 5 accounts**, with one OpenAI account
appearing three times under the same name and nothing to distinguish the rows.

- `SourceStatus` now carries `account_key` and `enabled`, both additive query columns.
  `enabled` was already filtering the `WHERE` clause, so a switched-off source with history
  was listed but indistinguishable from an active one.
- `lib/sources.ts` — `groupSources()` groups by `account_key`; sources with no binding go to
  their own section under a synthetic `unbound:<harness>` key rather than being folded into
  an invented account.
- One component for both sections. Accounts and unbound groups are the same shape, and
  rendering them separately is how the unbound section came to hide its members: a harness
  with six unbound profiles showed one row and five of them were invisible.
- A group with one reader gets a line, not a table. A six-column header above one line is a
  header and a grid to say "one of these" — and since `groupSources` names a group after its
  busiest member, a lone reader's name is by construction the account's name, so printing it
  twice says nothing. The line adds what the header omits: which profile read, its feed
  state, its subscription, its tokens.
- The readers table drops its subscription column when no member has one. An unbound group is
  a table of readers with no subscription, so the column is the widest thing on the page and
  is entirely em dashes.
- `freshness: 'gap'` and `reason: 'usage_newer_than_quota'` are one fact from two directions
  and the daemon sets both. The badge and the detail line printed the same sentence twice;
  the detail line is now suppressed when the badge already carries it, and still shows for a
  stale feed whose reason the badge does not convey.
- Freshness labels were hardcoded English in a bilingual app — a Thai build showed
  "usage newer" beside translated everything else. Translated.
- The unbound blurb claimed these harnesses "have never been linked to a subscription",
  which the same page contradicts: a harness can be routed to a subscription without its
  usage being attributed there. Reworded to say what unbound means.
- `Overview.accounts` was still declared as a required field after the daemon stopped
  sending it in the overview response. Removed; `/api/limits` still returns it and keeps its
  type.

### Sources validation
- `lib/sources.ts` unit tests: grouping, worst-state, ordering, tie-breaks.
- `scripts/check-ui.mjs` had **no** `sourceStatus` fixture at all (`sourceStatus: []`), so
  this page had never been asserted on in a browser. It now has a fixture covering one
  account with two readers, one with a single reader, and an unbound harness with two
  profiles, and asserts the grouping, both rendering shapes, the dropped column, the disabled
  badge, and the de-duplicated gap warning.
- `scripts/shoot-real.mjs` takes a route and now captures Sources in EN/TH at 1440 and 390,
  because Sources is the one page whose layout is decided by the shape of real bindings,
  which a fixture can only invent.
- Web tests 69 → 75, daemon 74, tray 196, all passing; `check-ui.mjs` 19/19.

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
