# Writing an adapter

An adapter teaches QuotaPulse to read one harness. It finds that harness's files, converts
whatever it stores into the canonical shape, and hands rows to a sink. Everything else --
storage, pricing, the API, the dashboard, the tray -- is already done.

Adapters live in `packages/daemon/src/adapters/` and are registered in `index.ts`.

## The contract

```ts
export interface Adapter {
  id: string;                                  // 'claude-code' | 'codex' | ...
  displayName: string;
  detect(): Promise<Profile[]>;                // [] when the harness is not installed
  watchTargets(p: Profile): WatchTarget[];     // dirs/files/DBs that signal new data
  ingest(ctx: IngestCtx): Promise<void>;
}
```

A **profile** is one account or install of a harness. Claude Code has two here
(`~/.claude` and `~/.claude-company`); Hermes has three. Profiles have separate quotas, so
they are separate sources and must never be merged.

The **sink** takes three record kinds:

```ts
sink.usage(e: UsageEvent)     // one API call
sink.limit(s: LimitSample)    // one quota reading
sink.session(d: SessionDim)   // session metadata
```

## Five rules

**1. Never read content.** No prompts, no responses, no code, no file contents. Counters and
metadata only. Do not open `auth.json`, `.credentials.json`, `google_accounts.json`, or
anything holding a token. See [PRIVACY.md](PRIVACY.md).

**2. Open foreign SQLite read-only.** Use `openForeignRo(path)` from `db/index.js`. Never
write to, checkpoint, or vacuum another tool's database.

> `better-sqlite3` does **not** accept `file:...?mode=ro` URIs. The supported form is a plain
> path with `{ readonly: true }`, which still reads uncheckpointed `-wal` content.

**3. Be idempotent.** Running `ingest` twice must not change a single number. This is what
lets the scheduler run every few seconds without fear. It comes from two things:

- a `dedupKey` that is **stable** -- the same API call must produce the same key on every
  pass, forever. Prefer the harness's own message id. `${file}:${lineNumber}` is not stable
  if the file can be rewritten.
- advancing the cursor only past data already handed to the sink.

There is a test for this; add your adapter to it.

**4. Convert to the canonical token shape.** Buckets are mutually exclusive and reasoning is
a subset of output — see [DATA-SOURCES.md](DATA-SOURCES.md). Do not guess which convention a
harness uses. Verify it arithmetically against real data first: every harness in this repo
needed a different correction, and two of them were the opposite of what the field names
suggested.

**5. Only claim a native cost you trust.** Set `costSource: 'native'` when the harness
publishes a real figure. A `0` that means "included in a subscription" is not a real figure —
drop it and let the price table compute the value. Never let an unpriced call read as `$0`.

## Incremental reading

Full rescans do not scale: the two JSONL harnesses here are 580 MB combined.

**Append-only JSONL** — use `readJsonlDelta(path, byteOffset, onRecord)`. It reads only new
bytes, leaves a partial trailing line unconsumed (harnesses append while you read), and
reports `restarted: true` when the file shrank so you can re-read from zero.

```ts
const cursor = ctx.cursors.get(file);
if (st.size === cursor.fileSize && st.size === cursor.byteOffset) continue;  // nothing new
const res = await readJsonlDelta(file, cursor.byteOffset, (rec) => { /* ... */ });
ctx.cursors.set(file, { byteOffset: res.nextOffset, fileSize: res.fileSize, fileMtime: res.fileMtime });
```

**SQLite** — use a watermark on the harness's own updated-at column, with a small overlap so
a row written in the same millisecond as the watermark is not skipped. Never `SELECT *`.

```ts
const cursor = ctx.cursors.get('table:message');
const since = Math.max(0, cursor.watermark - 5 * 60 * 1000);
// ... query WHERE time_updated >= since ...
ctx.cursors.set('table:message', { watermark: maxSeen });
```

## Aggregate-grain harnesses

Some harnesses publish only running totals that mutate in place rather than per-call records
(Hermes). Set `replaceOnConflict: true` so the row updates instead of being ignored.

Understand the cost: that session's whole usage lands on a single timestamp rather than
spread across the turns that produced it. Say so in a comment — someone reading a chart
deserves to know why one harness looks spiky.

## Timestamps

