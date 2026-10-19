# Whole-group read cost diagnosis88

## Measured facts

Actual current detailedAggregates(model) on the same deterministic161200-row/1265-pair/120-session in-memory fixture. One invocation of each original read and one of its local SQL intervention; no app edits. Total original invocation (including EXPLAIN instrumentation) 5301.858ms. Rows: 7590; groups: 1265. All synthetic model names are unknown-family fallthroughs for vendor CASE; this deliberately exercises many CASE alternatives and is not claimed representative of the real user's model mix.

| Read | Original execution ms | Without redundant vendor grouping ms | Exact result equality | JSON bytes |
|---|---:|---:|---|---:|
| totals | 153.430 | 142.947 | deepEqual passed | 357 |
| groups | 2581.416 | 287.748 | deepEqual passed | 501738 |
| source-effort rows | 2562.971 | 534.613 | deepEqual passed | 3507309 |

The totals read has no vendor GROUP BY term and was intentionally unchanged as a control. Prepare times were 0.155, 0.464, 0.403ms respectively. Timing excludes JavaScript JSON serialization; original executions preceded interventions (warm-cache/order effects remain). No new SLO or comparative release performance claim.

## Causal evidence and limits

- No correlated subquery appears in these three reads or their EXPLAIN plans. They perform three independent same-scope reads of usage_event/source/session. DISTINCT sessions and grouped/order outputs require temporary B-trees.
- Groups and source/effort rows redundantly GROUP BY vendor, a CASE expression derived solely from model/provider which are already grouped with binary exact identity semantics. SQLite evaluates that GROUP BY expression for incoming observations. Removing just this redundant term retains selected vendor expression and every FACT, and the observed exact equality plus runtime intervention isolates avoidable per-observation vendor classification work on this fixture.
- This intervention does not eliminate three reads, DISTINCT aggregation, source/effort cardinality, whole-list transport, or vendor-filter predicate evaluation. The expensive expression is still required per observation if scope.vendor is supplied through usageWhere. Large-result growth remains open.
- Synthetic fixture has null/empty route identities, source/grain mix, varying call_count, known-zero tokens, repeated sessions and effort groups; all cost_source values are unknown. Mixed pricing/negative/null/known-zero monetary cases must be covered before applying an equivalent production rewrite.

## Bounded next change proposal

Remove vendor only from GROUP BY terms where exact model AND provider are already present (model groups and detailed source/effort rows; project detailed rows also qualify, but scope can remain model-only if preferred). Preserve SQL vendorSqlCase in SELECT, all usageWhere predicates, joins, FACTS, ORDER BY, transaction, response schema and full cardinality. This changes neither persisted data nor attribution rules.

Why equivalent: vendorSqlCase is a deterministic scalar expression of u.model and u.provider, including NULL/empty fallback. Each group already has one exact model/provider tuple, so vendor cannot split it further. Same input rows and FACTS preserve COUNT DISTINCT sessions, call_count, grain filtering, price buckets, nullable sums, zeros and lastObservedAt. Do not derive higher-level totals by adding subgroup session counts; sessions overlap. Do not replace SQL mapping with vendorOf JS, whose implementation is not assumed bit-identical. No cache or persisted vendor migration is needed.

Before implementation, use focused equivalence cases for null vs empty vs literal Unknown, same model across providers, binary case/whitespace, multiple sources/efforts/projects/sessions, all grains and vendor filters, mixed native/computed/estimated/unknown costs (including zeros/nulls), tie ordering and empty scope. Compare complete responses exactly under the same snapshot.

## Exact query evidence

Detailed source LF SHA256: 2fc9334a65f912db4b34a473b14c4684f8b3be7c9ddf934d226ca9048cde19c1. Vendor mapping LF SHA256: 83fa05d0e95e06f0bc125075792a7506e39c3c8f5cd3d97f402aeb9df4a2bd99. Params: {"from":1700000000000,"to":1700001800000}.

### totals

Original EXPLAIN:

```json
[
  {
    "id": 3,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 8,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 18,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 21,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  }
]
```

Intervention EXPLAIN:

```json
[
  {
    "id": 3,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 8,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 18,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 21,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  }
]
```

Original SQL:

```sql
SELECT COUNT(*) AS records,
  COALESCE(SUM(u.call_count),0) AS calls,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(u.output_tokens),0) AS outputTokens,
  COALESCE(SUM(u.total_tokens),0) AS tokens,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reported_native_usd,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS native_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computed_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimated_calls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknown_calls,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cache_saving_known_usd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cache_saving_known_calls,
  MAX(u.ts) AS lastObservedAt FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE u.ts >= @from AND u.ts < @to
```

Only SQL replacement: none (totals control).

### groups

Original EXPLAIN:

```json
[
  {
    "id": 10,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 20,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 23,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  },
  {
    "id": 28,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR GROUP BY"
  },
  {
    "id": 1104,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 1107,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR ORDER BY"
  }
]
```

Intervention EXPLAIN:

```json
[
  {
    "id": 10,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 20,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 23,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  },
  {
    "id": 28,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR GROUP BY"
  },
  {
    "id": 1102,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 1105,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR ORDER BY"
  }
]
```

Original SQL:

```sql
SELECT u.model, u.provider, CASE WHEN LOWER(u.model) LIKE 'anthropic/%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'openai/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'google/%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek/%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'qwen/%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'meta/%' THEN 'meta' WHEN LOWER(u.model) LIKE 'mistral/%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'nvidia/%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'xiaomi/%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE 'inclusionai/%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'poolside/%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'moonshot/%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'stepfun/%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'minimax/%' THEN 'minimax' WHEN LOWER(u.model) LIKE 'xai/%' THEN 'xai' WHEN LOWER(u.model) LIKE 'zai/%' THEN 'zai' WHEN LOWER(u.model) LIKE 'nous/%' THEN 'nous' WHEN LOWER(u.model) LIKE 'cohere/%' THEN 'cohere' WHEN LOWER(u.model) LIKE 'amazon/%' THEN 'amazon' WHEN LOWER(u.model) LIKE 'microsoft/%' THEN 'microsoft' WHEN LOWER(u.model) LIKE 'ibm/%' THEN 'ibm' WHEN LOWER(u.model) LIKE 'baidu/%' THEN 'baidu' WHEN LOWER(u.model) LIKE 'tencent/%' THEN 'tencent' WHEN LOWER(u.model) LIKE 'bytedance/%' THEN 'bytedance' WHEN LOWER(u.model) LIKE 'upstage/%' THEN 'upstage' WHEN LOWER(u.model) LIKE 'liquid/%' THEN 'liquid' WHEN LOWER(u.model) LIKE 'perplexity/%' THEN 'perplexity' WHEN LOWER(u.model) LIKE 'ai2/%' THEN 'ai2' WHEN LOWER(u.model) LIKE 'tii/%' THEN 'tii' WHEN LOWER(u.model) LIKE 'lg/%' THEN 'lg' WHEN LOWER(u.model) LIKE 'internlm/%' THEN 'internlm' WHEN LOWER(u.model) LIKE 'baichuan/%' THEN 'baichuan' WHEN LOWER(u.model) LIKE 'zeroone/%' THEN 'zeroone' WHEN LOWER(u.model) LIKE 'anthropic/%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'openai/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'openai-codex/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'google/%' THEN 'google' WHEN LOWER(u.model) LIKE 'google-vertex/%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek/%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'mistral/%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'xai/%' THEN 'xai' WHEN LOWER(u.model) LIKE 'zai/%' THEN 'zai' WHEN LOWER(u.model) LIKE 'claude-%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'claude.%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'claude %' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'gpt%' THEN 'openai' WHEN LOWER(u.model) LIKE 'codex%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o1-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o3-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o4-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'chatgpt%' THEN 'openai' WHEN LOWER(u.model) LIKE 'davinci%' THEN 'openai' WHEN LOWER(u.model) LIKE 'dall-e%' THEN 'openai' WHEN LOWER(u.model) LIKE 'whisper%' THEN 'openai' WHEN LOWER(u.model) LIKE 'text-embedding%' THEN 'openai' WHEN LOWER(u.model) LIKE 'gemini%' THEN 'google' WHEN LOWER(u.model) LIKE 'gemma%' THEN 'google' WHEN LOWER(u.model) LIKE 'palm%' THEN 'google' WHEN LOWER(u.model) LIKE 'imagen%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'qwen%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'qwq%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'qvq%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'llama%' THEN 'meta' WHEN LOWER(u.model) LIKE 'codellama%' THEN 'meta' WHEN LOWER(u.model) LIKE 'mistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'mixtral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'codestral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'magistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'devstral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'ministral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'nemotron%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'nvidia%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'mimo%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE 'ling-%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'ling.%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'laguna%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'poolside%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'kimi%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'moonshot%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'step-%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'step_%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'stepfun%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'minimax%' THEN 'minimax' WHEN LOWER(u.model) LIKE 'grok%' THEN 'xai' WHEN LOWER(u.model) LIKE 'glm%' THEN 'zai' WHEN LOWER(u.model) LIKE 'chatglm%' THEN 'zai' WHEN LOWER(u.model) LIKE 'hermes%' THEN 'nous' WHEN LOWER(u.model) LIKE '%/claude-%' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/claude.%' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/claude %' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/gpt%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/codex%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o1-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o3-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o4-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/chatgpt%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/davinci%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/dall-e%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/whisper%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/text-embedding%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/gemini%' THEN 'google' WHEN LOWER(u.model) LIKE '%/gemma%' THEN 'google' WHEN LOWER(u.model) LIKE '%/palm%' THEN 'google' WHEN LOWER(u.model) LIKE '%/imagen%' THEN 'google' WHEN LOWER(u.model) LIKE '%/deepseek%' THEN 'deepseek' WHEN LOWER(u.model) LIKE '%/qwen%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/qwq%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/qvq%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/llama%' THEN 'meta' WHEN LOWER(u.model) LIKE '%/codellama%' THEN 'meta' WHEN LOWER(u.model) LIKE '%/mistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/mixtral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/codestral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/magistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/devstral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/ministral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/nemotron%' THEN 'nvidia' WHEN LOWER(u.model) LIKE '%/nvidia%' THEN 'nvidia' WHEN LOWER(u.model) LIKE '%/mimo%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE '%/ling-%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE '%/ling.%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE '%/laguna%' THEN 'poolside' WHEN LOWER(u.model) LIKE '%/poolside%' THEN 'poolside' WHEN LOWER(u.model) LIKE '%/kimi%' THEN 'moonshot' WHEN LOWER(u.model) LIKE '%/moonshot%' THEN 'moonshot' WHEN LOWER(u.model) LIKE '%/step-%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/step_%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/stepfun%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/minimax%' THEN 'minimax' WHEN LOWER(u.model) LIKE '%/grok%' THEN 'xai' WHEN LOWER(u.model) LIKE '%/glm%' THEN 'zai' WHEN LOWER(u.model) LIKE '%/chatglm%' THEN 'zai' WHEN LOWER(u.model) LIKE '%/hermes%' THEN 'nous' WHEN LOWER(u.provider) = 'anthropic' THEN 'anthropic' WHEN LOWER(u.provider) = 'openai' THEN 'openai' WHEN LOWER(u.provider) = 'openai-codex' THEN 'openai' WHEN LOWER(u.provider) = 'google' THEN 'google' WHEN LOWER(u.provider) = 'google-vertex' THEN 'google' WHEN LOWER(u.provider) = 'deepseek' THEN 'deepseek' WHEN LOWER(u.provider) = 'mistral' THEN 'mistral' WHEN LOWER(u.provider) = 'xai' THEN 'xai' WHEN LOWER(u.provider) = 'zai' THEN 'zai' ELSE 'unknown' END AS vendor, COUNT(*) AS records,
  COALESCE(SUM(u.call_count),0) AS calls,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(u.output_tokens),0) AS outputTokens,
  COALESCE(SUM(u.total_tokens),0) AS tokens,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reported_native_usd,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS native_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computed_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimated_calls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknown_calls,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cache_saving_known_usd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cache_saving_known_calls,
  MAX(u.ts) AS lastObservedAt FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE u.ts >= @from AND u.ts < @to
      GROUP BY u.model, u.provider, vendor ORDER BY tokens DESC, model ASC, provider ASC
```

