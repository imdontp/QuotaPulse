/**
 * Run one ingest pass and print what landed, then cross-check the totals against the
 * ground truth each harness already computed for itself. Use this after touching an
 * adapter: if a number moves, the adapter changed the meaning of the data.
 */
import { openDb, closeDb, openForeignRo } from '../db/index.js';
import { loadPrices } from '../pricing/loader.js';
import { ALL_ADAPTERS } from '../adapters/index.js';
import { resolveSources, runPass, summarize } from '../ingest/runner.js';
import { home } from '../util/paths.js';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const fmt = (n: number) => n.toLocaleString('en-US');

async function main() {
  const db = openDb();

  const priced = loadPrices(db);
  console.log(`\npricing: ${priced.models} models from ${priced.providers} providers`);
  console.log(`         ${priced.path ?? '(no catalog found)'}\n`);

  const sources = await resolveSources(db, ALL_ADAPTERS);
  if (sources.length === 0) {
    console.log('no harnesses detected');
    closeDb();
    return;
  }

  const started = Date.now();
  const results = await runPass(db, sources, { backfill: true });
  console.log(`\n--- ingest pass (${Date.now() - started}ms) ---`);
  for (const r of results) console.log('  ' + summarize(r));

  const unpriced = new Set<string>();
  for (const r of results) for (const m of r.stats.unpricedModels) unpriced.add(m);
  if (unpriced.size > 0) {
    console.log(`\n  unpriced models (${unpriced.size}): ${[...unpriced].slice(0, 12).join(', ')}`);
  }

  console.log('\n--- stored totals by source ---');
  const rows = db
    .prepare(
      `SELECT s.harness, s.profile, COALESCE(SUM(u.call_count),0) AS calls,
              SUM(u.input_tokens)        AS input,
              SUM(u.cached_input_tokens) AS cached,
              SUM(u.output_tokens)       AS output,
              SUM(u.total_tokens)        AS total,
              SUM(COALESCE(u.cost_usd,0)) AS cost,
              MIN(u.ts) AS first_ts, MAX(u.ts) AS last_ts
         FROM usage_event u JOIN source s ON s.id = u.source_id
        GROUP BY s.id ORDER BY total DESC`,
    )
    .all() as Array<Record<string, number | string>>;
  for (const r of rows) {
    console.log(
      `  ${String(r.harness)}/${String(r.profile)}`.padEnd(28) +
        `calls=${fmt(Number(r.calls))}`.padEnd(16) +
        `in=${fmt(Number(r.input))}`.padEnd(18) +
        `out=${fmt(Number(r.output))}`.padEnd(16) +
        `total=${fmt(Number(r.total))}`.padEnd(20) +
        `$${Number(r.cost).toFixed(4)}`,
    );
    console.log(
      '  '.padEnd(28) +
        `range ${new Date(Number(r.first_ts)).toISOString().slice(0, 10)} .. ${new Date(Number(r.last_ts)).toISOString().slice(0, 10)}`,
    );
  }

  console.log('\n--- latest limit samples ---');
  const limits = db
    .prepare(
      `SELECT s.harness, s.profile, l.window_kind, l.used_percent, l.resets_at, l.origin,
              l.observed_at, l.source_fetched_at
         FROM limit_sample l JOIN source s ON s.id = l.source_id
         JOIN (SELECT source_id, window_kind, origin, MAX(observed_at) AS mx
                 FROM limit_sample GROUP BY source_id, window_kind, origin) t
           ON t.source_id = l.source_id AND t.window_kind = l.window_kind
          AND t.origin = l.origin AND t.mx = l.observed_at
        ORDER BY s.harness,
          CASE l.window_kind
            WHEN '5h' THEN 0
            WHEN 'weekly' THEN 1
            WHEN 'weekly_opus' THEN 2
            WHEN 'weekly_sonnet' THEN 3
            WHEN 'monthly' THEN 4
            ELSE 99
          END,
          l.window_kind`,
    )
    .all() as Array<Record<string, number | string | null>>;
  const now = Date.now();
  for (const l of limits) {
    const age = l.source_fetched_at ? Math.round((now - Number(l.source_fetched_at)) / 60000) : null;
    const pct = l.used_percent == null ? '  --' : `${Math.round(Number(l.used_percent)).toString().padStart(3)}%`;
    const reset = l.resets_at ? new Date(Number(l.resets_at)).toISOString().slice(5, 16) : '--';
    console.log(
      `  ${String(l.harness)}/${String(l.profile)}`.padEnd(28) +
        `${String(l.window_kind).padEnd(14)}${pct}  resets ${reset.padEnd(13)}` +
        `${String(l.origin).padEnd(22)}${age == null ? '' : `age ${age}m`}`,
    );
  }

  crossCheck(db);
  closeDb();
}

