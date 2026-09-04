# Data sources

Everything here was measured on this machine on 2026-09-02, not taken from documentation.
These formats change with harness releases (the Codex corpus alone spans 26 CLI versions and
two generations of the token schema), so when a number looks wrong, start here.

Nothing in this project reads prompts, responses, or code. Adapters take counters and
metadata only. See [PRIVACY.md](PRIVACY.md).

---

## The canonical token convention

Every adapter converts into this shape. The four token buckets are **mutually exclusive**;
reasoning is a *subset* of output and is never added into a total.

| Field | Meaning |
|---|---|
| `input_tokens` | Fresh input. Excludes anything read from or written to cache. |
| `cached_input_tokens` | Input served from cache (cache read). |
| `cache_write_tokens` | Input written into cache (cache creation). |
| `output_tokens` | **All** output, including reasoning/thinking. |
| `reasoning_tokens` | Informational subset of `output_tokens`. |
| `total_tokens` | `input + cached + cache_write + output`. |

No harness natively agrees with this. Each needed a different correction, and each
correction was verified arithmetically before it was written:

| Harness | Native quirk | Correction |
|---|---|---|
| Claude Code | already disjoint | direct map |
| Codex | `input_tokens` **includes** `cached_input_tokens` | `input = input - cached` |
| OpenCode | reasoning sits **outside** output | `output = output + reasoning` |
| Hermes | already disjoint | direct map |

Proofs, run against the live data:

```
Codex     last_token_usage: 141985 input + 1498 output = 143483 total  -> cached is INSIDE input
OpenCode  35679 total = 24076 in + 1236 out + 1023 reasoning + 9344 cache_read
                                          -> reasoning is OUTSIDE output, all five disjoint
Claude    5367/5367 rows have thinking_tokens <= output_tokens  -> thinking is INSIDE output
Hermes    reasoning <= output on every row; cache_read >> input -> same shape as Claude
```

---

## Claude Code

**Profiles: two.** `~/.claude` and `~/.claude-company` (a second `CLAUDE_CONFIG_DIR` install).
Separate accounts, separate quotas, so they are separate sources. The company profile is the
larger of the two (97 files / 159 MB vs 77 files / 72 MB).

### Usage: `~/.claude/projects/<slugified-cwd>/<sessionId>.jsonl`

Subagent transcripts live in a `subagents/` subfolder and are **not** included in the parent
session's file, so both must be walked.

`assistant` records carry `message.usage`:

```
input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens,
output_tokens_details.thinking_tokens, cache_creation.{ephemeral_1h,ephemeral_5m}_input_tokens,
server_tool_use.{web_search_requests,web_fetch_requests}, service_tier, speed, inference_geo
```

Top-level: `sessionId`, `session_id` (both, duplicated), `cwd`, `gitBranch`, `version`,
`requestId`, `apiBlockIndex`, `effort`, `isSidechain`, `uuid`, `parentUuid`.

### The dedup rule -- the single most important thing in this document

One API response is written as **several `assistant` rows**, one per content block
(`apiBlockIndex` 0, 1, 2 ...). Every one of them repeats the **same `message.id`** and a
**full copy of the identical `usage` object**. Summing rows therefore multiplies real usage:

```
assistant rows carrying usage : 10,029
distinct message.id           :  4,739
naive  output_tokens          : 14,180,563
dedup  output_tokens          :  5,914,606
inflation                     : 2.40x
```

Deduplicate on `message.id`. The `UNIQUE (source_id, dedup_key)` index enforces it across
restarts and re-ingests as well as within a pass.

### `<synthetic>` -- rows that are not API calls

Claude Code writes an `assistant` record for messages it produces itself: an interrupt
notice, an API error rendered as text. They are marked `message.model = "<synthetic>"` and,
unlike the tool-result records, they **do** carry a `usage` block -- so the `if (!usage)`
guard does not catch them. Every counter inside it is zero:

```
rows with model "<synthetic>"  :     44   (25 sessions, both profiles)
input / output / cache tokens  :      0   every field, every row
cost_usd                       :   null   cost_source "unknown"
```

Summing was therefore never wrong. Counting was. Before these were dropped they showed up
as 44 API calls that never happened, as a "model" in the models list, and as **44 of the
1,031 unpriced calls** -- a figure that is supposed to read "a model we saw in use has no
published price", which a local placeholder is not.

Skip the record outright rather than storing it with a null model: a row representing no
request has nothing to contribute to any question this tool answers. Migration 6 removes
the ones already stored, narrowed to zero-token rows so that a future synthetic message
carrying real usage would survive.