Only SQL replacement: remove final vendor term from GROUP BY; all other text unchanged.

### source-effort rows

Original EXPLAIN:

```json
[
  {
    "id": 10,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 20,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 23,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  },
  {
    "id": 28,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR GROUP BY"
  },
  {
    "id": 1116,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 1119,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR ORDER BY"
  }
]
```

Intervention EXPLAIN:

```json
[
  {
    "id": 10,
    "parent": 0,
    "notused": 162,
    "detail": "SEARCH u USING INDEX idx_usage_ts (ts>? AND ts<?)"
  },
  {
    "id": 20,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH s USING INTEGER PRIMARY KEY (rowid=?)"
  },
  {
    "id": 23,
    "parent": 0,
    "notused": 45,
    "detail": "SEARCH sess USING INTEGER PRIMARY KEY (rowid=?) LEFT-JOIN"
  },
  {
    "id": 28,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR GROUP BY"
  },
  {
    "id": 1114,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR count(DISTINCT)"
  },
  {
    "id": 1117,
    "parent": 0,
    "notused": 0,
    "detail": "USE TEMP B-TREE FOR ORDER BY"
  }
]
```

Original SQL:

```sql
SELECT u.model, u.provider, CASE WHEN LOWER(u.model) LIKE 'anthropic/%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'openai/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'google/%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek/%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'qwen/%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'meta/%' THEN 'meta' WHEN LOWER(u.model) LIKE 'mistral/%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'nvidia/%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'xiaomi/%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE 'inclusionai/%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'poolside/%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'moonshot/%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'stepfun/%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'minimax/%' THEN 'minimax' WHEN LOWER(u.model) LIKE 'xai/%' THEN 'xai' WHEN LOWER(u.model) LIKE 'zai/%' THEN 'zai' WHEN LOWER(u.model) LIKE 'nous/%' THEN 'nous' WHEN LOWER(u.model) LIKE 'cohere/%' THEN 'cohere' WHEN LOWER(u.model) LIKE 'amazon/%' THEN 'amazon' WHEN LOWER(u.model) LIKE 'microsoft/%' THEN 'microsoft' WHEN LOWER(u.model) LIKE 'ibm/%' THEN 'ibm' WHEN LOWER(u.model) LIKE 'baidu/%' THEN 'baidu' WHEN LOWER(u.model) LIKE 'tencent/%' THEN 'tencent' WHEN LOWER(u.model) LIKE 'bytedance/%' THEN 'bytedance' WHEN LOWER(u.model) LIKE 'upstage/%' THEN 'upstage' WHEN LOWER(u.model) LIKE 'liquid/%' THEN 'liquid' WHEN LOWER(u.model) LIKE 'perplexity/%' THEN 'perplexity' WHEN LOWER(u.model) LIKE 'ai2/%' THEN 'ai2' WHEN LOWER(u.model) LIKE 'tii/%' THEN 'tii' WHEN LOWER(u.model) LIKE 'lg/%' THEN 'lg' WHEN LOWER(u.model) LIKE 'internlm/%' THEN 'internlm' WHEN LOWER(u.model) LIKE 'baichuan/%' THEN 'baichuan' WHEN LOWER(u.model) LIKE 'zeroone/%' THEN 'zeroone' WHEN LOWER(u.model) LIKE 'anthropic/%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'openai/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'openai-codex/%' THEN 'openai' WHEN LOWER(u.model) LIKE 'google/%' THEN 'google' WHEN LOWER(u.model) LIKE 'google-vertex/%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek/%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'mistral/%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'xai/%' THEN 'xai' WHEN LOWER(u.model) LIKE 'zai/%' THEN 'zai' WHEN LOWER(u.model) LIKE 'claude-%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'claude.%' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'claude %' THEN 'anthropic' WHEN LOWER(u.model) LIKE 'gpt%' THEN 'openai' WHEN LOWER(u.model) LIKE 'codex%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o1-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o3-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'o4-%' THEN 'openai' WHEN LOWER(u.model) LIKE 'chatgpt%' THEN 'openai' WHEN LOWER(u.model) LIKE 'davinci%' THEN 'openai' WHEN LOWER(u.model) LIKE 'dall-e%' THEN 'openai' WHEN LOWER(u.model) LIKE 'whisper%' THEN 'openai' WHEN LOWER(u.model) LIKE 'text-embedding%' THEN 'openai' WHEN LOWER(u.model) LIKE 'gemini%' THEN 'google' WHEN LOWER(u.model) LIKE 'gemma%' THEN 'google' WHEN LOWER(u.model) LIKE 'palm%' THEN 'google' WHEN LOWER(u.model) LIKE 'imagen%' THEN 'google' WHEN LOWER(u.model) LIKE 'deepseek%' THEN 'deepseek' WHEN LOWER(u.model) LIKE 'qwen%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'qwq%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'qvq%' THEN 'qwen' WHEN LOWER(u.model) LIKE 'llama%' THEN 'meta' WHEN LOWER(u.model) LIKE 'codellama%' THEN 'meta' WHEN LOWER(u.model) LIKE 'mistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'mixtral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'codestral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'magistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'devstral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'ministral%' THEN 'mistral' WHEN LOWER(u.model) LIKE 'nemotron%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'nvidia%' THEN 'nvidia' WHEN LOWER(u.model) LIKE 'mimo%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE 'ling-%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'ling.%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE 'laguna%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'poolside%' THEN 'poolside' WHEN LOWER(u.model) LIKE 'kimi%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'moonshot%' THEN 'moonshot' WHEN LOWER(u.model) LIKE 'step-%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'step_%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'stepfun%' THEN 'stepfun' WHEN LOWER(u.model) LIKE 'minimax%' THEN 'minimax' WHEN LOWER(u.model) LIKE 'grok%' THEN 'xai' WHEN LOWER(u.model) LIKE 'glm%' THEN 'zai' WHEN LOWER(u.model) LIKE 'chatglm%' THEN 'zai' WHEN LOWER(u.model) LIKE 'hermes%' THEN 'nous' WHEN LOWER(u.model) LIKE '%/claude-%' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/claude.%' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/claude %' THEN 'anthropic' WHEN LOWER(u.model) LIKE '%/gpt%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/codex%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o1-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o3-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/o4-%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/chatgpt%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/davinci%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/dall-e%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/whisper%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/text-embedding%' THEN 'openai' WHEN LOWER(u.model) LIKE '%/gemini%' THEN 'google' WHEN LOWER(u.model) LIKE '%/gemma%' THEN 'google' WHEN LOWER(u.model) LIKE '%/palm%' THEN 'google' WHEN LOWER(u.model) LIKE '%/imagen%' THEN 'google' WHEN LOWER(u.model) LIKE '%/deepseek%' THEN 'deepseek' WHEN LOWER(u.model) LIKE '%/qwen%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/qwq%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/qvq%' THEN 'qwen' WHEN LOWER(u.model) LIKE '%/llama%' THEN 'meta' WHEN LOWER(u.model) LIKE '%/codellama%' THEN 'meta' WHEN LOWER(u.model) LIKE '%/mistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/mixtral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/codestral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/magistral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/devstral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/ministral%' THEN 'mistral' WHEN LOWER(u.model) LIKE '%/nemotron%' THEN 'nvidia' WHEN LOWER(u.model) LIKE '%/nvidia%' THEN 'nvidia' WHEN LOWER(u.model) LIKE '%/mimo%' THEN 'xiaomi' WHEN LOWER(u.model) LIKE '%/ling-%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE '%/ling.%' THEN 'inclusionai' WHEN LOWER(u.model) LIKE '%/laguna%' THEN 'poolside' WHEN LOWER(u.model) LIKE '%/poolside%' THEN 'poolside' WHEN LOWER(u.model) LIKE '%/kimi%' THEN 'moonshot' WHEN LOWER(u.model) LIKE '%/moonshot%' THEN 'moonshot' WHEN LOWER(u.model) LIKE '%/step-%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/step_%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/stepfun%' THEN 'stepfun' WHEN LOWER(u.model) LIKE '%/minimax%' THEN 'minimax' WHEN LOWER(u.model) LIKE '%/grok%' THEN 'xai' WHEN LOWER(u.model) LIKE '%/glm%' THEN 'zai' WHEN LOWER(u.model) LIKE '%/chatglm%' THEN 'zai' WHEN LOWER(u.model) LIKE '%/hermes%' THEN 'nous' WHEN LOWER(u.provider) = 'anthropic' THEN 'anthropic' WHEN LOWER(u.provider) = 'openai' THEN 'openai' WHEN LOWER(u.provider) = 'openai-codex' THEN 'openai' WHEN LOWER(u.provider) = 'google' THEN 'google' WHEN LOWER(u.provider) = 'google-vertex' THEN 'google' WHEN LOWER(u.provider) = 'deepseek' THEN 'deepseek' WHEN LOWER(u.provider) = 'mistral' THEN 'mistral' WHEN LOWER(u.provider) = 'xai' THEN 'xai' WHEN LOWER(u.provider) = 'zai' THEN 'zai' ELSE 'unknown' END AS vendor, u.source_id AS sourceId,
       s.harness, s.display_name AS sourceName, u.effort, COUNT(*) AS records,
  COALESCE(SUM(u.call_count),0) AS calls,
  COUNT(DISTINCT sess.id) AS sessions,
  COALESCE(SUM(u.input_tokens),0) AS inputTokens,
  COALESCE(SUM(u.cached_input_tokens),0) AS cachedInputTokens,
  COALESCE(SUM(u.cache_write_tokens),0) AS cacheWriteTokens,
  COALESCE(SUM(u.output_tokens),0) AS outputTokens,
  COALESCE(SUM(u.total_tokens),0) AS tokens,
  COALESCE(SUM(CASE WHEN u.cost_source='native' THEN u.cost_usd ELSE 0 END),0) AS reported_native_usd,
  COALESCE(SUM(CASE WHEN u.cost_source IN ('computed','estimated') THEN u.cost_usd ELSE 0 END),0) AS api_value_usd,
  COALESCE(SUM(CASE WHEN u.cost_source='native' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS native_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='computed' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS computed_calls,
  COALESCE(SUM(CASE WHEN u.cost_source='estimated' AND u.cost_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS estimated_calls,
  COALESCE(SUM(CASE WHEN u.cost_usd IS NULL OR u.cost_source NOT IN ('native','computed','estimated') THEN u.call_count ELSE 0 END),0) AS unknown_calls,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.cost_cache_saving_usd ELSE 0 END),0) AS cache_saving_known_usd,
  COALESCE(SUM(CASE WHEN u.cost_cache_saving_usd IS NOT NULL THEN u.call_count ELSE 0 END),0) AS cache_saving_known_calls,
  MAX(u.ts) AS lastObservedAt FROM usage_event u JOIN source s ON s.id=u.source_id
    LEFT JOIN session sess ON sess.id=u.session_id WHERE u.ts >= @from AND u.ts < @to
      GROUP BY u.model, u.provider, u.source_id, u.effort, vendor ORDER BY tokens DESC, model ASC, provider ASC, sourceId ASC, effort ASC
```

Only SQL replacement: remove final vendor term from GROUP BY; all other text unchanged.
