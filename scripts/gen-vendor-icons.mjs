/**
 * Generate the offline vendor and harness icon modules from @lobehub/icons-static-svg.
 *
 * The marks are baked into the repo rather than imported at runtime: this dashboard is
 * offline by design, so it must not depend on a package (or a CDN) being reachable when
 * the page loads. Re-run after adding a vendor or harness:
 *
 *   node scripts/gen-vendor-icons.mjs
 *
 * Source: https://github.com/lobehub/lobe-icons (MIT). simple-icons was the obvious
 * alternative and could not be used -- it carries no OpenAI mark, which is the second
 * largest vendor most people using this will have.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');
const ICON_DIR = join(REPO, 'node_modules', '@lobehub', 'icons-static-svg', 'icons');
const OUT = join(REPO, 'packages', 'web', 'src', 'components', 'vendor-icon.tsx');
const HARNESS_OUT = join(REPO, 'packages', 'web', 'src', 'components', 'harness-icon.tsx');

/*
 * vendor id (see packages/daemon/src/util/vendor.ts) -> icon slug in the package.
 *
 * `color: true` pulls `<slug>-color.svg`, which paints the real brand colours. Where it
 * is false the brand mark genuinely IS monochrome (Anthropic, OpenAI, xAI, Ollama and
 * friends ship a black/white mark) -- rendering those with currentColor is correct brand
 * usage, not a shortcut, and it is the only way they stay legible in both themes.
 */
const MAP = {
  // Claude is Anthropic's coloured mark (#D97757) and every Anthropic model here is a
  // claude-*, so it is both more colourful and more accurate than the corporate burst.
  anthropic: { slug: 'claude', color: true },
  openai: { slug: 'openai', color: false },
  /*
   * The company mark, not the Gemini spark: Gemini is one product line and Gemma is
   * another, and five of the six Google models seen here are Gemma. The G covers both.
   */
  google: { slug: 'google', color: true },
  deepseek: { slug: 'deepseek', color: true },
  qwen: { slug: 'qwen', color: true },
  meta: { slug: 'meta', color: true },
  mistral: { slug: 'mistral', color: true },
  /*
   * Measured 2.5:1 on the light theme -- below the 3:1 the table flags -- because the
   * whole mark is one mid green (#74B71B) on white. Kept in colour deliberately: it is
   * legible, unlike the marks that earned a colorIn override (OpenRouter reads 1.2:1,
   * i.e. effectively invisible), the green IS the brand, and the mark never appears
   * without its label beside it. Revisit if the light background ever darkens.
   */
  nvidia: { slug: 'nvidia', color: true },
  // No plain Xiaomi mark is published; MiMo is exactly the model family in use here.
  xiaomi: { slug: 'xiaomimimo', color: false },
  /*
   * MoonshotAI's own mark. This used to point at `kimi`, which is one of their products
   * -- a different logo for a different thing. The company mark is monochrome, which as
   * a bonus retires the colorIn workaround the Kimi mark needed: its glyph is #fff with
   * no backing shape and disappeared entirely on the light theme.
   */
  moonshot: { slug: 'moonshot', color: false },
  stepfun: { slug: 'stepfun', color: true },
  minimax: { slug: 'minimax', color: true },
  xai: { slug: 'xai', color: false },
  /*
   * `zai.svg` is titled "Z.ai" and matches the vendor label exactly; `zhipu` is the
   * company's pre-rebrand identity. Monochrome (no colour variant is published) and
   * only three subpaths, so it stays crisp at 13px where a busier mark would not.
   */
  zai: { slug: 'zai', color: false },
  /*
   * Upstream ships this same artwork under both `nousresearch` and `hermesagent`, so it
   * is the right brand. The official asset has a black/transparent edge around a white
   * field and a black portrait; `frame: 'nous'` preserves that composition instead of
   * flattening the mark into a white glyph on the dark theme.
   */
  nous: { slug: 'nousresearch', color: false, frame: 'nous' },
  ollama: { slug: 'ollama', color: false },
  // The colour mark is a bare #C8FF00 lime glyph with no backing shape: unreadable on
  // white, but perfectly legible on the dark theme, so it gets its colour back there.
  openrouter: { slug: 'openrouter', color: true, colorIn: 'dark' },
  /*
   * A parent-company stand-in, like `anthropic` above but less exact: InclusionAI is Ant
   * Group's open-source arm, not Ant Group. The icon set ships no InclusionAI or Ling
   * mark at all -- and `kling` is Kuaishou's video model, a different company entirely,
   * so it must never be substituted here.
   */
  inclusionai: { slug: 'antgroup', color: true },
  poolside: { slug: 'poolside', color: true },
  opencode: { slug: 'opencode', color: false },

  /*
   * Makers with no local usage yet -- see the matching block in the daemon's VENDORS.
   * Wired up now so the first model from one of them renders a real logo rather than
   * a letter, and so the drift check below has something to check against.
   *
   * `provisional` says this maker has never been seen in this install. It buys nothing
   * visually; it tells the colour pass that these must yield to the vendors already on
   * screen rather than crowd them off their own brand colour.
   *
   * The colorIn values are measured, not guessed: run the generator and read the contrast
   * table. Baidu, LG, Tencent and TII publish marks too dark to read on the dark theme;
   * Amazon, Baichuan, Perplexity and 01.AI publish ones too pale for the light theme.
   */
  cohere: { slug: 'cohere', color: true, provisional: true },
  amazon: { slug: 'aws', color: true, provisional: true, colorIn: 'dark' },
  microsoft: { slug: 'microsoft', color: true, provisional: true },
  ibm: { slug: 'ibm', color: false, provisional: true },
  baidu: { slug: 'baidu', color: true, provisional: true, colorIn: 'light' },
  tencent: { slug: 'tencent', color: true, provisional: true, colorIn: 'light' },
  bytedance: { slug: 'bytedance', color: true, provisional: true },
  upstage: { slug: 'upstage', color: true, provisional: true },
  liquid: { slug: 'liquid', color: false, provisional: true },
  perplexity: { slug: 'perplexity', color: true, provisional: true, colorIn: 'dark' },
  ai2: { slug: 'ai2', color: true, provisional: true },
  tii: { slug: 'tii', color: true, provisional: true, colorIn: 'light' },
  lg: { slug: 'lg', color: true, provisional: true, colorIn: 'light' },
  internlm: { slug: 'internlm', color: true, provisional: true },
  baichuan: { slug: 'baichuan', color: true, provisional: true, colorIn: 'dark' },
  zeroone: { slug: 'zeroone', color: true, provisional: true, colorIn: 'dark' },
};

