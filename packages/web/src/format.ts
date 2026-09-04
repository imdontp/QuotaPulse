export function tokens(n: number): string {
  if (n == null || Number.isNaN(n)) return '--';
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return String(Math.round(n));
}

/** Split so the unit suffix can be set smaller than the figure. */
export function tokensParts(n: number): { value: string; unit: string } {
  if (n == null || Number.isNaN(n)) return { value: '--', unit: '' };
  if (n >= 1e9) return { value: (n / 1e9).toFixed(2), unit: 'B' };
  if (n >= 1e6) return { value: (n / 1e6).toFixed(1), unit: 'M' };
  if (n >= 1e3) return { value: (n / 1e3).toFixed(1), unit: 'k' };
  return { value: String(Math.round(n)), unit: '' };
}

export function money(n: number | null | undefined, unknownCalls = 0): string {
  if (n == null) return '--';
  const s = n >= 100 ? `$${Math.round(n).toLocaleString()}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
  // Never let an unpriced call quietly read as $0.
  return unknownCalls > 0 ? `${s}+` : s;
}

export function pct(n: number | null | undefined): string {
  return n == null ? '--' : `${Math.round(n)}%`;
}

/** Compact age, e.g. "3s", "12m", "2.3d". Drives the staleness badges. */
export function age(seconds: number | null | undefined): string {
  if (seconds == null) return 'unknown';
  if (seconds < 90) return `${Math.max(0, Math.round(seconds))}s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)}m`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1)}h`;
  return `${(seconds / 86400).toFixed(1)}d`;
}

export function freshness(seconds: number | null | undefined): 'live' | 'recent' | 'stale' {
  if (seconds == null) return 'stale';
  if (seconds < 120) return 'live';
  if (seconds < 3600) return 'recent';
  return 'stale';
}

