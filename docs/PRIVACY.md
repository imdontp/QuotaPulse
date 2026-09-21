# Privacy

QuotaPulse reads files that contain some of the most sensitive material on the machine:
every prompt you have typed, every response, and the contents of files you have edited. It is
built so that none of that content is ever read, stored, or served. The OpenAI/Codex account
reader, Claude OAuth quota helper, and OpenCode Go quota helper may read their provider
credential state internally, but only return sanitized quota fields to QuotaPulse.

## What is read

Counters and metadata only:

- token counts, model ids, provider ids, reasoning effort, service tier, context window
- timestamps, durations, request ids, message ids
- quota percentages and reset times
- working directory, git branch, project name, session id

## What is never read

- prompt text, response text, thinking/reasoning text
- tool inputs and outputs, file contents, diffs, patches
- credentials of any kind in the QuotaPulse database, logs, API, or browser

Optional headless quota events are read from `%LOCALAPPDATA%\\quotapulse\\events\\quota.jsonl`.
The accepted fields are limited to subscription identity, execution mode, timestamps, quota
percentages, reset times, and an optional opaque route key. The adapter ignores prompt,
response, token-payload, and credential fields if they appear in an input line; it never
serves them to the dashboard or stores them.

The optional `scripts/claude-headless-bridge.mjs` forwards the existing Claude command's
stdout/stderr and extracts rate-limit fields from structured JSON in memory. It writes no
command arguments or output content to the event file.

These files sit right beside the ones we do read, and are not opened directly by the
QuotaPulse daemon. Provider auth files are handled only inside their dedicated helpers:

```
~/.codex/auth.json                    OAuth tokens
~/.claude*/.credentials.json          OAuth tokens
~/.copilot/ide/*.lock                 live auth nonce
~/.gemini/google_accounts.json        account identifiers
~/.claude/history.jsonl               every prompt typed
~/.codex/history.jsonl                every prompt typed
~/.claude/file-history/**             file content snapshots
AppData/Local/hermes/sessions/request_dump_*.json   raw API request payloads
AppData/Local/hermes/auth.json                      OAuth tokens (read only by Hermes)
~/.local/share/opencode/auth.json                   API key (read only by the OpenCode Go helper)
```

Rule 1 in [ADAPTER.md](ADAPTER.md) makes this binding on new adapters.

## Where data goes

Nowhere by default. There is no telemetry, no analytics, and no cloud sync. Nothing about
your usage, your projects, your prompts or your machine is ever transmitted. Account quota
probes are deliberate exceptions: they send only the authenticated provider quota request
needed to obtain the account limit; they never send prompts, responses, project data, or
QuotaPulse history.

When Hermes account quota monitoring is enabled (the default), QuotaPulse starts its Python
OpenAI/Codex account reader for each Hermes profile. The reader asks Hermes to resolve and
refresh its OAuth state, then makes the provider's Codex usage request directly and returns only
sanitized percentages and reset timestamps. Claude profiles use the same isolation boundary: QuotaPulse starts its
Node helper, which reads `.credentials.json` in memory and requests the Claude OAuth usage
endpoint, returning only the 5-hour and weekly percentages/reset timestamps. For OpenCode Go,
QuotaPulse starts its Node helper only when the local OpenCode auth file exists; the helper
reads the key in memory, calls the official usage endpoint, and returns only the three quota
windows and reset timestamps. QuotaPulse never receives or stores a bearer token, never logs
it, and never writes into any tool's state. Set
`QUOTAPULSE_HERMES_ACCOUNT_QUOTA=off` to disable the Hermes path entirely, or
`QUOTAPULSE_CLAUDE_QUOTA=off` / `QUOTAPULSE_OPENCODE_GO_QUOTA=off` to disable the respective
readers.

The price catalog command is still opt-in and separate:

```
npm run prices:refresh
```

It performs a single unauthenticated `GET https://models.dev/api.json`, a public static price
list, and writes it to `%LOCALAPPDATA%\quotapulse\models.dev.json`. **It sends no
credentials, no usage data, no identifiers, and no query string** -- the request body is
empty and the URL is constant, so the only thing the other end learns is that some IP asked
for a public file. Skip it entirely and the tool works; costs read `--` until a catalog
exists. `scripts/fetch-prices.mjs` is the whole implementation of this user-invoked price
request. The OpenAI/Codex, Claude, and OpenCode Go account requests are similarly isolated in
`scripts/hermes-account-usage.py`, `scripts/claude-oauth-usage.mjs`, and
`scripts/opencode-go-usage.mjs`; all helpers keep
credentials out of the daemon and logs.

- Storage: `%LOCALAPPDATA%\quotapulse\usage.db`, a local SQLite file.
- Serving: `127.0.0.1` only. Not `0.0.0.0` — nothing on your network can reach it.
- Auth: a random token generated per daemon start, written to `daemon.lock` (readable only by
  your user account) and injected into the page it serves. It stops another local process or
  a stray page in your browser from reading the API.

The dashboard page itself always stays local. The daemon's account quota readers are the
only paths that make authenticated outbound requests; disable the relevant reader or remove
its provider credential if fully offline operation is required.

That second half was not always true: the page pulled its typeface from Google Fonts on
every load, so opening the dashboard told Google the machine's IP, its User-Agent and when
it was opened — while this file said there were no outbound requests. The fonts are now
bundled into the build (`@fontsource-variable/geist`, imported in `src/main.tsx`) and the
brand marks were already inlined, so nothing the browser loads comes from anywhere but
`127.0.0.1`. It is worth re-checking after any change to `packages/web/index.html`: the
claim is easy to break silently, and a browser gives no sign it has been.

## Reading other tools' databases

Foreign SQLite files are opened read-only. QuotaPulse never writes to, checkpoints, or
vacuums another tool's database. If it crashes, the worst case for those tools is nothing.

## Deleting your data

```powershell
./scripts/uninstall-task.ps1 -StopRunning
Remove-Item "$env:LOCALAPPDATA\quotapulse" -Recurse -Force
```

That removes everything QuotaPulse has ever stored. The harnesses' own files are untouched —
they were never modified in the first place.