/*
 * Harness marks answer a different question from vendor marks: which tool recorded the
 * usage, not who made the model. Keep this map separate so adding Hermes cannot weaken
 * the vendor/provider distinction in packages/daemon/src/util/vendor.ts.
 */
const HARNESS_MAP = {
  hermes: { slug: 'hermesagent', frame: 'nous' },
};

/*
 * The bar colour for each vendor, as a HUE. Everything else about the colour -- how
 * light, how saturated -- is decided per theme below, which is what lets a brand colour
 * be both recognisable and legible on two backgrounds.
 *
 * `brand` is a hex that MUST appear in that vendor's own artwork; the generator asserts
 * it, so if upstream redraws a mark and drops the colour, this fails loudly instead of
 * quietly painting the wrong brand. Where a mark uses exactly one colour, no entry is
 * needed and it is taken automatically.
 *
 * `hue` is a degree we chose ourselves. It is used only for brands whose mark is
 * genuinely monochrome, so there is no brand colour to read: OpenAI, xAI and friends
 * publish a black/white logo and nothing else. These are OUR colours, not theirs, and
 * they exist so that eight vendors are not eight identical grey bars. They are placed in
 * the arcs the real brand colours leave empty (roughly 140-250, which no mark occupies).
 */
const BRAND_COLOR = {
  // Picked from the mark: the blue G, not the red/yellow/green of the other three
  // quarters, which would read as a different company entirely.
  google: { brand: '#4285f4' },
  // The signature amber at the top of Mistral's gradient. The deeper #fa500f in the same
  // artwork measures 37.2 degrees, 1.6 from Anthropic's 38.8 -- indistinguishable side by
  // side, where the amber is both further away and more recognisably Mistral.
  mistral: { brand: '#ffaf00' },
  qwen: { brand: '#6336e7' },
  // Fifteen shades of one blue in the artwork; this is the flat brand blue.
  meta: { brand: '#0064e0' },
  stepfun: { brand: '#01a9ff' },
  // The pink half of a pink/orange pair, and the half the brand leads with.
  minimax: { brand: '#e2167e' },
  inclusionai: { brand: '#1677ff' },
  poolside: { brand: '#4137ff' },

  /*
   * Newcomers. Same rule as above: the hex has to be in the artwork. Where a mark carries
   * a whole set -- Microsoft's four squares, Cohere's three -- the pick is the colour the
   * brand actually leads with, not the most saturated one in the file.
   */
  cohere: { brand: '#ff7759' },
  microsoft: { brand: '#00a4ef' },
  // The cyan half of the pair, which is both the more distinctive of the two and clear
  // of the blue arc where five other makers already sit.
  bytedance: { brand: '#00c8d2' },
  upstage: { brand: '#805dfa' },
  baichuan: { brand: '#fec13e' },

  // Monochrome marks: hues we assigned. See the docblock above.
  moonshot: { hue: 150 },
  zai: { hue: 170 },
  openai: { hue: 195 },
  nous: { hue: 225 },
  xai: { hue: 320 },
  ollama: { hue: 65 },
  opencode: { hue: 95 },
  // Xiaomi's real orange sits at ~42 degrees, right on top of Anthropic. Shifted down
  // into the gap below it rather than shipping two vendors the eye cannot tell apart.
  xiaomi: { hue: 20 },
  ibm: { hue: 235 },
  liquid: { hue: 185 },
};

/*
 * Fixed lightness and a chroma ceiling per theme, taken from the range the existing
 * --chart-* tokens already occupy (index.css: light 0.606-0.769, dark 0.702-0.828).
 *
 * Holding L constant across every vendor is what keeps the set coherent: hue then
 * carries brand identity and chroma breaks ties, and neither of those moves a bar's
 * visibility against its track.
 *
 * `track` is the --track token these bars are actually painted on, written in the same
 * OKLCH the stylesheet uses so the two cannot drift apart.
 */
const THEMES = {
  light: { L: 0.65, maxC: 0.19, track: { L: 0.955, C: 0, H: 0 }, dir: -1 },
  dark: { L: 0.75, maxC: 0.16, track: { L: 0.255, C: 0, H: 0 }, dir: +1 },
};

/*
 * A bar is a large solid block, not the thin stroke SC 1.4.11 sets 3:1 for, and the
 * palette being replaced here does not come close to 3:1 either: measured against
 * --track, the shipped --chart-* tokens run 1.88:1 to 3.68:1 on the light theme and have
 * always been perfectly readable. So the bar floor is the weakest colour that already
 * ships. Holding bars to the logo threshold instead sounds stricter but is worse -- it
 * drags every light-theme colour down until the brands are muddy and hard to tell apart,
 * which is the actual accessibility problem on a chart.
 *
 * The 3:1 in MIN_CONTRAST still governs the logo marks, where it belongs.
 */
const MIN_BAR_CONTRAST = 1.8;

/**
 * Two vendors are distinguishable if their hues are MIN_SEP apart, or -- when the circle
 * is too crowded for that -- if one is noticeably more muted than the other.
 */
const MIN_SEP = 14;
const MAX_SHIFT = 18;
const MUTE = 0.55;