### `cost-state` -- Claude's own tally, and more complete than the transcript

Appended periodically; the **last one per session** wins.

```
totalCostUSD, totalDuration, totalLinesAdded, totalLinesRemoved, hasUnknownModelCost,
modelUsage: { "<model>": { inputTokens, outputTokens, thinkingTokens?,
              cacheReadInputTokens, cacheCreationInputTokens, webSearchRequests, costUSD } }
```

Compared per session against our deduplicated tokens, we land at **0.92-1.00x** -- always
under, never over. The gap is calls Claude Code makes but never writes to the transcript:
background Haiku calls for titles and summaries appear in `cost-state` with **zero**
corresponding `assistant` rows. So `cost-state` is stored on the session row as the native
figure and `/api/health` reports the coverage ratio, rather than either number pretending to
be the whole truth.

### Quota: two sources, wildly different freshness

**1. `~/.claude/statusline/<sessionId>/snapshot.json`** -- the only genuinely live gauge.
Written every ~5s **by a running session** (this is the user's own `usage-statusline.ps1`,
which receives live rate-limit data on stdin from Claude Code).

```
five_hour{used_percentage, resets_at, reset_in}, seven_day{used_percentage, resets_at},
context{used_percentage, input_tokens, window_size}, cost.total_cost_usd, model, effort, status
```

Two traps:
- The **root** `~/.claude/usage-snapshot.json` is a last-writer-wins aggregate and is often
  stale or all-null. Read the **per-session** files instead.
- Idle sessions write `used_percentage: null`. Pick the newest snapshot that actually
  carries a percentage, or an idle session will mask a live reading.

**2. `~/.claude.json` -> `cachedUsageUtilization`** -- always present, frequently stale.
Measured on this machine: file mtime `2026-09-02 15:38`, but `fetchedAtMs` = `2026-08-31
11:43`. **Two days old.** Claude refreshes it only occasionally.

```
fetchedAtMs, accountUuid,
utilization: { five_hour|seven_day|seven_day_opus|seven_day_sonnet:
                 {utilization, resets_at, limit_dollars, used_dollars, remaining_dollars},
               limits: [{kind, group, percent, severity, resets_at, is_active}],
               extra_usage{...}, spend{...} }
```

Both are recorded, each tagged with its `origin`, and the UI shows the age of every reading.
Never present the fallback as current.

The company profile keeps its config at `~/.claude-company/.claude.json`; the default profile
at `~/.claude.json` (one level *above* the config dir).

> **Parser note:** `~/.claude.json` contains duplicate keys differing only in case
> (`C:/Users/.../x` and `c:/Users/.../x`). PowerShell's `ConvertFrom-Json` throws outright.
> JavaScript and Python parse it last-wins.

Plan: `oauthAccount.organizationType` (`claude_pro` here).

---

## Codex CLI

`~/.codex/sessions/YYYY/MM/DD/rollout-<iso>-<uuid>.jsonl` -- 254 files, 508 MB.

Envelope: `{timestamp, ordinal, type, payload}`.

### `token_count` -- the best quota feed on the machine

19,249 of them. **Every one carries the current quota state**, which no other harness does:

```json
{"type":"token_count",
 "info":{"total_token_usage":{...},"last_token_usage":{...},"model_context_window":258400},
 "rate_limits":{"primary":{"used_percent":2.0,"window_minutes":300,"resets_at":1788335173},
                "secondary":{"used_percent":4.0,"window_minutes":10080,"resets_at":1788784058},
                "plan_type":"team","rate_limit_reached_type":null}}
```

- `primary` = 5-hour window, `secondary` = weekly. `resets_at` is epoch **seconds**.
- `total_token_usage` is **cumulative for the session** and keeps accumulating across context
  compaction. Summing it multiplies a session by its turn count. Use `last_token_usage`.
- `cache_write_input_tokens` is **absent** on the older schema generation (13,288 of the
  events). Default it to 0.
- `secondary` is present on only 5,087 of 19,249 events.
- `info` is frequently `null` -- quota moved, no usage. Must not create a usage row.

### Model and effort are not in `session_meta`

They come from `turn_context` (`model`, `effort` in `low|medium|high|max|xhigh`) or
`thread_settings_applied.thread_settings.{model, reasoning_effort}`.

### Fast path

`~/.codex/state_5.sqlite` -> `threads` (268 rows) pre-aggregates `model`, `reasoning_effort`,
`tokens_used`, `cwd`, `rollout_path`. Useful as a cross-check; it is a **superset**, indexing
threads whose rollout files have since been pruned. Our full parse lands within +3.5% of it.