Everything internal is **epoch milliseconds UTC**. Convert on the way in with the helpers in
`util/time.ts`. The harnesses disagree: ISO-8601 strings (Claude, Codex), epoch millis
(OpenCode), float epoch **seconds** (Hermes), and epoch seconds inside otherwise-millis
payloads (Codex `resets_at`). `fromEpochAuto` disambiguates by magnitude when a source is
genuinely inconsistent; prefer the explicit converter when you know the unit.

## Quota readings

Emit a `LimitSample` per window with an `origin` naming the file it came from. Origin is part
of the identity: a harness can publish the same window through a live feed *and* a stale
fallback, and the dashboard shows both rather than silently picking one.

Set `sourceFetchedAt` to when the **harness** last refreshed the value, not when you read it.
That is what drives the staleness badge, and it is the difference between a Codex reading
that is seconds old and a Claude fallback that is two days old.

The sink handles repetition: an unchanged reading refreshes liveness in place instead of
inserting a row, so a statusline rewriting the same percentage every 5 seconds does not add
17,000 rows a day or wake the dashboard.

## Registering

```ts
// packages/daemon/src/adapters/index.ts
export const ALL_ADAPTERS: Adapter[] = [claudeCodeAdapter, codexAdapter, myAdapter];
```

`detect()` returning `[]` is the correct response to "not installed" — never throw. A failing
adapter is isolated and the others still run, because any harness can change its on-disk
format at any upgrade.

Detection re-runs every 60 seconds, not once at startup, so `detect()` must be cheap enough
to call repeatedly and must reflect the disk as it is *now*: a profile that appears becomes a
source without a restart, and one that disappears is marked disabled and stops being read.
Disabling never deletes anything — the events that source recorded stay in every total, and
it keeps its card on the Live page for exactly that reason.

## Carry per-file state in the cursor, never in a local

`ingest()` is called every few seconds and reads **only the bytes appended since the last
call**. Anything your adapter learns from a line an earlier pass already consumed is gone
unless you persist it, and the failure is silent — the rows still land, just with a field
missing.

Put it in `Cursor.meta`, which is JSON stored beside the byte offset, so what you carry is
what was in force at that offset:

```ts
const cursor = ctx.cursors.get(file);
let model = asText(cursor.meta?.model);      // not `null`
// ... set it when a line names it ...
ctx.cursors.set(file, { byteOffset: res.nextOffset, meta: { model } });
```

Codex names the model and reasoning effort once per `turn_context` and then writes many
`token_count` lines against it; resetting `model` each pass recorded 59 real calls with no
model, and a null model fails pricing before it starts, so they were also worth $0. Claude
does the same with `cwd`, where losing it fell through to a guess derived from the folder
name — which silently renamed a project.

Anything read from `meta` is JSON from disk: validate it, and treat a malformed value as
absent rather than throwing, or one bad row stalls the source.

## Record read failures, don't just log them

When you catch a read error, tell the cursor store as well as the log:

```ts
} catch (err) {
  const message = (err as Error).message;
  log.warn(`failed reading ${basename(file)}`, message);
  ctx.cursors.recordError(file, message);   // <- or Health reports zero forever
}
```

The Health page's error count comes from `ingest_state`, and for a long time nothing wrote
to it: every adapter swallowed its failures into the log, so the page said "no read errors"
on a machine where it had simply never looked. `set()` clears the record on the next
successful read, so the count means "failing right now, this many passes running" — the log
line is deduplicated, the count is not, and the count is what tells you the rate.

A failure that escapes the adapter entirely is filed by the runner under `(adapter)`.

## Checklist

- [ ] `detect()` returns `[]` cleanly when the harness is absent
- [ ] Every catch that abandons a read calls `ctx.cursors.recordError`
- [ ] Per-turn fields (model, effort, cwd) survive a pass that appends only usage —
      test it by ingesting one file in two chunks
- [ ] Token arithmetic verified against real data, not field names
- [ ] `dedupKey` stable across restarts and file rewrites
- [ ] Cursor advances only past consumed data
- [ ] Foreign SQLite opened read-only
- [ ] No content, no credentials
- [ ] Added to the idempotency test
- [ ] Format documented in `DATA-SOURCES.md`, with the measurement that proves it
