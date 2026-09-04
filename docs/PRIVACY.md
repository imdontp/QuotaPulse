# Privacy

QuotaPulse reads files that contain some of the most sensitive material on the machine:
every prompt you have typed, every response, and the contents of files you have edited. It is
built so that none of that is ever read, stored, or served.

## What is read

Counters and metadata only:

- token counts, model ids, provider ids, reasoning effort, service tier, context window
- timestamps, durations, request ids, message ids
- quota percentages and reset times
- working directory, git branch, project name, session id

## What is never read

- prompt text, response text, thinking/reasoning text
- tool inputs and outputs, file contents, diffs, patches
- credentials of any kind

These files sit right beside the ones we do read, and are explicitly excluded:

```
~/.codex/auth.json                    OAuth tokens
~/.claude/.credentials.json           OAuth tokens
~/.copilot/ide/*.lock                 live auth nonce
~/.gemini/google_accounts.json        account identifiers
~/.claude/history.jsonl               every prompt typed
~/.codex/history.jsonl                every prompt typed
~/.claude/file-history/**             file content snapshots
AppData/Local/hermes/sessions/request_dump_*.json   raw API request payloads
```

Rule 1 in [ADAPTER.md](ADAPTER.md) makes this binding on new adapters.

## Where data goes

Nowhere. There is no telemetry, no analytics, and no cloud sync. Nothing about your usage,
your projects, your prompts or your machine is ever transmitted.

**The daemon makes no outbound request at all** -- not at startup, not on a timer, never. It
reads the pricing catalog from a file on disk.

There is exactly one command in the repo that uses the network, and it is one you run:

```
npm run prices:refresh
```

It performs a single unauthenticated `GET https://models.dev/api.json`, a public static price
list, and writes it to `%LOCALAPPDATA%\quotapulse\models.dev.json`. **It sends no
credentials, no usage data, no identifiers, and no query string** -- the request body is
empty and the URL is constant, so the only thing the other end learns is that some IP asked
for a public file. Skip it entirely and the tool works; costs read `--` until a catalog
exists. `scripts/fetch-prices.mjs` is the whole implementation, and it is the only file in
the project that calls `fetch`.

- Storage: `%LOCALAPPDATA%\quotapulse\usage.db`, a local SQLite file.
- Serving: `127.0.0.1` only. Not `0.0.0.0` — nothing on your network can reach it.
- Auth: a random token generated per daemon start, written to `daemon.lock` (readable only by
  your user account) and injected into the page it serves. It stops another local process or
  a stray page in your browser from reading the API.

The daemon works fully offline, and so does the dashboard page.

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