if (!existsSync(ICON_DIR)) {
  console.error(`missing ${ICON_DIR}\nrun: npm i -D @lobehub/icons-static-svg`);
  process.exit(1);
}

/**
 * Pull the drawable part out of an SVG file.
 *
 * The body is emitted verbatim, in SVG's own kebab-case. It is injected with
 * `dangerouslySetInnerHTML`, NOT rendered as JSX, so it is parsed by the HTML parser --
 * which lowercases every attribute name it does not recognise. An earlier version
 * "helpfully" rewrote these into JSX camelCase, so `stop-color` reached the browser as
 * `stopcolor`, which is not an SVG attribute: every gradient stop lost its colour and
 * fell back to black. Qwen, StepFun, MiniMax and InclusionAI are painted by a single
 * gradient, so they rendered as solid black silhouettes; Gemini and Meta lost their
 * overlays the same way. `clip-path`, `fill-opacity`, `stop-opacity` and `fill-rule`
 * inside the body were silently inert for the same reason.
 *
 * Only the root <svg> is real JSX, so `fillRule` is extracted separately for it.
 */
function extract(svgText) {
  const viewBox = /viewBox="([^"]+)"/.exec(svgText)?.[1] ?? '0 0 24 24';
  const openTagEnd = svgText.indexOf('>');
  let body = svgText.slice(openTagEnd + 1).replace(/<\/svg>\s*$/, '');
  body = body.replace(/<title>[\s\S]*?<\/title>/g, '').trim();
  const fillRule = /fill-rule="([^"]+)"/.exec(svgText)?.[1];
  return { viewBox, body, fillRule };
}

/**
 * Namespace every id in a mark so two vendors' gradients can never resolve to each
 * other. Applied to BOTH bodies: the monochrome one carries upstream ids too (Poolside
 * ships five), and the same mark is rendered dozens of times down a table.
 */