/** Compare what we stored against each harness's own pre-computed aggregate. */
function crossCheck(db: ReturnType<typeof openDb>) {
  console.log('\n--- cross-check vs each harness ground truth ---');

  const ours = (harness: string, profile: string, col: string) =>
    Number(
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(u.${col}),0) AS v FROM usage_event u
               JOIN source s ON s.id=u.source_id WHERE s.harness=? AND s.profile=?`,
          )
          .get(harness, profile) as { v: number }
      ).v,
    );
  const ourCalls = (harness: string, profile: string) =>
    Number(
      (
        db
          .prepare(
            `SELECT COALESCE(SUM(u.call_count),0) AS v FROM usage_event u JOIN source s ON s.id=u.source_id
              WHERE s.harness=? AND s.profile=?`,
          )
          .get(harness, profile) as { v: number }
      ).v,
    );

  const line = (label: string, ours: number, truth: number | null, note = '') => {
    if (truth == null) {
      console.log(`  ${label.padEnd(46)} ours=${fmt(ours).padStart(16)}   (no ground truth) ${note}`);
      return;
    }
    const delta = ours - truth;
    const pct = truth === 0 ? 0 : (delta / truth) * 100;
    const mark = Math.abs(pct) < 1 ? 'OK ' : Math.abs(pct) < 5 ? '~  ' : 'XX ';
    console.log(
      `  ${mark}${label.padEnd(43)} ours=${fmt(ours).padStart(16)} truth=${fmt(truth).padStart(16)} ` +
        `delta=${(pct >= 0 ? '+' : '') + pct.toFixed(2)}% ${note}`,
    );
  };

  /*
   * Claude Code: recount the transcripts independently rather than comparing against a
   * frozen constant. Constants rot -- these drifted +6% in a day simply because the
   * machine kept working -- and a check that drifts on its own teaches you to ignore it.
   * This walks the same files with its own deduplication, so it still catches an adapter
   * that stops deduplicating.
   */
  for (const profile of ['default', 'company']) {
    const truth = countClaudeTranscripts(profile);
    if (!truth) continue;
    /*
     * Claude deletes its own old transcripts. Those calls really happened and we keep
     * them, but a recount can only walk files that still exist -- so every pruned
     * transcript pushes `ours` above `truth` by exactly what it held. Naming the count
     * turns a drift that looks like a dedup bug back into the expected reading it is.
     */
    const pruned = missingTranscripts(db, 'claude-code', profile);
    const note = pruned > 0 ? `(${pruned} transcripts since deleted by the harness)` : '';
    line(
      `claude-code/${profile} unique calls`,
      ourCalls('claude-code', profile),
      truth.messages,
      note || '(distinct message.id)',
    );
    line(`claude-code/${profile} output tokens`, ours('claude-code', profile, 'output_tokens'), truth.outputTokens, note);
  }

  // Codex: state_5.sqlite keeps its own per-thread token counter.
  const codexDb = home('.codex', 'state_5.sqlite');
  if (existsSync(codexDb)) {
    try {
      const f = openForeignRo(codexDb);
      const truth = Number((f.prepare('SELECT COALESCE(SUM(tokens_used),0) v FROM threads').get() as { v: number }).v);
      f.close();
      line('codex total tokens', ours('codex', 'default', 'total_tokens'), truth, '(threads.tokens_used is a superset: it indexes pruned rollouts too)');
    } catch (err) {
      console.log('  codex cross-check unavailable:', (err as Error).message);
    }
  }

  // OpenCode pre-aggregates per session.
  const ocDb = home('.local', 'share', 'opencode', 'opencode.db');
  if (existsSync(ocDb)) {
    try {
      const f = openForeignRo(ocDb);
      const t = f
        .prepare(
          `SELECT COALESCE(SUM(tokens_input),0) i, COALESCE(SUM(tokens_output),0) o,
                  COALESCE(SUM(tokens_reasoning),0) r FROM session`,
        )
        .get() as { i: number; o: number; r: number };
      f.close();
      line('opencode input tokens', ours('opencode', 'default', 'input_tokens'), Number(t.i));
      // OpenCode keeps reasoning OUTSIDE output; our convention folds it in, so the
      // like-for-like comparison is against output + reasoning.
      line('opencode output+reasoning', ours('opencode', 'default', 'output_tokens'), Number(t.o) + Number(t.r));
    } catch (err) {
      console.log('  opencode cross-check unavailable:', (err as Error).message);
    }
  }
}

/**
 * An INDEPENDENT recount of a Claude profile's transcripts: walk every *.jsonl, keep one
 * entry per distinct message.id, and total the output tokens. Deliberately does not reuse
 * the adapter, so the two can disagree.
 */
/** Transcripts we ingested that the harness has since removed from disk. */
function missingTranscripts(db: ReturnType<typeof openDb>, harness: string, profile: string): number {
  const rows = db
    .prepare(
      `SELECT i.target_key FROM ingest_state i
         JOIN source s ON s.id = i.source_id
        WHERE s.harness = ? AND s.profile = ? AND i.kind = 'file'`,
    )
    .all(harness, profile) as Array<{ target_key: string }>;
  return rows.filter((r) => !existsSync(r.target_key)).length;
}

function countClaudeTranscripts(profile: string): { messages: number; outputTokens: number } | null {
  const root = profile === 'default' ? home('.claude') : home(`.claude-${profile}`);
  const projects = join(root, 'projects');
  if (!existsSync(projects)) return null;

  const files: string[] = [];
  const walk = (dir: string, depth: number) => {
    if (depth > 4) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (e.name.endsWith('.jsonl')) files.push(p);
    }
  };
  try {
    walk(projects, 0);
  } catch {
    return null;
  }

  const seen = new Set<string>();
  let outputTokens = 0;
  for (const f of files) {
    let text: string;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const raw of text.split('\n')) {
      if (!raw || raw.indexOf('"assistant"') === -1) continue;
      let rec: { type?: string; message?: { id?: string; usage?: { output_tokens?: number } } };
      try {
        rec = JSON.parse(raw);
      } catch {
        continue;
      }
      if (rec.type !== 'assistant') continue;
      const id = rec.message?.id;
      const usage = rec.message?.usage;
      if (!id || !usage || seen.has(id)) continue;
      seen.add(id);
      outputTokens += usage.output_tokens ?? 0;
    }
  }
  return { messages: seen.size, outputTokens };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
