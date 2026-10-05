import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

import {
  vendorOf, vendorOfHarness, vendorSqlCase, VENDORS, GATEWAYS, PROVIDER_FALLBACK,
} from '../src/util/vendor.js';
import { openDb, openForeignRo } from '../src/db/index.js';
import { DB_PATH } from '../src/util/paths.js';
import { tmpRoot } from './fixtures.js';
import { join } from 'node:path';

/**
 * An empty model name is the one case nothing could ever identify, regardless of route.
 * Module-level because two tests assert against it, and a copy per test would let the two
 * drift -- which is exactly how the model-name list this replaced got stale.
 */
const MODEL_ALLOWLIST = [/^$/];

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
test('a route this install has never seen is still flagged, not excused', () => {
  // The point of keying the allow-list on the route rather than the model name. Every one
  // of these is unidentifiable by name, and each has to be judged by how it arrived.
  const accepted = (model: string, provider: string) =>
    !GATEWAYS.has(provider.toLowerCase().trim()) &&
    !MODEL_ALLOWLIST.some((re) => re.test(model));

  for (const provider of ['opencode', 'opencode-go', 'openrouter', 'kilo', 'ollama', 'custom']) {
    assert.equal(accepted('brand-new-2099-model', provider), false, `${provider} is a route, not a maker`);
  }
  // A provider with no family rule and no fallback is a genuine gap in this install, and
  // `kilo2` shows a near-miss cannot slip through either.
  for (const provider of ['', 'some-unheard-provider', 'kilo2']) {
    assert.equal(accepted('brand-new-2099-model', provider), true, `${provider} must not be excused`);
  }
  // A maker route is answered by the fallback before it can ever be unknown, so it is not
  // the case that distinguishes the two rules -- and pretending otherwise would misdescribe
  // what the live-database assertion is protecting.
  for (const provider of ['openai', 'anthropic', 'google']) {
    assert.notEqual(vendorOf('brand-new-2099-model', provider), 'unknown', 'the fallback always answers');
  }
});

test('a gateway never becomes the vendor of a model', () => {
  assert.equal(vendorOf('openrouter/free', 'openrouter'), 'unknown');
  assert.equal(vendorOf('muse-spark-1.2-contributor-free', 'opencode'), 'unknown');
  assert.equal(vendorOf('space-bunny-free', 'opencode'), 'unknown');
  assert.equal(vendorOf('omen-alpha', 'opencode-go'), 'unknown');
  assert.equal(vendorOf(null, 'ollama'), 'unknown');

  // But a gateway in the PREFIX must not stop a recognisable family in the tail.
  assert.equal(vendorOf('openrouter/deepseek-v4-flash:free', 'openrouter'), 'deepseek');
  assert.equal(vendorOf('openai/gpt-oss-120b:free', 'openrouter'), 'openai');

  // And the harness badge is unaffected: there OpenCode really is the tool at work.
  assert.equal(vendorOfHarness('opencode'), 'opencode');
});

/*
 * Every route that has ever shown up unpriced is a gateway, and gateways hand out model
 * names that name no maker. Pinning the set means a gateway cannot be promoted into
 * `VENDORS` later without this failing, which is the one way it could start answering
 * with its own name.
 */
test('the gateway set covers every route seen on this machine', () => {
  for (const id of ['opencode', 'opencode-free', 'opencode-go', 'openrouter', 'kilo', 'ollama', 'custom']) {
    assert.ok(GATEWAYS.has(id), `${id} is a route, not a maker`);
  }
  // A gateway that is also a maker would be a contradiction, not a special case.
  for (const id of GATEWAYS) {
    assert.equal(
      Object.hasOwn(PROVIDER_FALLBACK, id),
      false,
      `${id} is in GATEWAYS and PROVIDER_FALLBACK at once`,
    );
  }
  // And none of them may be reachable as a vendor by name prefix.
  for (const id of GATEWAYS) {
    assert.equal(vendorOf(`${id}/some-model`, 'openrouter'), 'unknown', `${id}/ must not resolve`);
  }
});

