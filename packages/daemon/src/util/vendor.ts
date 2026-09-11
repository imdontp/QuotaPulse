/**
 * Who MADE a model, as opposed to which gateway it was routed through.
 *
 * The `provider` recorded on a usage event is whatever the harness called its route:
 * `deepseek-v4-flash-free` arrives tagged `opencode`, `poolside/laguna-m.1:free` arrives
 * tagged `kilo` or `openrouter`, and Hermes labels OpenAI traffic `openai-codex`. Filtering
 * or branding on that column would offer no "DeepSeek" at all, so vendor is derived instead.
 *
 * Deliberately NOT stored as a column: it is a pure function of (model, provider), and a
 * stored copy would go stale the moment these rules improve.
 */

export interface Vendor {
  id: string;
  label: string;
}

export const VENDORS: Record<string, Vendor> = {
  anthropic: { id: 'anthropic', label: 'Anthropic' },
  openai: { id: 'openai', label: 'OpenAI' },
  google: { id: 'google', label: 'Google' },
  deepseek: { id: 'deepseek', label: 'DeepSeek' },
  qwen: { id: 'qwen', label: 'Qwen' },
  meta: { id: 'meta', label: 'Meta' },
  mistral: { id: 'mistral', label: 'Mistral' },
  nvidia: { id: 'nvidia', label: 'NVIDIA' },
  xiaomi: { id: 'xiaomi', label: 'Xiaomi' },
  inclusionai: { id: 'inclusionai', label: 'InclusionAI' },
  poolside: { id: 'poolside', label: 'Poolside' },
  moonshot: { id: 'moonshot', label: 'Moonshot' },
  stepfun: { id: 'stepfun', label: 'StepFun' },
  minimax: { id: 'minimax', label: 'MiniMax' },
  xai: { id: 'xai', label: 'xAI' },
  zai: { id: 'zai', label: 'Z.ai' },
  nous: { id: 'nous', label: 'Nous Research' },
  opencode: { id: 'opencode', label: 'OpenCode' },
  openrouter: { id: 'openrouter', label: 'OpenRouter' },
  ollama: { id: 'ollama', label: 'Ollama' },

  /*
   * Makers we have not seen locally yet, carried so that the first model from one
   * arrives with its own name and logo instead of a letter box. Taken from the model
   * creators Artificial Analysis tracks, filtered to those the icon set actually has a
   * mark for -- an entry with no mark would be a rename of `unknown`, not an upgrade.
   */
  cohere: { id: 'cohere', label: 'Cohere' },
  amazon: { id: 'amazon', label: 'Amazon' },
  microsoft: { id: 'microsoft', label: 'Microsoft' },
  ibm: { id: 'ibm', label: 'IBM' },
  baidu: { id: 'baidu', label: 'Baidu' },
  tencent: { id: 'tencent', label: 'Tencent' },
  bytedance: { id: 'bytedance', label: 'ByteDance' },
  upstage: { id: 'upstage', label: 'Upstage' },
  liquid: { id: 'liquid', label: 'Liquid AI' },
  perplexity: { id: 'perplexity', label: 'Perplexity' },
  ai2: { id: 'ai2', label: 'Ai2' },
  tii: { id: 'tii', label: 'TII' },
  lg: { id: 'lg', label: 'LG AI' },
  internlm: { id: 'internlm', label: 'InternLM' },
  baichuan: { id: 'baichuan', label: 'Baichuan' },
  zeroone: { id: 'zeroone', label: '01.AI' },

  unknown: { id: 'unknown', label: 'Unknown' },
};

/**
 * Matched in order against the LOWERCASED model name. First hit wins, so put the more
 * specific prefix above the looser one (`gpt-oss` is Meta-hosted OpenAI weights, but the
 * `openai/` path prefix settles it before we get here).
 */
