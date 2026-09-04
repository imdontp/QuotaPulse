import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import { vendorOf, vendorOfHarness, vendorSqlCase, VENDORS } from '../src/util/vendor.js';
import { openDb, openForeignRo } from '../src/db/index.js';
import { DB_PATH } from '../src/util/paths.js';
import { tmpRoot } from './fixtures.js';
import { join } from 'node:path';

test('the routing provider never overrides what the model name says', () => {
  // The exact case that makes a `provider` filter useless: DeepSeek routed via OpenCode.
  assert.equal(vendorOf('deepseek-v4-flash-free', 'opencode'), 'deepseek');
  assert.equal(vendorOf('nemotron-3-ultra-free', 'opencode'), 'nvidia');
  assert.equal(vendorOf('mimo-v2.5-free', 'opencode'), 'xiaomi');
  assert.equal(vendorOf('qwen2.5-coder-3b:latest', 'ollama'), 'qwen');
  assert.equal(vendorOf('gpt-5.6-luna', 'openai-codex'), 'openai');
});

test('a vendor/model path prefix wins outright', () => {
  assert.equal(vendorOf('poolside/laguna-m.1:free', 'kilo'), 'poolside');
  assert.equal(vendorOf('openai/gpt-oss-120b:free', 'openrouter'), 'openai');
});

test('the routing provider is used only when the model name says nothing', () => {
  assert.equal(vendorOf('some-unheard-of-model', 'anthropic'), 'anthropic');
  assert.equal(vendorOf('totally-unknown', 'totally-unknown'), 'unknown');
});

/*
 * A gateway is a route, not a maker. Claiming one put OpenCode's and OpenRouter's logos
 * on models they had nothing to do with; `unknown` renders a neutral letter badge, which
 * says the honest thing.
 */
test('a gateway never becomes the vendor of a model', () => {
  assert.equal(vendorOf('openrouter/free', 'openrouter'), 'unknown');
  assert.equal(vendorOf('muse-spark-1.2-contributor-free', 'opencode'), 'unknown');
  assert.equal(vendorOf(null, 'ollama'), 'unknown');

  // But a gateway in the PREFIX must not stop a recognisable family in the tail.
  assert.equal(vendorOf('openrouter/deepseek-v4-flash:free', 'openrouter'), 'deepseek');
  assert.equal(vendorOf('openai/gpt-oss-120b:free', 'openrouter'), 'openai');

  // And the harness badge is unaffected: there OpenCode really is the tool at work.
  assert.equal(vendorOfHarness('opencode'), 'opencode');
});

test('the main model families resolve', () => {
  assert.equal(vendorOf('claude-opus-5', 'anthropic'), 'anthropic');
  assert.equal(vendorOf('gpt-5.5', 'openai'), 'openai');
  assert.equal(vendorOf('codex-auto-review', 'openai'), 'openai');
  assert.equal(vendorOf('gemini-3.1-flash-lite', 'google'), 'google');
  assert.equal(vendorOf('gemma-4-31b-it', 'google'), 'google');
  assert.equal(vendorOf('ling-3.0-flash-fin-free', 'opencode'), 'inclusionai');
});

/*
 * Makers wired up ahead of ever seeing one locally. The live-database tests cannot reach
 * these -- there is no Granite or Command row to walk -- so without this the sixteen new
 * rules would ship entirely unexercised. Two things are worth pinning: the rule fires,
 * and it resolves to a vendor that really is declared, since a rule pointing at a typo
 * would route a model to a vendor with no label and no logo.
 */
test('makers with no local usage yet still route, and to a declared vendor', () => {
  const cases: Array<[string, string]> = [
    ['command-a-03-2025', 'cohere'],
    ['aya-expanse-32b', 'cohere'],
    ['nova-pro-v1', 'amazon'],
    ['phi-4-reasoning', 'microsoft'],
    ['granite-4.0-h-small', 'ibm'],
    ['ernie-5.0-preview', 'baidu'],
    ['hunyuan-t1-latest', 'tencent'],
    ['doubao-seed-1.6', 'bytedance'],
    ['seed-oss-36b-instruct', 'bytedance'],
    ['solar-pro-2', 'upstage'],
    ['lfm2-8b-a1b', 'liquid'],
    ['sonar-reasoning-pro', 'perplexity'],
    ['olmo-3-32b-think', 'ai2'],
    ['falcon-h1-34b-instruct', 'tii'],
    ['exaone-4.0-32b', 'lg'],
    ['internlm3-8b-instruct', 'internlm'],
    ['baichuan-m2-32b', 'baichuan'],
    ['yi-lightning', 'zeroone'],
  ];
  for (const [model, expected] of cases) {
    assert.equal(vendorOf(model, 'openrouter'), expected, model);
    assert.ok(VENDORS[expected], `${expected} must be a declared vendor`);
  }
});

