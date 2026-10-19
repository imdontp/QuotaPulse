# Socket-test diagnosis88 — preserved observations

## Provenance and scope

This document preserves observations from the agent tool transcript. The commands did **not** redirect stdout to a raw log at execution time. The excerpts below are copied from returned tool output; this is not a reconstructed complete raw stdout file. One returned wait chunk was explicitly truncated by its output budget. No tests were rerun to create this document.

Workspace: `C:/Users/TH12367283/Projects/QuotaPulse/tmp/worktrees/redesign-foundation`.

Original full-repository red log `tmp/source88-final-repository-tests.log` was inspected and left unchanged. It showed `read ECONNRESET` in the read-only POST socket test (test37 plus file-wrapper failure). That original error lacked a request-stage label and alone did not identify the failing request.

## Instrumentation and bounded reproduction

Only `packages/daemon/test/model-pair-trends.test.ts` was edited. Request and response error handlers gained method, encoded URI byte length, body byte length and `call.reusedSocket` diagnostics. Existing deliberately oversized GET handling already accepted ECONNABORTED, ECONNRESET and EPIPE; those accepted error codes were not broadened.

First diagnostic command (PowerShell):

```powershell
for ($pairSocketTrial = 1; $pairSocketTrial -le 8; $pairSocketTrial++) {
  Write-Output "Socket trial $pairSocketTrial"
  node --import tsx --test --test-name-pattern='read-only POST' packages/daemon/test/model-pair-trends.test.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Actual unified exec session: **23006**. Eight standalone socket-test trials passed; terminal exit0. This did not reproduce the failure and was not presented as a fix.

The next command retained the preceding tests in the same file to match warmed execution order:

```powershell
for ($pairSocketTrial = 1; $pairSocketTrial -le 6; $pairSocketTrial++) {
  Write-Output "Complete pair suite trial $pairSocketTrial"
  node --import tsx --test packages/daemon/test/model-pair-trends.test.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Actual unified exec session: **39741**. Trials1–4 passed; trial5 reproduced the failure and the loop stopped with terminal exit1. Relevant returned stdout excerpt:

```text
Complete pair suite trial 5
TAP version 13
# 08:53:01.752 INFO  [db] opened :memory:
# 08:53:02.090 INFO  [db] opened :memory:
...
# Subtest: read-only POST transports twenty maximum-length exact pairs over actual HTTP without changing header limits or stored facts
not ok 7 - read-only POST transports twenty maximum-length exact pairs over actual HTTP without changing header limits or stored facts
  ---
  duration_ms: 38.6921
  location: 'C:\\Users\\TH12367283\\Projects\\QuotaPulse\\tmp\\worktrees\\redesign-foundation\\packages\\daemon\\test\\model-pair-trends.test.ts:8:675'
  failureType: 'testCodeFailure'
  error: 'POST URI-bytes=36 body-bytes=164391 request reusedSocket=true: read ECONNRESET'
  code: 'ECONNRESET'
  stack: |-
    TCP.onStreamRead (node:internal/stream_base_commons:216:20)
  ...
1..7
# tests 7
# suites 0
# pass 6
# fail 1
# cancelled 0
# skipped 0
# todo 0
# duration_ms 1744.0096
```

The labeled failure is the **first valid large POST**, not the deliberately oversized GET: its URI is 36 bytes and its body 164391 bytes. `reusedSocket=true` establishes reuse of an existing agent connection. Combined with the immediately preceding deliberately parser-rejected oversized GET and the isolated-connection intervention below, this supports a test-harness connection-pool race. This does not establish a production endpoint defect.

## Minimal correction and verification

The test's helper now accepts an explicit `isolatedConnection` flag. Only the deliberately oversized GET passes that flag and therefore `agent:false`. Successful normal GET and POST calls continue using the normal persistent agent. No API implementation, global header limit, response expectation, accepted error list or database assertions were changed. Valid requests still must produce their exact expected status and facts; they do not catch or tolerate socket errors.

Verification command:

```powershell
for ($pairSocketTrial = 1; $pairSocketTrial -le 8; $pairSocketTrial++) {
  Write-Output "Isolated parser connection suite trial $pairSocketTrial"
  node --import tsx --test packages/daemon/test/model-pair-trends.test.ts
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}
```

Actual unified exec session: **11324**. All eight complete file runs passed 7/7, total 56 passed tests; command terminal exit0. Returned file-level duration summaries:

| Trial | Tests passed | Tests failed | File duration ms |
|---|---:|---:|---:|
| 1 | 7 | 0 | 2244.595 |
| 2 | 7 | 0 | 1664.8967 |
| 3 | 7 | 0 | 1826.9872 |
| 4 | 7 | 0 | 2137.0192 |
| 5 | 7 | 0 | 2220.4576 |
| 6 | 7 | 0 | 1484.982 |
| 7 | 7 | 0 | 2499.0878 |
| 8 | 7 | 0 | 3540.8306 |

First post-correction file summary, returned in the original exec output:

```text
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2244.595
```

Last post-correction socket-test and file summary, returned by the final wait on session11324:

```text
# Subtest: read-only POST transports twenty maximum-length exact pairs over actual HTTP without changing header limits or stored facts
ok 7 - read-only POST transports twenty maximum-length exact pairs over actual HTTP without changing header limits or stored facts
  ---
  duration_ms: 224.2732
  ...
1..7
# tests 7
# suites 0
# pass 7
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3540.8306
```

## Limits and follow-up

- Finite repeated success does not prove the absence of every network/test-runner race.
- The correction isolates a deliberately malformed transport experiment. It does not retry normal requests or relax application assertions.
- Synthetic loopback HTTP and in-memory database only; no user database, production service, browser, build or Git operations were used by this agent for this task.
- The coordinator reported a subsequent full-repository retry549passed/exit0, terminal17831. This agent did not inspect that separate handle/log; archive the coordinator's actual full-suite evidence independently rather than treating this message as its proof.