test('the main model families resolve', () => {
  assert.equal(vendorOf('claude-opus-5', 'anthropic'), 'anthropic');
  assert.equal(vendorOf('gpt-5.5', 'openai'), 'openai');
  assert.equal(vendorOf('codex-auto-review', 'openai'), 'openai');
  assert.equal(vendorOf('gemini-3.1-flash-lite', 'google'), 'google');
  assert.equal(vendorOf('gemma-4-31b-it', 'google'), 'google');
  assert.equal(vendorOf('ling-3.0-flash-fin-free', 'opencode'), 'inclusionai');
});

test('space-separated Claude display names resolve identically in TypeScript and SQL', () => {
  const db = openDb(':memory:');
  try {
    const query = db.prepare(`SELECT ${vendorSqlCase('m', 'p')} AS vendor FROM (SELECT ? AS m, ? AS p)`);
    for (const model of ['Claude 3.7', 'Claude 3.5']) {
      assert.equal(vendorOf(model, 'anthropic'), 'anthropic');
      assert.equal((query.get(model, 'anthropic') as { vendor: string }).vendor, 'anthropic');
    }
  } finally { db.close(); }
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
 * unknowns has to be a decision rather than whatever happens to fall through.
 *
 * This used to allow-list model NAMES, which was the wrong axis and re-broke every time a
 * gateway refreshed its catalogue: `omen-alpha` and `space-bunny-free` arrived via
 * `opencode-go` and `opencode` and the list had never heard of either. Neither name says who
 * built it, and nothing on this machine could, so `unknown` is the correct answer rather
 * than a missing rule.
 *
 * The rule is therefore about the ROUTE, not the name: a model is allowed to be unknown
 * exactly when it arrived through a gateway. That is the same set of rows the old
 * model-name list happened to cover, reached by the property that explains them, so it will
 * not re-break when a gateway next refreshes its catalogue.
 *
 * What the old list could not do was tell a legitimate unknown from a genuine gap, because
 * it matched on name. The route-based rule can: a pair that arrives through a route this
 * install has never heard of -- an empty provider, a near-miss like `kilo2` -- and matches no
 * family is still flagged. Note that a route in `PROVIDER_FALLBACK` can never produce an
 * unknown at all, since the fallback is consulted last and always answers; so the maker
 * routes are not the interesting case here, and an unrecognised one is.
 */
test('nothing in the live database falls to unknown except the known exceptions', (t) => {
  if (!existsSync(DB_PATH)) return t.skip('no local database yet');

  const db = openForeignRo(DB_PATH);
  const rows = db
    .prepare(
      `SELECT DISTINCT COALESCE(model,'') AS model, COALESCE(provider,'') AS provider
         FROM usage_event WHERE model IS NOT NULL`,
    )
    .all() as Array<{ model: string; provider: string }>;
  db.close();

  const unattributable = (row: { model: string; provider: string }) =>
    GATEWAYS.has(row.provider.toLowerCase().trim()) ||
    MODEL_ALLOWLIST.some((re) => re.test(row.model));

  const unexpected = rows
    .filter((r) => vendorOf(r.model, r.provider) === 'unknown')
    .filter((r) => !unattributable(r))
    .map((r) => `${r.model} via ${r.provider}`);

  assert.deepEqual(unexpected, [], 'these models need a vendor rule, or a gateway entry');

  /*
   * Keeps the assertion above from going vacuous. Every model this install has ever seen
   * arriving through a gateway would satisfy it, and a rule that quietly stopped matching
   * would never be noticed -- so require that real, attributable traffic exists here for
   * the mapping to have been checked against at all.
   */
  const attributable = rows.filter((r) => vendorOf(r.model, r.provider) !== 'unknown');
  assert.ok(
    attributable.length > 0,
    'expected some attributable models, or this test cannot detect a broken rule',
  );
  assert.ok(
    attributable.some((r) => !GATEWAYS.has(r.provider.toLowerCase().trim())),
    'expected traffic that a vendor rule had to resolve, not only gateway traffic',
  );
});

test('openDb still works on a throwaway path (vendor changes touch no schema)', () => {
  const db = openDb(join(tmpRoot(), 'vendor.db'));
  assert.ok(db.prepare('SELECT 1 AS ok').get());
  db.close();
});
