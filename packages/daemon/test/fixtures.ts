import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export function tmpRoot(prefix = 'quotapulse-test-'): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

export const jsonl = (records: unknown[]): string => records.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * A Claude transcript slice reproducing the duplication that makes naive counting wrong:
 * ONE API response written as three assistant rows (apiBlockIndex 0,1,2), each carrying
 * a full copy of the SAME usage object under the same message.id. Plus a second, real
 * call, and the cost-state record Claude appends for the session.
 * No prompt or response content -- adapters never read it and tests never carry it.
 */
export function claudeTranscript(sessionId = 'sess-1') {
  const usage = {
    input_tokens: 12,
    cache_read_input_tokens: 40_000,
    cache_creation_input_tokens: 900,
    output_tokens: 500,
    output_tokens_details: { thinking_tokens: 120 },
    service_tier: 'standard',
  };
  const base = {
    type: 'assistant',
    sessionId,
    cwd: 'C:\\work\\demo',
    gitBranch: 'main',
    version: '2.1.258',
    effort: 'high',
    requestId: 'req_aaa',
  };
  return jsonl([
    { ...base, uuid: 'u0', apiBlockIndex: 0, timestamp: '2026-09-01T10:00:00.000Z', message: { id: 'msg_1', model: 'claude-opus-5', usage } },
    { ...base, uuid: 'u1', apiBlockIndex: 1, timestamp: '2026-09-01T10:00:00.100Z', message: { id: 'msg_1', model: 'claude-opus-5', usage } },
    { ...base, uuid: 'u2', apiBlockIndex: 2, timestamp: '2026-09-01T10:00:00.200Z', message: { id: 'msg_1', model: 'claude-opus-5', usage } },
    {
      ...base,
      uuid: 'u3',
      requestId: 'req_bbb',
      apiBlockIndex: 0,
      timestamp: '2026-09-01T10:05:00.000Z',
      message: { id: 'msg_2', model: 'claude-opus-5', usage: { ...usage, output_tokens: 250 } },
    },
    { type: 'user', uuid: 'u4', sessionId, timestamp: '2026-09-01T10:04:00.000Z' },
    {
      type: 'cost-state',
      sessionId,
      startTime: Date.parse('2026-09-01T09:59:00.000Z'),
      totalCostUSD: 1.2345,
      totalLinesAdded: 10,
      totalLinesRemoved: 2,
      totalDuration: 60_000,
    },
  ]);
}

/**
 * A Codex rollout covering both schema generations of the token counter plus the
 * awkward shapes seen in the real corpus: `info: null` (quota moved but no usage),
 * and a missing `secondary` window.
 */
export function codexRollout() {
  const meta = {
    timestamp: '2026-09-01T09:00:00.000Z',
    type: 'session_meta',
    payload: { session_id: 'codex-sess-1', id: 'codex-sess-1', cwd: 'C:\\work\\demo', git: { branch: 'main' } },
  };
  const turn = {
    timestamp: '2026-09-01T09:00:01.000Z',
    type: 'turn_context',
    payload: { model: 'gpt-5.6-luna', effort: 'max', cwd: 'C:\\work\\demo' },
  };
  const tc = (ordinal: number, ts: string, last: Record<string, number>, rate?: unknown) => ({
    timestamp: ts,
    ordinal,
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info: {
        total_token_usage: { input_tokens: 999, output_tokens: 999, total_tokens: 1998 },
        last_token_usage: last,
        model_context_window: 258_400,
      },
      rate_limits: rate ?? null,
    },
  });
  return jsonl([
    meta,
    turn,
    // Newer generation: includes cache_write_input_tokens. cached IS PART OF input.
    tc(10, '2026-09-01T09:01:00.000Z', {
      input_tokens: 10_000,
      cached_input_tokens: 9_000,
      cache_write_input_tokens: 100,
      output_tokens: 400,
      reasoning_output_tokens: 150,
      total_tokens: 10_400,
    }, {
      limit_id: 'codex',
      primary: { used_percent: 12.5, window_minutes: 300, resets_at: 1_788_335_173 },
      secondary: { used_percent: 4, window_minutes: 10_080, resets_at: 1_788_784_058 },
      plan_type: 'team',
    }),
    // Older generation: NO cache_write_input_tokens, and no secondary window.
    tc(20, '2026-09-01T09:02:00.000Z', {
      input_tokens: 2_000,
      cached_input_tokens: 1_500,
      output_tokens: 100,
      reasoning_output_tokens: 40,
      total_tokens: 2_100,
    }, {
      limit_id: 'codex',
      primary: { used_percent: 13, window_minutes: 300, resets_at: 1_788_335_173 },
      plan_type: 'team',
    }),
    // Quota-only event: must update limits but produce no usage row.
    { timestamp: '2026-09-01T09:03:00.000Z', ordinal: 30, type: 'event_msg', payload: { type: 'token_count', info: null, rate_limits: { primary: { used_percent: 14, window_minutes: 300, resets_at: 1_788_335_173 } } } },
  ]);
}

export function writeClaudeProfile(root: string, sessionId = 'sess-1') {
  const dir = join(root, 'projects', 'C--work-demo');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${sessionId}.jsonl`), claudeTranscript(sessionId), 'utf8');
  return join(dir, `${sessionId}.jsonl`);
}

export function writeCodexProfile(root: string) {
  const dir = join(root, 'sessions', '2026', '09', '01');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'rollout-2026-09-01T09-00-00-01a06001-491f-7ab2-9aae-46bc5157aa38.jsonl');
  writeFileSync(file, codexRollout(), 'utf8');
  return file;
}