function namespaceIds(body, vendor, variant) {
  const ids = [...body.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  let out = body;
  for (const id of new Set(ids)) {
    const safe = `quotapulse-${vendor}-${variant}-${id}`.replace(/[^a-zA-Z0-9_-]/g, '-');
    out = out.split(`id="${id}"`).join(`id="${safe}"`);
    out = out.split(`url(#${id})`).join(`url(#${safe})`);
  }
  return out;
}

/*
 * Contrast, so "is this legible on that background" is a measured answer rather than a
 * guess. Backgrounds are the resolved values of the theme tokens in
 * packages/web/src/index.css: --card on light (line 15, oklch(1 0 0) = white) and
 * --background on dark (line 50, oklch(0.145 0 0)). WCAG 2.1 SC 1.4.11 asks 3:1 for a
 * graphical object.
 */
const BG_LIGHT = '#ffffff';
const BG_DARK = '#181818';
const MIN_CONTRAST = 3;

function srgbToLinear(c) {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}

function contrast(hexA, hexB) {
  const [a, b] = [luminance(hexA), luminance(hexB)];
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/* --- OKLCH, so "same lightness, different hue" is a thing we can actually compute. --- */

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

function linearize(v) {
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function delinearize(v) {
  return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

function rgbToOklch(rgb) {
  const [r, g, b] = rgb.map(linearize);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  let H = (Math.atan2(B, A) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C: Math.hypot(A, B), H };
}

/** Linear-light sRGB, deliberately unclamped: out-of-range channels are the gamut test. */
function oklchToLinearRgb({ L, C, H }) {
  const h = (H * Math.PI) / 180;
  const A = C * Math.cos(h);
  const B = C * Math.sin(h);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((v) => v >= -0.0001 && v <= 1.0001);

/**
 * Drop chroma until the colour is representable, keeping L and H exactly.
 *
 * The browser would gamut-map an out-of-range oklch() itself, by rules that differ
 * between engines. Doing it here means the hex this script MEASURES contrast on is the
 * colour the page actually paints -- otherwise the report would be about a colour no
 * user ever sees.
 */
function clipToGamut(c) {
  if (inGamut(oklchToLinearRgb(c))) return c;
  let lo = 0;
  let hi = c.C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinearRgb({ ...c, C: mid }))) lo = mid;
    else hi = mid;
  }
  return { ...c, C: lo };
}

function oklchToHex(c) {
  const rgb = oklchToLinearRgb(clipToGamut(c));
  return (
    '#' +
    rgb
      .map((v) => {
        const n = Math.round(Math.min(1, Math.max(0, delinearize(v))) * 255);
        return n.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

const fmtOklch = (c) =>
  `oklch(${c.L.toFixed(3)} ${c.C.toFixed(3)} ${((((c.H % 360) + 360) % 360)).toFixed(1)})`;

/** Signed shortest distance from a to b around the hue circle. */
function hueDelta(a, b) {
  return ((((b - a) % 360) + 540) % 360) - 180;
}

/**
 * Push hues apart until neighbours are at least MIN_SEP degrees apart, without letting
 * any vendor drift more than MAX_SHIFT from its real brand hue.
 *
 * Relaxation rather than redistribution: a vendor whose hue is already lonely does not
 * move at all, so most brands keep their exact colour and only the crowded arcs give.
 * Five of the twelve measured brands land between 258.8 and 272.7 degrees -- Meta,
 * InclusionAI, Google, DeepSeek and Poolside are all essentially the same blue -- so
 * without this the chart would be less readable than the generic palette it replaces,
 * not more.
 */
function separateHues(items) {
  const start = new Map(items.map((it) => [it.id, it.hue]));
  const cur = new Map(start);
  const order = (ids) =>
    [...cur.entries()].filter(([id]) => ids.has(id)).sort((a, b) => a[1] - b[1]);

  const relax = (ids, shiftOf) => {
    for (let pass = 0; pass < 400; pass++) {
      const sorted = order(ids);
      let moved = false;
      for (let i = 0; i < sorted.length; i++) {
        const [idA, hA] = sorted[i];
        const [idB, hB] = sorted[(i + 1) % sorted.length];
        const gap = Math.abs(hueDelta(hA, hB));
        if (gap >= MIN_SEP - 1e-6) continue;
        const push = (MIN_SEP - gap) / 2;
        const clamp = (id, h) => {
          const limit = shiftOf(id);
          if (limit === 0) return cur.get(id);
          const s0 = start.get(id);
          const off = Math.max(-limit, Math.min(limit, hueDelta(s0, h)));
          return (((s0 + off) % 360) + 360) % 360;
        };
        const a = clamp(idA, hA - push);
        const b = clamp(idB, hB + push);
        if (a !== cur.get(idA) || b !== cur.get(idB)) moved = true;
        cur.set(idA, a);
        cur.set(idB, b);
      }
      if (!moved) break;
    }
  };

  /*
   * Two phases, because the makers actually in use must not be pushed around by makers
   * that have never appeared. Phase one settles the established vendors among themselves;
   * phase two pins those and lets the newcomers find the gaps left over. Wire up a
   * sixteenth speculative brand and Anthropic's orange does not move a degree.
   */
  const settled = new Set(items.filter((it) => !it.provisional).map((it) => it.id));
  const all = new Set(items.map((it) => it.id));
  relax(settled, () => MAX_SHIFT);
  relax(all, (id) => (settled.has(id) ? 0 : MAX_SHIFT));

  /*
   * Tightness is judged in the same two tiers, and for the same reason.
   *
   * Among the settled vendors it is a real constraint: they appear together on real
   * charts, so a pair the eye cannot split is a bug. Twenty of them fit on the circle
   * with room to spare.
   *
   * Thirty-six do not. Judging all of them at once made almost every pair tight, which
   * muted almost every colour -- including Anthropic's and Google's, to make room for
   * makers this install has never run. So a newcomer near an established vendor is the
   * newcomer's problem: it is the one that gets muted, and the established colour does
   * not move or fade.
   */
  const settledOrder = order(settled);
  const tight = new Set();
  let worst = 360;
  for (let i = 0; i < settledOrder.length && settledOrder.length > 1; i++) {
    const [idA, hA] = settledOrder[i];
    const [idB, hB] = settledOrder[(i + 1) % settledOrder.length];
    const gap = Math.abs(hueDelta(hA, hB));
    worst = Math.min(worst, gap);
    if (gap < MIN_SEP - 1e-6) {
      tight.add(idA);
      tight.add(idB);
    }
  }

  // A newcomer is muted if it lands within MIN_SEP of anything at all.
  const crowded = new Set();
  for (const [id, h] of cur) {
    if (settled.has(id)) continue;
    for (const [other, ho] of cur) {
      if (other === id) continue;
      if (Math.abs(hueDelta(h, ho)) < MIN_SEP - 1e-6) {
        crowded.add(id);
        break;
      }
    }
  }
  return { hues: cur, tight, crowded, worstGap: worst, start, settled };
}

const NAMED = { gold: '#ffd700', white: '#ffffff', black: '#000000', red: '#ff0000' };

/** Every colour a mark paints with, from both literal fills and gradient stops. */
function colorsIn(body) {
  const out = new Set();
  for (const m of body.matchAll(/(?:fill|stop-color)="([^"]+)"/g)) {
    const v = m[1].trim().toLowerCase();
    if (v.startsWith('#')) out.add(v);
    else if (NAMED[v]) out.add(NAMED[v]);
  }
  return [...out];
}

const entries = [];
const missing = [];
const contrast_rows = [];
/** vendor -> every colour its coloured mark paints with, for the brand-colour pick. */
const colorSets = new Map();
for (const [vendor, spec] of Object.entries(MAP)) {
  const colorFile = join(ICON_DIR, `${spec.slug}-color.svg`);
  const monoFile = join(ICON_DIR, `${spec.slug}.svg`);
  const wantColor = spec.color && existsSync(colorFile);
  const file = wantColor ? colorFile : monoFile;
  if (!existsSync(file)) {
    missing.push(`${vendor} (${spec.slug}.svg)`);
    continue;
  }
  // Always emit the monochrome body: the `mono` prop has to be a real switch, and a
  // root fill cannot override the hardcoded path fills inside a coloured mark.
  const monoSrc = extract(readFileSync(monoFile, 'utf8'));
  let colorBody = null;
  let contrastNote = '';
  if (wantColor) {
    const c = extract(readFileSync(colorFile, 'utf8'));
    colorBody = namespaceIds(c.body, vendor, 'c');
    const cols = colorsIn(colorBody);
    const onLight = cols.map((h) => contrast(h, BG_LIGHT));
    const onDark = cols.map((h) => contrast(h, BG_DARK));
    const best = (xs) => (xs.length ? Math.max(...xs) : 0);
    contrastNote =
      `light ${best(onLight).toFixed(1)}:1  dark ${best(onDark).toFixed(1)}:1  ` +
      `(${cols.length} colour${cols.length === 1 ? '' : 's'})`;
    contrast_rows.push({
      vendor,
      light: best(onLight),
      dark: best(onDark),
      colorIn: spec.colorIn ?? 'both',
      colors: cols,
    });
  }

  colorSets.set(vendor, colorBody ? colorsIn(colorBody) : []);

  entries.push({
    vendor,
    viewBox: monoSrc.viewBox,
    body: namespaceIds(monoSrc.body, vendor, 'm'),
    fillRule: monoSrc.fillRule,
    frame: spec.frame,
    colorBody,
    colorIn: wantColor ? (spec.colorIn ?? 'both') : null,
    contrastNote,
  });
}

const harnessEntries = [];
for (const [harness, spec] of Object.entries(HARNESS_MAP)) {
  const monoFile = join(ICON_DIR, `${spec.slug}.svg`);
  if (!existsSync(monoFile)) {
    console.error(`missing harness mark ${harness} (${spec.slug}.svg)`);
    process.exit(1);
  }
  const monoSrc = extract(readFileSync(monoFile, 'utf8'));
  harnessEntries.push({
    harness,
    viewBox: monoSrc.viewBox,
    body: namespaceIds(monoSrc.body, `harness-${harness}`, 'm'),
    fillRule: monoSrc.fillRule,
    frame: spec.frame,
  });
}

const lines = [];
lines.push('/* GENERATED by scripts/gen-vendor-icons.mjs -- do not edit by hand.');
lines.push(' *');
lines.push(' * Real brand marks, inlined so the dashboard stays offline. Sourced from');
lines.push(' * @lobehub/icons-static-svg (MIT). Brands that publish a colour mark carry their');
lines.push(' * own fills; the rest are genuinely monochrome and paint with currentColor.');
lines.push(' */');
lines.push("import type { SVGProps } from 'react';");
lines.push("import { cn } from '@/lib/utils';");
lines.push('');
lines.push('interface Mark {');
lines.push('  viewBox: string;');
lines.push('  body: string;');
lines.push('  /** Present when the brand publishes a colour mark; paints its own fills. */');
lines.push('  colorBody?: string;');
lines.push('  /**');
lines.push('   * Which themes the colour mark is legible on. A brand whose mark is near-white');
lines.push('   * or near-black only reads against one background, so it shows its colours');
lines.push('   * there and falls back to currentColor on the other.');
lines.push('   */');
lines.push('  colorIn?: "both" | "light" | "dark";');
lines.push('  fillRule?: string;');
lines.push('  /** Official composition used by marks that need a backing field to stay faithful. */');
lines.push('  frame?: "nous";');
lines.push('}');
lines.push('');
lines.push('const MARKS: Record<string, Mark> = {');
for (const e of entries) {
  lines.push(`  ${e.vendor}: {`);
  lines.push(`    viewBox: ${JSON.stringify(e.viewBox)},`);
  if (e.fillRule) lines.push(`    fillRule: ${JSON.stringify(e.fillRule)},`);
  lines.push(`    body: ${JSON.stringify(e.body)},`);
  if (e.frame) lines.push(`    frame: ${JSON.stringify(e.frame)},`);
  if (e.colorBody) lines.push(`    colorBody: ${JSON.stringify(e.colorBody)},`);
  if (e.colorIn && e.colorIn !== 'both') lines.push(`    colorIn: ${JSON.stringify(e.colorIn)},`);
  lines.push('  },');
}
lines.push('};');
lines.push('');
lines.push('export const hasVendorMark = (vendor: string): boolean => vendor in MARKS;');
lines.push('');
lines.push('export const isVendorMarkColored = (vendor: string): boolean =>');
lines.push('  MARKS[vendor]?.colorBody != null;');
lines.push('');
lines.push('export interface VendorIconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {');
lines.push('  vendor: string;');
lines.push('  /** Shown in the letter fallback when a vendor has no published mark. */');
lines.push('  label?: string;');
lines.push('  /**');
lines.push('   * Force the monochrome treatment. Used in chart legends, where a coloured');
lines.push('   * swatch beside the mark already carries the series mapping -- a brand colour');
lines.push('   * next to a different series colour reads as a contradiction.');
lines.push('   */');
lines.push('  mono?: boolean;');
lines.push('}');
lines.push('');
lines.push('/**');
lines.push(' * A vendor brand mark. Falls back to a lettered square ONLY for a vendor with no');
lines.push(' * published logo -- never as a shortcut for one we simply have not wired up.');
lines.push(' */');
lines.push('export function VendorIcon({ vendor, label, mono, className, ...rest }: VendorIconProps) {');
lines.push('  const mark = MARKS[vendor];');
lines.push('  if (!mark) {');
lines.push('    const letter = (label ?? vendor ?? "?").trim().charAt(0).toUpperCase() || "?";');
lines.push('    return (');
lines.push('      <span');
lines.push('        aria-hidden');
lines.push('        className={cn(');
lines.push('          "inline-flex size-[1em] shrink-0 items-center justify-center rounded-[3px]",');
lines.push('          "border border-current/25 text-[0.62em] leading-none font-semibold",');
lines.push('          className,');
lines.push('        )}');
lines.push('      >');
lines.push('        {letter}');
lines.push('      </span>');
lines.push('    );');
lines.push('  }');
lines.push('  // A coloured mark paints itself; forcing fill=currentColor would flatten it.');
lines.push('  const paintSelf = mark.colorBody != null && !mono;');
lines.push('  const draw = (body: string, self: boolean, extra?: string) => (');
lines.push('    <svg');
lines.push('      viewBox={mark.viewBox}');
lines.push('      width="1em"');
lines.push('      height="1em"');
lines.push('      {...(self ? {} : { fill: "currentColor" })}');
lines.push('      {...(mark.fillRule ? { fillRule: mark.fillRule as "evenodd" | "nonzero" } : {})}');
lines.push('      aria-hidden');
lines.push('      focusable="false"');
lines.push('      className={cn("inline-block size-[1em] shrink-0", extra, className)}');
lines.push('      dangerouslySetInnerHTML={{ __html: body }}');
lines.push('      {...rest}');
lines.push('    />');
lines.push('  );');
lines.push('');
lines.push('  /*');
lines.push('   * Nous publishes a black/transparent edge around a white field with a black');
lines.push('   * portrait. Keep the frame explicit so the mark does not become a white glyph');
lines.push('   * on dark surfaces or inherit an unrelated provider colour.');
lines.push('   */');
lines.push('  if (mark.frame === "nous") {');
lines.push('    return (');
lines.push('      <span');
lines.push('        aria-hidden');
lines.push('        className={cn(');
lines.push('          "inline-flex size-[1em] shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-black p-px",');
lines.push('          className,');
lines.push('        )}');
lines.push('      >');
lines.push('        <span className="inline-flex size-full items-center justify-center bg-white">');
lines.push('          <svg');
lines.push('            viewBox={mark.viewBox}');
lines.push('            width="1em"');
lines.push('            height="1em"');
lines.push('            fill="currentColor"');
lines.push('            {...(mark.fillRule ? { fillRule: mark.fillRule as "evenodd" | "nonzero" } : {})}');
lines.push('            aria-hidden');
lines.push('            focusable="false"');
lines.push('            className="size-[0.8em] shrink-0 text-black"');
lines.push('            dangerouslySetInnerHTML={{ __html: mark.body }}');
lines.push('            {...rest}');
lines.push('          />');
lines.push('        </span>');
lines.push('      </span>');
lines.push('    );');
lines.push('  }');
lines.push('');
lines.push('  /*');
lines.push('   * A mark that only reads on one background renders BOTH treatments, swapped by');
lines.push('   * CSS rather than by JavaScript. The theme is a class on <html> set before the');
lines.push('   * first paint, so a CSS swap is right on the very first frame -- reading the');
lines.push('   * theme in JS would flash the wrong mark on every load.');
lines.push('   */');
lines.push('  if (paintSelf && mark.colorIn && mark.colorIn !== "both") {');
lines.push('    const colorOnDark = mark.colorIn === "dark";');
lines.push('    return (');
lines.push('      <>');
lines.push('        {draw(mark.colorBody!, true, colorOnDark ? "hidden dark:inline-block" : "dark:hidden")}');
lines.push('        {draw(mark.body, false, colorOnDark ? "dark:hidden" : "hidden dark:inline-block")}');
lines.push('      </>');
lines.push('    );');
lines.push('  }');
lines.push('');
lines.push('  return draw(paintSelf ? mark.colorBody! : mark.body, paintSelf);');
lines.push('}');
lines.push('');

const harnessLines = [];
harnessLines.push('/* GENERATED by scripts/gen-vendor-icons.mjs -- do not edit by hand.');
harnessLines.push(' *');
harnessLines.push(' * Harness marks are kept separate from model-vendor marks so a source can');
harnessLines.push(' * identify the tool doing the work without mislabelling the model maker.');
harnessLines.push(' * The vector is inlined so the dashboard stays fully offline.');
harnessLines.push(' */');
harnessLines.push("import { cn } from '@/lib/utils';");
harnessLines.push("import { VendorIcon } from '@/components/vendor-icon';");
harnessLines.push('');
harnessLines.push('interface Mark {');
harnessLines.push('  viewBox: string;');
harnessLines.push('  body: string;');
harnessLines.push('  fillRule?: string;');
harnessLines.push('  frame?: "nous";');
harnessLines.push('}');
harnessLines.push('');
harnessLines.push('const HARNESSES: Record<string, Mark> = {');
for (const e of harnessEntries) {
  harnessLines.push(`  ${e.harness}: {`);
  harnessLines.push(`    viewBox: ${JSON.stringify(e.viewBox)},`);
  if (e.fillRule) harnessLines.push(`    fillRule: ${JSON.stringify(e.fillRule)},`);
  harnessLines.push(`    body: ${JSON.stringify(e.body)},`);
  if (e.frame) harnessLines.push(`    frame: ${JSON.stringify(e.frame)},`);
  harnessLines.push('  },');
}
harnessLines.push('};');
harnessLines.push('');
harnessLines.push('export interface HarnessIconProps {');
harnessLines.push('  harness: string;');
harnessLines.push('  /** Vendor that owns the harness when no dedicated harness mark exists. */');
harnessLines.push('  vendor?: string;');
harnessLines.push('  /** Shown by the vendor fallback when a harness/vendor has no published mark. */');
harnessLines.push('  label?: string;');
harnessLines.push('  className?: string;');
harnessLines.push('}');
harnessLines.push('');
harnessLines.push('/**');
harnessLines.push(' * A harness mark. Hermes uses the official Nous black/white composition so its');
harnessLines.push(' * detailed monochrome vector stays faithful and legible on dark surfaces.');
harnessLines.push(' * Other harnesses use the existing vendor mark supplied by the API.');
harnessLines.push(' */');
harnessLines.push('export function HarnessIcon({ harness, vendor, label, className }: HarnessIconProps) {');
harnessLines.push('  const mark = HARNESSES[harness];');
harnessLines.push('  if (!mark) {');
harnessLines.push('    return <VendorIcon vendor={vendor ?? "unknown"} label={label} className={className} />;');
harnessLines.push('  }');
harnessLines.push('');
harnessLines.push('  if (mark.frame === "nous") {');
harnessLines.push('    return <VendorIcon vendor="nous" label={label} className={className} />;');
harnessLines.push('  }');
harnessLines.push('');
harnessLines.push('  return (');
harnessLines.push('    <span');
harnessLines.push('      aria-hidden');
harnessLines.push('      className={cn(');
harnessLines.push('        "inline-flex size-[1.2em] shrink-0 items-center justify-center rounded-[4px] border border-neutral-500/60 bg-neutral-700 text-white",');
harnessLines.push('        className,');
harnessLines.push('        "text-white",');
harnessLines.push('      )}');
harnessLines.push('    >');
harnessLines.push('      <svg');
harnessLines.push('        viewBox={mark.viewBox}');
harnessLines.push('        width="1em"');
harnessLines.push('        height="1em"');
harnessLines.push('        fill="currentColor"');
harnessLines.push('        {...(mark.fillRule ? { fillRule: mark.fillRule as "evenodd" | "nonzero" } : {})}');
harnessLines.push('        aria-hidden');
harnessLines.push('        focusable="false"');
harnessLines.push('        className="size-[0.9em] shrink-0"');
harnessLines.push('        dangerouslySetInnerHTML={{ __html: mark.body }}');
harnessLines.push('      />');
harnessLines.push('    </span>');
harnessLines.push('  );');
harnessLines.push('}');
harnessLines.push('');

/*
 * The vendor list lives in three places -- VENDORS in the daemon, VENDOR_LABELS on the
 * web, and MAP here -- because each needs something different from it. Nothing used to
 * notice when they drifted, so a vendor could be routed by the daemon and then render a
 * letter box forever. Reading the daemon's list and failing on a mismatch makes that
 * impossible to ship.
 */
const VENDOR_TS = join(REPO, 'packages', 'daemon', 'src', 'util', 'vendor.ts');
const vendorBlock = /export const VENDORS[^{]*\{([\s\S]*?)\n\};/.exec(readFileSync(VENDOR_TS, 'utf8'));
if (!vendorBlock) {
  console.error(`could not read VENDORS from ${VENDOR_TS}`);
  process.exit(1);
}
const declared = [...vendorBlock[1].matchAll(/^\s{2}([a-z0-9_]+):/gm)].map((m) => m[1]);
// `unknown` is the deliberate absence of a vendor: it has no logo and no brand colour.
const expected = declared.filter((v) => v !== 'unknown');
const notMapped = expected.filter((v) => !(v in MAP));
const extra = Object.keys(MAP).filter((v) => !declared.includes(v));
if (notMapped.length || extra.length) {
  if (notMapped.length) console.error(`vendors in VENDORS but not in MAP: ${notMapped.join(', ')}`);
  if (extra.length) console.error(`vendors in MAP but not in VENDORS: ${extra.join(', ')}`);
  process.exit(1);
}

writeFileSync(OUT, lines.join('\n'), 'utf8');
writeFileSync(HARNESS_OUT, harnessLines.join('\n'), 'utf8');

console.log(`wrote ${OUT}`);
console.log(`wrote ${HARNESS_OUT}`);
const col = entries.filter((e) => e.colorBody).map((e) => e.vendor);
const mono = entries.filter((e) => !e.colorBody).map((e) => e.vendor);
console.log(`  ${col.length} in brand colour: ${col.join(', ')}`);
console.log(`  ${mono.length} monochrome (brand has no colour mark): ${mono.join(', ')}`);
console.log('');
console.log(`  contrast of each colour mark against the theme backgrounds (WCAG, want >= ${MIN_CONTRAST}:1)`);
console.log('  vendor          light     dark   colour used on');
for (const r of contrast_rows.sort((a, b) => a.vendor.localeCompare(b.vendor))) {
  const flag = (v, active) => (active && v < MIN_CONTRAST ? '!' : ' ');
  console.log(
    `  ${r.vendor.padEnd(13)}` +
      `${r.light.toFixed(1).padStart(5)}:1${flag(r.light, r.colorIn !== 'dark')} ` +
      `${r.dark.toFixed(1).padStart(6)}:1${flag(r.dark, r.colorIn !== 'light')}  ${r.colorIn}`,
  );
}
console.log('  ! = below the threshold on a theme where the colour mark is still used.');
console.log('  Figures are the BEST of a mark colour set, so a multi-colour mark can still');
console.log('  lose its dominant fill: evidence for the colorIn choice, not a verdict.');
if (missing.length) {
  console.log(`  NO MARK (will render a letter): ${missing.join(', ')}`);
}

/* ------------------------------------------------------------------ brand colours -- */

const COLORS_OUT = join(REPO, 'packages', 'web', 'src', 'vendor-colors.css');

/** The one hue that stands for a vendor, and where that hue came from. */
function brandHue(vendor) {
  const pick = BRAND_COLOR[vendor] ?? {};
  const cols = colorSets.get(vendor) ?? [];
  if (pick.brand) {
    // The pick has to still exist in the artwork, or we are painting a colour this brand
    // no longer uses. Shorthand is expanded so #06f and #0066ff compare equal.
    const expand = (h) =>
      h.length === 4 ? '#' + h.slice(1).split('').map((c) => c + c).join('') : h;
    const have = cols.map(expand);
    if (!have.includes(expand(pick.brand))) {
      console.error(
        `${vendor}: BRAND_COLOR ${pick.brand} is not in the mark any more (found ${have.join(', ') || 'no colours'})`,
      );
      process.exit(1);
    }
    return { hue: rgbToOklch(hexToRgb(pick.brand)).H, from: pick.brand };
  }
  if (pick.hue != null) return { hue: pick.hue, from: 'assigned' };
  if (cols.length === 1) return { hue: rgbToOklch(hexToRgb(cols[0])).H, from: cols[0] };
  console.error(
    `${vendor}: mark paints ${cols.length} colours (${cols.join(', ')}) -- add a BRAND_COLOR entry saying which one is the brand`,
  );
  process.exit(1);
}

const brandChroma = (vendor) => {
  const cols = colorSets.get(vendor) ?? [];
  if (cols.length === 0) return null; // monochrome mark: no chroma to preserve
  return Math.max(...cols.map((h) => rgbToOklch(hexToRgb(h)).C));
};

const vendorIds = entries.map((e) => e.vendor);
const sources = new Map(vendorIds.map((v) => [v, brandHue(v)]));
const { hues, tight, crowded, worstGap, start, settled } = separateHues(
  vendorIds.map((id) => ({ id, hue: sources.get(id).hue, provisional: !!MAP[id].provisional })),
);

/*
 * Chroma is the tie-breaker for the pairs hue could not separate: at a fixed lightness,
 * a vivid blue and a muted one are told apart easily, and unlike a lightness split it
 * cannot push a bar back under the contrast threshold.
 */
/*
 * Which of a tight pair gets muted. Alternating along the HUE order is what actually
 * separates neighbours -- alphabetical order would happily mute both halves of a pair.
 * A newcomer crowding an established vendor is always the one that gives way, so the
 * vendors on screen today keep their full-strength colour.
 */
const tightOrder = [...tight].sort((a, b) => hues.get(a) - hues.get(b));
const colorRows = [];
const css = { light: [], dark: [] };
let failures = 0;

for (const vendor of vendorIds) {
  const H = hues.get(vendor);
  const row = { vendor, from: sources.get(vendor).from, hue0: start.get(vendor), hue: H, tight: tight.has(vendor) };
  for (const [theme, cfg] of Object.entries(THEMES)) {
    let C = Math.min(cfg.maxC, brandChroma(vendor) ?? cfg.maxC);
    const muted = settled.has(vendor)
      ? tight.has(vendor) && tightOrder.indexOf(vendor) % 2 === 1
      : crowded.has(vendor);
    if (muted) C *= MUTE;
    let c = clipToGamut({ L: cfg.L, C, H });

    /*
     * Lightness is meant to be uniform, but Oklab L is perceptual and relative luminance
     * is not, so a saturated blue sits measurably darker than a yellow at the same L.
     * Nudge only the ones that actually miss the floor, and only as far as they need.
     */
    const trackHex = oklchToHex(cfg.track);
    let steps = 0;
    while (contrast(oklchToHex(c), trackHex) < MIN_BAR_CONTRAST && steps < 40) {
      c = clipToGamut({ ...c, L: c.L + cfg.dir * 0.01 });
      steps++;
    }
    const hex = oklchToHex(c);
    const ratio = contrast(hex, trackHex);
    if (ratio < MIN_BAR_CONTRAST) failures++;
    row[theme] = { hex, ratio, L: c.L, C: c.C, nudged: steps, muted };
    css[theme].push(`  --vendor-${vendor}: ${fmtOklch(c)};`);
  }
  colorRows.push(row);
}

/*
 * `unknown` is not a brand and must not look like one. It keeps a near-grey so that a
 * model whose maker we could not identify reads as exactly that, next to bars that do
 * carry a real identity.
 */
css.light.push('  --vendor-unknown: oklch(0.630 0.020 285);');
css.dark.push('  --vendor-unknown: oklch(0.750 0.020 285);');

const byName = (a, b) => a.localeCompare(b);
writeFileSync(
  COLORS_OUT,
  [
    '/* GENERATED by scripts/gen-vendor-icons.mjs -- do not edit by hand.',
    ' *',
    ' * One bar colour per vendor, so a model keeps the same colour on every page and that',
    ' * colour belongs to its maker. Hue comes from the brand mark and is nudged only where',
    ' * two brands would otherwise be the same colour; lightness is fixed per theme, which',
    ' * is what keeps the set coherent and every bar visible against --track.',
    ' *',
    ` * Run the generator for the measurements: hue moved, chroma, contrast on both themes.`,
    ` * Nothing here sits below ${MIN_BAR_CONTRAST}:1 against the track it is painted on.`,
    ' *',
    ' * Swapped by the .dark class rather than by JavaScript: the theme is set on <html>',
    ' * before first paint, so a CSS swap is already correct on the very first frame.',
    ' */',
    ':root {',
    ...css.light.sort(byName),
    '}',
    '',
    '.dark {',
    ...css.dark.sort(byName),
    '}',
    '',
  ].join('\n'),
  'utf8',
);

console.log('');
console.log(`wrote ${COLORS_OUT}`);
console.log(`  bar colour per vendor: hue from the mark, lightness fixed per theme (want >= ${MIN_BAR_CONTRAST}:1 on --track)`);
console.log('  vendor         source     hue      ->      light            dark');
for (const r of colorRows.sort((a, b) => a.hue - b.hue)) {
  const moved = Math.abs(hueDelta(r.hue0, r.hue));
  console.log(
    `  ${r.vendor.padEnd(13)} ${String(r.from).padEnd(10)}` +
      `${r.hue0.toFixed(0).padStart(4)}${moved >= 0.5 ? `->${r.hue.toFixed(0).padStart(4)}` : '      '}   ` +
      `${r.light.hex} ${r.light.ratio.toFixed(1)}:1${r.light.nudged ? '*' : ' '}  ` +
      `${r.dark.hex} ${r.dark.ratio.toFixed(1)}:1${r.dark.nudged ? '*' : ' '}` +
      `${r.tight ? '  [chroma split]' : ''}`,
  );
}
const settledRows = colorRows.filter((r) => settled.has(r.vendor)).sort((a, b) => a.hue - b.hue);
const provisionalCount = colorRows.length - settledRows.length;
console.log(
  `  closest two hues among the ${settledRows.length} established makers: ${worstGap.toFixed(1)} degrees (want >= ${MIN_SEP})`,
);
console.log(
  `  ${provisionalCount} makers with no usage here are placed around them and muted where they crowd one;`,
);
console.log('  they cannot move or fade a colour that is already on screen.');
console.log('  * = lightness nudged to reach the contrast floor.');

/*
 * The promise this file makes is that no two vendors look the same, so check exactly
 * that: walk the final hue order and require every neighbouring pair to be separated
 * either by hue or by the chroma split. Twenty vendors on one circle cannot all be
 * MIN_SEP apart -- the blue arc alone holds five real brands -- so a pair failing both
 * tests is the only thing that actually makes the palette unusable.
 */
const collisions = [];
for (let i = 0; i < settledRows.length; i++) {
  const a = settledRows[i];
  const b = settledRows[(i + 1) % settledRows.length];
  if (Math.abs(hueDelta(a.hue, b.hue)) >= MIN_SEP - 1e-6) continue;
  if (a.light.muted !== b.light.muted) continue;
  collisions.push(`${a.vendor}/${b.vendor} (${Math.abs(hueDelta(a.hue, b.hue)).toFixed(1)} deg, same chroma)`);
}
if (collisions.length) {
  console.error(`  indistinguishable vendor pairs: ${collisions.join(', ')}`);
}
if (failures) {
  console.error(`  ${failures} vendor colour(s) below ${MIN_BAR_CONTRAST}:1 on --track`);
}
if (failures || collisions.length) process.exit(1);