const MODEL_RULES: Array<[RegExp, string]> = [
  [/^claude[-.]/, 'anthropic'],
  [/^(gpt|codex|o[1-9]|chatgpt|davinci|dall-e|whisper|text-embedding)/, 'openai'],
  [/^(gemini|gemma|palm|imagen)/, 'google'],
  [/^deepseek/, 'deepseek'],
  [/^(qwen|qwq|qvq)/, 'qwen'],
  [/^(llama|codellama)/, 'meta'],
  [/^(mistral|mixtral|codestral|magistral|devstral|ministral)/, 'mistral'],
  [/^(nemotron|nvidia)/, 'nvidia'],
  [/^mimo/, 'xiaomi'],
  [/^ling[-.]/, 'inclusionai'],
  [/^(laguna|poolside)/, 'poolside'],
  [/^(kimi|moonshot)/, 'moonshot'],
  [/^(step|stepfun)/, 'stepfun'],
  [/^minimax/, 'minimax'],
  [/^grok/, 'xai'],
  [/^(glm|chatglm)/, 'zai'],
  [/^hermes/, 'nous'],

  /*
   * Makers not yet seen in this install. Appended rather than interleaved so the
   * rules above keep their exact precedence: every one of these is a family name no
   * earlier rule matches, and adding them cannot change how an existing model routes.
   */
  [/^(command|aya)[-.]/, 'cohere'],
  [/^(nova-(micro|lite|pro|premier)|titan-|amazon[-.])/, 'amazon'],
  [/^phi[-.]?\d/, 'microsoft'],
  [/^granite[-.]/, 'ibm'],
  [/^ernie[-.]/, 'baidu'],
  [/^hunyuan/, 'tencent'],
  [/^(doubao|seed-oss)/, 'bytedance'],
  [/^solar[-.]/, 'upstage'],
  [/^lfm[-.]?\d/, 'liquid'],
  [/^sonar/, 'perplexity'],
  [/^(olmo|molmo|tulu)/, 'ai2'],
  [/^falcon[-.]?\d?/, 'tii'],
  [/^exaone/, 'lg'],
  [/^internlm/, 'internlm'],
  [/^baichuan/, 'baichuan'],
  [/^yi-/, 'zeroone'],
];

/**
 * Routes that make no models of their own.
 *
 * A gateway must never become a model's vendor. `muse-spark-1.2-contributor-free` arrives
 * tagged `opencode` and `openrouter/free` carries the router in its own name, and
 * treating either as the maker put OpenCode's and OpenRouter's logos on models they did
 * not build -- the exact confusion the vendor/provider split at the top of this file
 * exists to prevent. When the model name says nothing and the only other clue is a
 * gateway, the honest answer is `unknown`.
 *
 * These ids stay in `VENDORS` because a gateway is still a real brand elsewhere:
 * `vendorOfHarness` uses them to badge the SOURCE cards, where OpenCode genuinely is the
 * tool doing the work.
 */
const GATEWAYS = new Set(['opencode', 'opencode-free', 'openrouter', 'ollama', 'kilo']);

/** A routing provider only decides the vendor when the model name itself said nothing. */
const PROVIDER_FALLBACK: Record<string, string> = {
  anthropic: 'anthropic',
  openai: 'openai',
  'openai-codex': 'openai',
  google: 'google',
  'google-vertex': 'google',
  deepseek: 'deepseek',
  mistral: 'mistral',
  xai: 'xai',
  zai: 'zai',
};

/**
 * `vendor/model` (the OpenRouter and Kilo convention) states the vendor outright, so it
 * is checked before any name pattern.
 */
function fromPathPrefix(model: string): string | null {
  const slash = model.indexOf('/');
  if (slash <= 0) return null;
  const head = model.slice(0, slash).toLowerCase();
  // A gateway in the prefix names the route, not the maker; keep looking.
  if (VENDORS[head] && !GATEWAYS.has(head)) return head;
  if (PROVIDER_FALLBACK[head]) return PROVIDER_FALLBACK[head]!;
  // The tail may still name a known family, e.g. `openai/gpt-oss-120b:free`.
  return matchModelName(model.slice(slash + 1));
}

function matchModelName(model: string): string | null {
  const m = model.toLowerCase().trim();
  for (const [re, vendor] of MODEL_RULES) if (re.test(m)) return vendor;
  return null;
}

export function vendorOf(model: string | null | undefined, provider?: string | null): string {
  if (model) {
    const viaPrefix = fromPathPrefix(model);
    if (viaPrefix) return viaPrefix;
    const viaName = matchModelName(model);
    if (viaName) return viaName;
  }
  const p = (provider ?? '').toLowerCase().trim();
  return PROVIDER_FALLBACK[p] ?? 'unknown';
}

/** Harness -> the vendor whose product it is, for branding a source row. */
export function vendorOfHarness(harness: string): string {
  switch (harness) {
    case 'claude-code':
      return 'anthropic';
    case 'codex':
      return 'openai';
    case 'openai-account':
      return 'openai';
    case 'opencode':
      return 'opencode';
    case 'hermes':
      return 'nous';
    default:
      return 'unknown';
  }
}

