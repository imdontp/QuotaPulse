# QuotaPulse

**Monitor. Understand. Optimize.** — the quota ring, what you have spent against it, and a
dot that says the reading is live.

> Previously **plimsoll**, and before that **usage-trend**. The state directory moved with
> each rename and the daemon adopts either of the old ones on first start, so upgrading in
> place keeps your history. See `packages/daemon/src/util/paths.ts`.

One dashboard for every AI agent harness on this machine: tokens, quota limits, reset times,
burn rate, cost, models, effort, and history that keeps accruing whether or not anything is
open.

It reads only files the harnesses already write. No credentials, no API calls, no proxy, no
network. Works fully offline.

The one exception is opt-in and separate: `npm run prices:refresh` fetches the public
models.dev price list, sends nothing, and is a command you run rather than anything the
daemon does. Skip it and the tool still works -- costs read `--`.

```
   ~/.claude/**      ~/.codex/**      opencode.db      hermes state.db
        |                 |                |                 |
   +----v-----------------v----------------v-----------------v----+
   |     COLLECTOR   adapters + per-target incremental cursors    |
   +------------------------------+-------------------------------+
                                  |  normalized events
   +------------------------------v-------------------------------+
   |  SQLite (WAL)   usage_event / limit_sample / session / price  |
   +------------------------------+-------------------------------+
                                  |
   +------------------------------v-------------------------------+
   |     Fastify @ 127.0.0.1:7676        REST + SSE                |
   +----------------+---------------------------+------------------+
                    |                           |
   browser dashboard (React + Tailwind)   Electron tray
   localhost:7676  shadcn/ui + motion      badge + alerts + panel
```

The daemon and the tray are separate processes on purpose: close the tray, close the
browser, and collection carries on.

## Quick start

```bash
npm install
npm run daemon:build
npm run build -w @quotapulse/web

npm run daemon          # http://127.0.0.1:7676
```

The dashboard listens for daemon updates over SSE and refreshes the visible tab as soon as
new rows arrive. A 30-second local fallback catches a quiet or interrupted stream; hiding
the tab pauses that fallback and returning to it refreshes immediately. The status pill
shows the connection state, and its refresh button runs one incremental ingest pass before
updating the dashboard.

Start at logon (daemon + tray), from PowerShell:

```powershell
./scripts/install-task.ps1          # add -NoTray for the daemon alone
Start-ScheduledTask quotapulse-daemon
```

Remove with `./scripts/uninstall-task.ps1 -StopRunning`.

## Running your own copy

Everything is resolved from your home directory and every harness is auto-detected, so a
clone reads *your* files and shows *your* numbers. Nothing is pinned to the machine it was
written on. Three things are worth knowing before you decide it is broken.