**Skip `logs_2.sqlite`** -- 117 MB of tracing with no usage fields at all.

---

## OpenCode

`~/.local/share/opencode/opencode.db` -- **1.03 GB**, Drizzle-managed. The older
`storage/session|message|part` JSON layout is gone; everything is in SQLite now.

- `session` (154 rows) pre-aggregates `tokens_input/output/reasoning/cache_read/cache_write`,
  `cost`, `model` (a JSON string `{"id","providerID","variant"}`), `directory`, `agent`.
- `message` (7,800 rows) `data` JSON is the per-call grain we ingest:
  `{role, modelID, providerID, cost, tokens{total,input,output,reasoning,cache{read,write}},
    time{created,completed}, finish}`.

Two rules:
- Skip messages with no `time.completed` -- still streaming, counts not final.
- `tokens_cache_write` is **0 on every row**; OpenCode does not populate it here.

Timestamps are epoch **milliseconds**. `cost` is trustworthy and used directly as native cost.

Ingest is watermarked on `message.time_updated` with a 5-minute overlap, so a 1 GB database
is never rescanned.

---

## Hermes Agent

`%LOCALAPPDATA%\hermes\state.db`, plus one per profile under `profiles/<name>/state.db`
(three on this machine). Data often lives in an uncheckpointed `-wal`, so the sidecars must
be readable.

`session_model_usage` is keyed
`(session_id, model, billing_provider, billing_base_url, billing_mode, task)`:

```
api_call_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
reasoning_tokens, estimated_cost_usd, actual_cost_usd, cost_status, cost_source,
first_seen, last_seen        -- float epoch SECONDS
```

Two consequences worth knowing when reading a chart:

1. **This is a running aggregate, not a per-call record.** It mutates as a session
   continues, so these rows are emitted with `replaceOnConflict` and must overwrite. A
   Hermes session's entire usage lands on **one point in time** (`last_seen`), not spread
   across the turns that produced it. No finer grain exists on disk.
2. **Every cost column is 0**, with `cost_status` of `included` or `unknown` -- meaning
   "covered by a subscription", not "free". A zero is discarded and the value is priced from
   tokens instead; only a positive `actual_cost_usd` is trusted.

---

## Pricing

`~/.cache/opencode/models.json` -- the models.dev catalog, already on disk (4.4 MB, 212
providers, 7,042 priced models). Never fetched. Per model:
`cost{input, output, cache_read, cache_write}` in USD per 1M tokens, and `limit.context`.

Fallback: `%LOCALAPPDATA%\hermes\profiles\*\models_dev_cache.json` (same feed).

> **Must be read as explicit UTF-8.** The default Windows codepage here is cp874 and
> corrupts the file.

An unpriced model is recorded as `cost_source='unknown'` and rendered as a dash. It is never
counted as `$0` -- that would silently understate real consumption. `codex-auto-review` (971
calls) and local Ollama models are the main unpriced ones.

**What the cost number means.** On a subscription plan it is the list-price *value* of the
tokens consumed, not money billed. The UI says so wherever a figure is shown.

---

## Not ingested, and why

| Source | Reason |
|---|---|
| **GitHub Copilot CLI** | No usage data on disk at all. `~/.copilot/logs/` holds 533-845 byte lifecycle logs with no tokens, models, or session ids. Premium-request counters are server-side only. |
| **Cursor** | `.cursor/{agents,cli,debug-logs}` are all empty. `ai-code-tracking.db` tracks AI-vs-human *authorship*, not tokens -- and `model` and `conversationId` are NULL on all 900 rows. |
| **Gemini CLI** | Real data exists (`~/.gemini/tmp/*/chats/session-*.jsonl`, 84 files, `tokens{input,output,cached,thoughts,tool,total}` consistent across all 1,787 assistant messages) but it stops at 2026-07-08 because `settings.json` sets `sessionRetention.maxAge: "30d"`, and it carries no rate-limit data. Cheap to add as a plugin. |
| **zcode** | The best schema of the lot (`model_usage`, `turn_usage`, `tool_usage`) but every table has 0 rows; abandoned 2026-06-30. Kept as a design reference. |
| **pi agent** | Only 6 session files, but a clean format with per-bucket cost (`cost{input,output,cacheRead,cacheWrite,total}`, camelCase). The cheapest future addition. |
| **Antigravity** | Tokens are inside `gen_metadata.data`, a protobuf BLOB. Not worth reverse-engineering. |
| **`.codex/logs_2.sqlite`** | 117 MB of tracing; no target contains token, rate, usage, or quota fields. |