export const vendorLabel = (id: string): string => VENDORS[id]?.label ?? id;

function sqlLiteral(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/** The harness mapping as SQL, generated from the same switch so the two cannot drift. */
export function harnessVendorSqlCase(harnessCol: string): string {
  const known = ['claude-code', 'codex', 'opencode', 'hermes', 'openai-account'];
  const parts = known.map(
    (h) => `WHEN ${harnessCol} = ${sqlLiteral(h)} THEN ${sqlLiteral(vendorOfHarness(h))}`,
  );
  return `CASE ${parts.join(' ')} ELSE 'unknown' END`;
}

/**
 * The same rules as a SQL `CASE` expression, so `GROUP BY vendor` runs in the database
 * instead of shipping every (bucket, model) row to the client to be folded in JS.
 *
 * Generated from the tables above rather than hand-written: two copies of this mapping
 * would drift, and the SQL copy is the one nobody would think to update.
 */
export function vendorSqlCase(modelCol: string, providerCol: string): string {
  const parts: string[] = [];

  // 1. `vendor/model` prefix.
  for (const id of Object.keys(VENDORS)) {
    if (id === 'unknown' || GATEWAYS.has(id)) continue;
    parts.push(`WHEN LOWER(${modelCol}) LIKE ${sqlLiteral(id + '/%')} THEN ${sqlLiteral(id)}`);
  }
  for (const [prefix, vendor] of Object.entries(PROVIDER_FALLBACK)) {
    parts.push(`WHEN LOWER(${modelCol}) LIKE ${sqlLiteral(prefix + '/%')} THEN ${sqlLiteral(vendor)}`);
  }

  // 2. Model-name families. LIKE patterns mirror the anchored regexes above.
  const likeFamilies: Array<[string[], string]> = [
    [['claude-', 'claude.'], 'anthropic'],
    [['gpt%', 'codex%', 'o1-%', 'o3-%', 'o4-%', 'chatgpt%', 'davinci%', 'dall-e%', 'whisper%', 'text-embedding%'], 'openai'],
    [['gemini%', 'gemma%', 'palm%', 'imagen%'], 'google'],
    [['deepseek%'], 'deepseek'],
    [['qwen%', 'qwq%', 'qvq%'], 'qwen'],
    [['llama%', 'codellama%'], 'meta'],
    [['mistral%', 'mixtral%', 'codestral%', 'magistral%', 'devstral%', 'ministral%'], 'mistral'],
    [['nemotron%', 'nvidia%'], 'nvidia'],
    [['mimo%'], 'xiaomi'],
    [['ling-%', 'ling.%'], 'inclusionai'],
    [['laguna%', 'poolside%'], 'poolside'],
    [['kimi%', 'moonshot%'], 'moonshot'],
    [['step-%', 'step_%', 'stepfun%'], 'stepfun'],
    [['minimax%'], 'minimax'],
    [['grok%'], 'xai'],
    [['glm%', 'chatglm%'], 'zai'],
    [['hermes%'], 'nous'],
  ];
  for (const [patterns, vendor] of likeFamilies) {
    for (const pat of patterns) {
      const like = pat.endsWith('%') ? pat : pat + '%';
      parts.push(`WHEN LOWER(${modelCol}) LIKE ${sqlLiteral(like)} THEN ${sqlLiteral(vendor)}`);
    }
  }

  // 2b. The same families after an UNRECOGNISED `something/` prefix. `%/name%` still
  // requires the family to start immediately after a slash, which is what the TypeScript
  // does by matching the tail. Without this, `nousresearch/hermes-3-...` fell through to
  // its routing provider and the two implementations disagreed.
  for (const [patterns, vendor] of likeFamilies) {
    for (const pat of patterns) {
      const like = pat.endsWith('%') ? pat : pat + '%';
      parts.push(`WHEN LOWER(${modelCol}) LIKE ${sqlLiteral('%/' + like)} THEN ${sqlLiteral(vendor)}`);
    }
  }

  // 3. Routing provider as the last resort.
  for (const [prov, vendor] of Object.entries(PROVIDER_FALLBACK)) {
    parts.push(`WHEN LOWER(${providerCol}) = ${sqlLiteral(prov)} THEN ${sqlLiteral(vendor)}`);
  }

  return `CASE ${parts.join(' ')} ELSE 'unknown' END`;
}