**If Cost is empty, run `npm run prices:refresh`.** Prices come from the models.dev
catalog. The daemon never fetches it: it reads a copy from disk, preferring its own at
`%LOCALAPPDATA%\quotapulse\models.dev.json` and falling back to whatever **OpenCode or
Hermes** happened to cache. On a machine with only Claude Code and Codex none of those
exist, so there is no catalog at all -- every call is unpriced, Cost reads `--` throughout,
and "unpriced calls" equals your total call count. Tokens, quotas and trends are unaffected.
`npm run prices:refresh` fetches it once and the next daemon start prices everything,
including history. See [Five things worth knowing](#five-things-worth-knowing-before-you-read-a-number)
on why an unpriced call shows `--` and never `$0`.

**Windows is the tested platform.** The daemon, dashboard and tray are portable Node and
Electron, but the logon-task scripts are PowerShell and the Hermes paths assume
`%LOCALAPPDATA%`. On macOS or Linux, expect to run `npm run daemon` yourself and to see no
Hermes sources.

**Build before installing the tasks.** `dist/` is not committed, and the scheduled tasks run
`packages/daemon/dist/index.js` directly, so run the Quick start build first --
`install-task.ps1` refuses to register anything otherwise. `better-sqlite3` is a native
module; `npm install` fetches a prebuilt binary for common Node versions and falls back to
compiling, which needs a toolchain.

Your data stays in `%LOCALAPPDATA%\quotapulse\`; the repo carries none of it.

## Supported harnesses

| Harness | Tokens | Cost | Quota + reset | Live |
|---|---|---|---|---|
| Claude Code (both profiles) | yes | computed + its own `cost-state` | yes, live while a session runs | yes |
| Codex CLI | yes | computed | **yes, on every API call** | yes |
| OpenCode | yes | native | none published | yes |
| Hermes Agent (all profiles) | yes | computed | none published | per session |

Adding another is one file: see [docs/ADAPTER.md](docs/ADAPTER.md). Copilot, Cursor, Gemini
and others were surveyed and deliberately left out — [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md)
says exactly why for each.

Detection re-runs every 60 seconds, so a harness or profile you start using while the daemon
is up is picked up without a restart (a new Hermes profile took 46 seconds in the test that
established this). Not every pass: `detect()` touches the filesystem for each adapter, which
is far too much to repeat on the 5-second ingest tick.

A harness on this list that you install later needs no restart: sources are re-detected every
60 seconds, so a new install, or a second profile of one you already have, appears on the
dashboard and in the tray within about a minute.

A harness that is *not* on this list needs an adapter -- roughly 150 lines, described in
[`docs/ADAPTER.md`](docs/ADAPTER.md). [`docs/DATA-SOURCES.md`](docs/DATA-SOURCES.md) records
which others were surveyed and why they were left out; Gemini CLI is noted there as cheap to
add.

## Five things worth knowing before you read a number

**1. Claude transcripts triple-count if you read them naively.** One API response is written
as several rows, each repeating the same usage object. On this machine that is 10,029 rows
for 4,739 real calls — a **2.4x** inflation. QuotaPulse deduplicates on `message.id`.

**2. Every quota reading shows its age.** Codex republishes its quota on *every* API call, so
it is seconds fresh. Claude has a live source only while a session is running and otherwise
falls back to a cached value that was measured **two days stale**. Both are shown, each
labelled with its origin and age. A stale number is never dressed up as current.

**3. Quota readings expire two ways.** A window that has rolled over shows a dash, never
its last percentage. So does a reading older than the window it describes -- Claude's cached
fallback publishes a percentage with no reset time at all, and a two-day-old "0%" cannot be a
statement about a five-hour window.

**4. Cost is value, not spend, and a guessed price says so.** On a subscription plan these
figures are what the same tokens would cost through the API. Calls on models with no published
price are shown as `--`, never as `$0` — and that dash means *every* call in the total was
unpriced, which is a different statement from a total that merely excludes a few (those carry
a trailing `+`).

The same rule runs one level deeper. A model id can exist under many providers at very
different rates — `gpt-5.5` appears under 17 of them here, from $0.188 to $5.50 per 1M input,
a 29x spread — so a price is looked up by `(provider, model)` first. Where only the model
matched, the call is marked `estimated` and names whose price was used, because a figure
derived from a provider we picked is a weaker claim than one from the provider the call
actually ran through, and the two should not look alike.

**5. An ingest pass sees only new bytes.** A harness names the model, the effort or the
working directory once per turn and then writes many usage lines against it, so an adapter
has to carry that state across passes — it is in the cursor, not in a local variable. Getting
this wrong is silent: the rows still land, just with the field missing, and a missing model
cannot be priced. There is a regression test per adapter that reads a file in two chunks.

## Commands

| Command | Does |
|---|---|
| `npm run daemon` | run the collector + API in watch mode |
| `npm run probe` | one ingest pass, then cross-check totals against each harness's own numbers |
| `npm test` | adapter, dedup, idempotency and reader tests |
| `npm run dev -w @quotapulse/web` | dashboard with hot reload, proxied to the daemon |
| `npm run start -w @quotapulse/tray` | build and run the tray |
| `npm run preview-tooltip -w @quotapulse/tray` | print what the tray tooltip and menu currently say |
| `npm run vendor-check -w @quotapulse/daemon` | show how every (model, provider) pair resolves to a vendor |
| `npm run prices:refresh` | fetch the models.dev price catalog (the only command that uses the network) |
| `npm run doctor` | check the things that fail silently: stale `dist/`, broken task paths, two daemons, missing catalog |
| `npm run shoot` | screenshot the dashboard into `screens/` for a visual once over |
| `npm run icon-preview -w @quotapulse/tray` | render the tray icon states to PNGs |
| `node scripts/gen-vendor-icons.mjs` | regenerate the vendor/harness brand marks and `--vendor-*` colours after adding a vendor or harness; prints the contrast and hue-separation tables |

`npm run probe` is the one to reach for when a number looks wrong. It prints what landed and
compares it against the ground truth each harness computes for itself.

`npm run shoot` starts its own daemon on port 7799 against a throwaway database, so it
never touches the real one, and writes a fixed set of shots: both themes, the 1280×800 tray
popup, either side of the sidebar breakpoint, all eight sections, Thai, and the logo mark.
It drives the Chrome already installed on the machine (`channel: 'chrome'`), which is why
`.npmrc` turns off Playwright's own 2.2 GB browser download.

Two things it exists to catch, both of which it has already caught: an SVG gradient left at
the default `objectBoundingBox` is undefined on a zero width or zero height bounding box, so
Chrome silently drops axis-aligned strokes (the logo's bars, a flat sparkline); and the page
holds an SSE stream open forever, so `chrome --screenshot --virtual-time-budget` hangs and
`waitUntil: 'networkidle'` never resolves. Wait on a selector.

## Sections

**Live** every detected source -- a gauge where the harness publishes a quota, and for the
ones that publish none (OpenCode, Hermes) a card saying so plus the totals we do have, so a
tracked harness never looks untracked -- alongside today's totals with sparklines and the
cache hit rate ·
**Limits** one row per quota window with burn rate and "hits 100% at ..." projection; a
harness that reports the same window through several origins shows the reading in force,
with the ones it supersedes on the freshness chip ·
**Trend** tokens/cost/calls over time, grouped by harness, model or project ·
**Cost** where the money went, one row per token bucket at its own rate · value by model ·
what caching actually saved, measured rather than estimated · unpriced calls, and calls
priced from a provider we picked rather than the one they ran through ·
**Sessions** every session with our figure beside the harness's own, 25/50/100 per page
with paging, filterable by the vendor that made the session's model ·
**Projects** what each working directory consumed, each bar already split by harness;
pick one for its harness / vendor / model cuts and a row per harness-and-model pair ·
**Models & Effort** effort broken down by model and the mirror view, filterable by the
vendor that MADE each model ·
**Health** ingest lag, cursors, read failures, unpriced models, and coverage against each
harness's own accounting — every card carries an explanation of what its number means

Every window label says exactly what it counts. "Today" is the calendar day from local
midnight, not a rolling 24 hours — those differ by 16x first thing in the morning — and the
seven-day figure is labelled "last 7 days" because that is what it is. The page used to
carry both claims at once: cards headed "today" over a rolling window, above an empty state
reading "nothing recorded in the last 24 hours".

The dashboard is React + Vite with Tailwind CSS v4, shadcn/ui components and motion for
transitions, in English or Thai, following the OS light/dark preference. Charts are
shadcn/ui Charts (Recharts): stacked areas, one tooltip listing every series at a point plus
a total, and a legend that hides a series on click. Each vendor carries its real brand mark
in its own brand colours, generated offline from `@lobehub/icons-static-svg` into a single
inlined React module -- no icon font, no network request, no first-letter placeholders.

Three chart rules worth knowing, because each is a place a prettier chart would lie:

- **A series that is a vendor is painted in that vendor's colour**, from
  `--vendor-*` in `packages/web/src/vendor-colors.css`. Every Claude bar is Anthropic's
  orange on Cost, on Trend and inside a project breakdown, so the same fact seen three
  ways looks like one fact. See [Vendor colours](#vendor-colours).
- **Everything else is assigned by rank over the visible set, never hashed.** With more
  series than palette slots, hashing puts two neighbouring stack segments on the same
  colour. This is why a bar whose segments are several models from one maker keeps the
  rank palette: colouring it by vendor would merge them into one block.
- **Interpolation is linear, not spline.** These are discrete hourly or daily buckets; a
  curve drawn through them turns a one-day spike into a week-long hump that never happened.

## Storage

`%LOCALAPPDATA%\quotapulse\usage.db` — SQLite in WAL mode. A full first pass over ~700 MB of
transcripts takes about 16 seconds; every pass after that reads only the delta and finishes
in under 100 ms.

## Vendor vs provider

The `provider` a harness records is the **gateway it routed through**, not who made the
model: `deepseek-v4-flash-free` arrives tagged `opencode`, `poolside/laguna-m.1:free`
tagged `kilo`, and Hermes labels OpenAI traffic `openai-codex`. Filtering on that column
would offer no "DeepSeek" at all.

So `packages/daemon/src/util/vendor.ts` derives a **vendor** from the model name, falling
back to the provider only when the name says nothing. It is a pure function, not a stored
column, so improving the rules fixes history too. The same table generates a SQL `CASE`
so `group_by=vendor` runs in the database — and a test asserts the two implementations
agree on every pair in the live database, which is how three real mismatches were caught.

Brand marks come from [`@lobehub/icons-static-svg`](https://github.com/lobehub/lobe-icons)
(MIT), baked into the repo by `scripts/gen-vendor-icons.mjs` so nothing is fetched at
runtime. simple-icons was the obvious alternative and carries no OpenAI mark.

Each mark is generated twice, in the owner's brand colours and in `currentColor`, and which
one is used is a rule rather than a preference:

- **Colour by default** -- a vendor's mark should look like the vendor's mark.
- **Mono where the chip beside the name means something else.** A brand colour sitting
  next to an unrelated chart colour reads as a second, contradicting key. This no longer
  applies to the Trend legend grouped by vendor, where the chip now *is* the brand colour
  and the mark is shown in colour to match.
- **Mono for the handful of brands that genuinely are monochrome** (OpenAI, xAI, Ollama,
  Nous, Xiaomi, OpenCode).
- **Per theme, where a mark only works on one background.** Kimi's glyph is white with no
  backing shape and vanishes on the light theme; OpenRouter's is a bare lime glyph that
  vanishes on white. Those render in colour on the theme where they read and in
  `currentColor` on the other, swapped by CSS so the choice is right on the first frame.

The generator prints the WCAG contrast of every mark against both theme backgrounds, so
that call is made from a measurement. It does not make the call itself: for a multi-colour
mark, the best of its colours passing tells you nothing about whether its *dominant* fill
is visible, which is exactly how Kimi looked fine on paper while being invisible in fact.

## Vendor colours

The same generator also writes `packages/web/src/vendor-colors.css`, one `--vendor-*` token
per maker for each theme. The hue is read out of the brand's own artwork, so a mark and its
bars agree, and the generator fails if a colour it was told to use is no longer in the file.

Three things make that workable rather than merely well-intentioned:

- **Lightness is fixed per theme; hue carries the identity.** Raw brand hex fails badly on
  one background or the other -- OpenRouter's lime measures 1.2:1 on white. Pinning L to
  the band the existing `--chart-*` tokens occupy keeps every bar visible and the set
  coherent, while the hue still says whose it is.
- **Crowded hues are pushed apart, within a limit.** Five real brands land between 258.8
  and 272.7 degrees -- Meta, InclusionAI, Google, DeepSeek and Poolside are all the same
  blue. Untouched, this would be *less* readable than the generic palette it replaces. The
  generator relaxes them apart, capped so no brand drifts far from its real colour, and
  where the circle has no room left, one of the pair is muted instead.
- **Makers you have never run cannot take a colour from one you have.** Sixteen vendors are
  wired up ahead of first use. They are placed only after the established ones have settled,
  and they are the ones that yield, so adding a seventeenth cannot change Anthropic's orange.

Eight brands publish a monochrome mark and so have no colour to read. Their hues are ours,
not theirs, chosen to fill the arcs the real brands leave empty; the alternative was eight
identical grey bars. `unknown` stays a near-grey deliberately, because it is not a brand.

Run `node scripts/gen-vendor-icons.mjs` to see the whole table: source colour, hue before
and after, and the measured contrast of every token on both themes.

One trap worth knowing, because it cost six logos: the mark bodies are injected as HTML,
not rendered as JSX. Attribute names must stay in SVG's own kebab-case -- rewriting
`stop-color` to `stopColor` made the HTML parser lowercase it to `stopcolor`, which is not
an attribute, so every gradient stop fell back to black and Qwen, StepFun, MiniMax and
InclusionAI rendered as silhouettes.

## Currency

Figures are computed in USD from published list prices. Switching to another currency
converts for display at **a rate you set yourself** — nothing fetches an exchange rate,
because nothing in QuotaPulse makes a network request. Every converted figure states its
rate next to it, so a baht total can never be mistaken for money actually billed.

## Privacy

Counters and metadata only. Prompts, responses, code and credentials are never read. Bound to
`127.0.0.1`, token-authenticated, no outbound requests — including from the dashboard page
itself, whose fonts and icons are bundled rather than fetched. See
[docs/PRIVACY.md](docs/PRIVACY.md).

## Licence

MIT — see [LICENSE](LICENSE).

Brand marks come from [@lobehub/icons-static-svg](https://github.com/lobehub/lobe-icons)
(MIT). Prices come from [models.dev](https://models.dev) (MIT), read from disk and fetched
only by `npm run prices:refresh`.