/*
 * Adding rules to the end of the list must not disturb the ones above them. These are the
 * families this install actually runs, asserted against the same gateway that carries
 * them in production -- if a new pattern ever shadows one, this is what says so.
 */
test('the new rules do not shadow any family already in use', () => {
  assert.equal(vendorOf('claude-opus-5', 'anthropic'), 'anthropic');
  assert.equal(vendorOf('gpt-5.6-luna', 'openai'), 'openai');
  assert.equal(vendorOf('deepseek-v4-flash-free', 'opencode'), 'deepseek');
  assert.equal(vendorOf('nemotron-3-ultra-free', 'opencode'), 'nvidia');
  assert.equal(vendorOf('mimo-v2.5-free', 'opencode'), 'xiaomi');
  assert.equal(vendorOf('qwen2.5-coder-3b:latest', 'ollama'), 'qwen');
  assert.equal(vendorOf('kimi-opus-2b:latest', 'ollama'), 'moonshot');
  assert.equal(vendorOf('laguna-s-2.1-free', 'opencode-free'), 'poolside');
  // Still unknown, and still deliberately so: a gateway is not a maker.
  assert.equal(vendorOf('muse-spark-1.2-contributor-free', 'opencode'), 'unknown');
  assert.equal(vendorOf('openrouter/free', 'openrouter'), 'unknown');
});

test('every harness maps to a known vendor', () => {
  for (const h of ['claude-code', 'codex', 'opencode', 'hermes']) {
    const v = vendorOfHarness(h);
    assert.notEqual(v, 'unknown', `${h} should have a vendor`);
    assert.ok(VENDORS[v], `${h} -> ${v} must be a declared vendor`);
  }
});

/**
 * The SQL CASE is generated from the same tables as the TypeScript, but "generated from
 * the same source" is not the same as "agrees". Run both over every (model, provider)
 * pair the real database holds and require an exact match.
 */
test('the SQL CASE agrees with vendorOf on every pair in the live database', (t) => {
  if (!existsSync(DB_PATH)) return t.skip('no local database yet');

  const db = openForeignRo(DB_PATH);
  const pairs = db
    .prepare(
      `SELECT DISTINCT COALESCE(model,'') AS model, COALESCE(provider,'') AS provider
         FROM usage_event`,
    )
    .all() as Array<{ model: string; provider: string }>;

  const expr = vendorSqlCase('m', 'p');
  const viaSql = db.prepare(`SELECT ${expr} AS v FROM (SELECT ? AS m, ? AS p)`);

  const disagreements: string[] = [];
  for (const { model, provider } of pairs) {
    const sqlVendor = (viaSql.get(model, provider) as { v: string }).v;
    const tsVendor = vendorOf(model || null, provider || null);
    if (sqlVendor !== tsVendor) {
      disagreements.push(`${model || '(null)'} via ${provider || '(null)'}: sql=${sqlVendor} ts=${tsVendor}`);
    }
  }
  db.close();

  assert.deepEqual(disagreements, [], `SQL and TS must agree on all ${pairs.length} pairs`);
  assert.ok(pairs.length > 0, 'expected some pairs to check');
});

/**
 * Anything landing on `unknown` shows a letter badge instead of a real logo, so the set of
 * unknowns is a deliberate list rather than whatever happens to fall through.
 */
test('nothing in the live database falls to unknown except the known exceptions', (t) => {
  if (!existsSync(DB_PATH)) return t.skip('no local database yet');

  // Models whose only clue is a gateway: nothing on this machine can say who made them,
  // so a neutral badge is the correct answer rather than a missing rule.
  const ALLOWED_UNKNOWN = [/^muse-spark/, /^openrouter\//, /^$/];

  const db = openForeignRo(DB_PATH);
  const rows = db
    .prepare(
      `SELECT DISTINCT COALESCE(model,'') AS model, COALESCE(provider,'') AS provider
         FROM usage_event WHERE model IS NOT NULL`,
    )
    .all() as Array<{ model: string; provider: string }>;
  db.close();

  const unexpected = rows
    .filter((r) => vendorOf(r.model, r.provider) === 'unknown')
    .map((r) => r.model)
    .filter((m) => !ALLOWED_UNKNOWN.some((re) => re.test(m)));

  assert.deepEqual(unexpected, [], 'these models need a vendor rule');
});

test('openDb still works on a throwaway path (vendor changes touch no schema)', () => {
  const db = openDb(join(tmpRoot(), 'vendor.db'));
  assert.ok(db.prepare('SELECT 1 AS ok').get());
  db.close();
});