export function countdown(toMs: number | null | undefined, now = Date.now()): string {
  if (!toMs) return '--';
  const d = toMs - now;
  if (d <= 0) return 'now';
  const h = Math.floor(d / 3_600_000);
  const m = Math.floor((d % 3_600_000) / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function clock(ms: number | null | undefined): string {
  if (!ms) return '--';
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function windowLabel(kind: string): string {
  switch (kind) {
    case '5h':
      return '5-hour';
    case 'weekly':
      return 'Weekly';
    case 'weekly_opus':
      return 'Weekly (Opus)';
    case 'weekly_sonnet':
      return 'Weekly (Sonnet)';
    default:
      return kind;
  }
}

/** How long each quota window covers. Mirrors the tray's rule; see packages/tray/src/limits.ts. */
const WINDOW_SPAN_MS: Record<string, number> = {
  '5h': 5 * 3_600_000,
  weekly: 7 * 86_400_000,
  weekly_opus: 7 * 86_400_000,
  weekly_sonnet: 7 * 86_400_000,
  session: 5 * 3_600_000,
};

/**
 * A reading is void when it can no longer describe the CURRENT window: either its
 * window rolled over, or it is older than the window itself. Claude's cached config
 * fallback publishes a percentage with no reset time at all, and a two-day-old "0%"
 * cannot be a statement about a five-hour window.
 */
export function isExpired(
  l: { resets_at: number | null; window_kind: string; ageSeconds: number | null },
  now = Date.now(),
): boolean {
  if (l.resets_at != null && l.resets_at <= now) return true;
  const span = WINDOW_SPAN_MS[l.window_kind];
  if (span != null && l.ageSeconds != null && l.ageSeconds * 1000 > span) return true;
  return false;
}

/** The shape every consumer of a quota reading needs; `Limit` from the API satisfies it. */
interface Readingish {
  source_id: number;
  window_kind: string;
  origin: string;
  resets_at: number | null;
  ageSeconds: number | null;
  burn?: { projectedFullAt: number | null } | null;
}

export interface WindowReadings<T> {
  /** The reading actually in force for this window. */
  primary: T;
  /** Other origins reporting the same window, ranked behind the primary. */
  superseded: T[];
}

/**
 * Collapse a flat list of readings to one per (source, window).
 *
 * `/api/limits` returns one row per (source, window, ORIGIN) on purpose -- Claude
 * publishes the same window through a live statusline and a cached config file that can
 * be days stale, and the API refuses to decide which one you meant. Every surface that
 * shows a window therefore has to collapse them, and for a while only two of five did:
 * the Limits table listed all four rows for a two-window source, and the alert bell was
 * one data coincidence away from naming the same window twice.
 *
 * The rule is freshness, never a league table of origins: a reading that still describes
 * the current window beats one that has rolled over, and among equals the youngest wins.
 * Nothing here knows that `claude.json` exists, so a new origin needs no code change.
 */
export function primaryLimits<T extends Readingish>(
  readings: T[],
  now = Date.now(),
): Array<WindowReadings<T>> {
  const byWindow = new Map<string, T[]>();
  for (const r of readings) {
    const key = `${r.source_id}:${r.window_kind}`;
    if (!byWindow.has(key)) byWindow.set(key, []);
    byWindow.get(key)!.push(r);
  }

  const out: Array<WindowReadings<T>> = [];
  for (const group of byWindow.values()) {
    const sorted = [...group].sort((a, b) => {
      const ea = isExpired(a, now) ? 1 : 0;
      const eb = isExpired(b, now) ? 1 : 0;
      if (ea !== eb) return ea - eb;
      return (a.ageSeconds ?? 1e12) - (b.ageSeconds ?? 1e12);
    });
    const [primary, ...superseded] = sorted;
    if (primary) out.push({ primary, superseded });
  }
  return out;
}

/**
 * The one thing worth interrupting for: a window that runs out before it resets.
 *
 * Written out separately in three places before this existed, which is how the bell's
 * own docblock came to claim it was shared with the Limits table when it was not.
 */
export function willExhaust(l: Readingish, now = Date.now()): boolean {
  return (
    !isExpired(l, now) &&
    l.burn?.projectedFullAt != null &&
    l.resets_at != null &&
    l.burn.projectedFullAt < l.resets_at
  );
}

export function severityOf(p: number | null | undefined): 'ok' | 'warn' | 'crit' {
  if (p == null) return 'ok';
  if (p >= 85) return 'crit';
  if (p >= 60) return 'warn';
  return 'ok';
}

const SERIES_VARS = [
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--chart-6',
  '--chart-7',
  '--chart-8',
];

export const OTHER_LABEL = 'other';
const OTHER_COLOR = 'oklch(0.62 0.02 285)';

/**
 * Distinct colours assigned by RANK over a known set, so neighbouring segments never
 * collide. Names beyond the palette collapse into a single neutral "other" bucket
 * rather than silently reusing a colour that already means something else.
 *
 * Rank, never a hash of the name. There used to be a `seriesColor()` that hashed, and it
 * had the flaw this exists to avoid: with more names than palette slots, two ADJACENT
 * segments could land on the same colour and the bar became unreadable. Its callers now
 * either rank through here or use `vendorColor()`, so it is gone.
 *
 * Use this for a series that is NOT one vendor -- a model, a harness, a project. Where
 * the series is a maker, `vendorColor()` says more.
 */
export function palette(namesByRank: string[]): {
  colorOf: (name: string) => string;
  keep: Set<string>;
  hasOther: boolean;
} {
  const keep = new Set(namesByRank.slice(0, SERIES_VARS.length));
  const map = new Map<string, string>();
  [...keep].forEach((n, i) => map.set(n, `var(${SERIES_VARS[i % SERIES_VARS.length]})`));
  return {
    colorOf: (name) => map.get(name) ?? OTHER_COLOR,
    keep,
    hasOther: namesByRank.length > keep.size,
  };
}

/** Effort is ordinal, so it gets a sequential ramp rather than categorical colours. */
const EFFORT_ORDER = ['none', 'low', 'medium', 'high', 'max', 'xhigh'];

export function effortRank(effort: string): number {
  const i = EFFORT_ORDER.indexOf(effort || 'none');
  return i < 0 ? 0 : i;
}

export function effortColor(effort: string): string {
  const ramp = [
    'oklch(0.55 0.02 285)',
    'oklch(0.50 0.16 293)',
    'oklch(0.58 0.19 293)',
    'oklch(0.65 0.19 293)',
    'oklch(0.72 0.16 293)',
    'oklch(0.82 0.11 293)',
  ];
  return ramp[effortRank(effort)] ?? ramp[0]!;
}

export const effortLabel = (e: string): string => e || 'none reported';

/**
 * The bar colour for a vendor: its own brand hue, defined in `vendor-colors.css`.
 *
 * Preferred over `palette()` wherever a series IS a vendor, or maps one-to-one onto a
 * single vendor. That is what makes a colour mean something: every
 * Claude bar is Anthropic's orange on Cost, on Trend and in the project breakdown, so
 * the same fact seen from three sides looks like the same fact.
 *
 * NOT used where one bar can hold several models from one maker -- see EffortByModel in
 * effort-breakdown.tsx, where colouring by vendor would merge two adjacent Claude
 * segments into one indistinguishable block.
 *
 * The fallback matters: a vendor the daemon knows but the generator has no mark for
 * would otherwise paint `transparent` and vanish. `--vendor-unknown` is a near-grey, so
 * it also reads correctly as "we could not identify the maker".
 */
export const vendorColor = (vendor: string): string =>
  `var(--vendor-${vendor || 'unknown'}, var(--vendor-unknown))`;

/**
 * A vendor's colour, stepped by reasoning effort.
 *
 * Mixed toward `--track` rather than toward black or white, so the direction is right on
 * both themes without a branch: on light the track is near-white and low effort washes
 * out, on dark it is near-black and low effort recedes. Either way the strongest colour
 * means the most effort.
 *
 * `rank` is measured against the GLOBAL effort scale, not the levels present in one row,
 * so "medium" is the same shade on every bar and rows can be read against each other.
 *
 * The 65% floor is measured, not chosen for looks: a segment at the low end of the ramp
 * still borders the empty track at the end of a bar, and below 65% the palest step fell
 * to 1.62:1 against it -- under the floor every solid bar is held to, and under the
 * weakest colour the old palette shipped. At 65% the worst case is 1.85:1.
 */
export const vendorShade = (vendor: string, rank: number, maxRank: number): string => {
  const t = maxRank > 0 ? Math.min(1, Math.max(0, rank / maxRank)) : 1;
  return `color-mix(in oklab, ${vendorColor(vendor)} ${Math.round(65 + 35 * t)}%, var(--track))`;
};

/**
 * Vendor display names, mirroring packages/daemon/src/util/vendor.ts. The daemon decides
 * WHICH vendor a model belongs to and sends the id; this only turns that id into a label.
 */
export const VENDOR_LABELS: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  meta: 'Meta',
  mistral: 'Mistral',
  nvidia: 'NVIDIA',
  xiaomi: 'Xiaomi',
  inclusionai: 'InclusionAI',
  poolside: 'Poolside',
  moonshot: 'Moonshot',
  stepfun: 'StepFun',
  minimax: 'MiniMax',
  xai: 'xAI',
  zai: 'Z.ai',
  nous: 'Nous Research',
  opencode: 'OpenCode',
  openrouter: 'OpenRouter',
  ollama: 'Ollama',
  cohere: 'Cohere',
  amazon: 'Amazon',
  microsoft: 'Microsoft',
  ibm: 'IBM',
  baidu: 'Baidu',
  tencent: 'Tencent',
  bytedance: 'ByteDance',
  upstage: 'Upstage',
  liquid: 'Liquid AI',
  perplexity: 'Perplexity',
  ai2: 'Ai2',
  tii: 'TII',
  lg: 'LG AI',
  internlm: 'InternLM',
  baichuan: 'Baichuan',
  zeroone: '01.AI',
  unknown: 'Unknown',
};

export const vendorLabel = (id: string): string => VENDOR_LABELS[id] ?? id;
