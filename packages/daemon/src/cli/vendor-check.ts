/**
 * Print how every (model, provider) pair in the live database resolves, and where the
 * SQL CASE and the TypeScript disagree. Run after touching the vendor rules.
 */
import { vendorOf, vendorSqlCase, vendorLabel } from '../util/vendor.js';
import { openForeignRo } from '../db/index.js';
import { DB_PATH } from '../util/paths.js';
import { existsSync } from 'node:fs';

if (!existsSync(DB_PATH)) {
  console.log('no database at', DB_PATH);
  process.exit(0);
}

const db = openForeignRo(DB_PATH);
const pairs = db
  .prepare(
    `SELECT COALESCE(model,'') AS model, COALESCE(provider,'') AS provider,
            SUM(total_tokens) AS tok, COALESCE(SUM(call_count),0) AS calls
       FROM usage_event GROUP BY 1, 2 ORDER BY tok DESC`,
  )
  .all() as Array<{ model: string; provider: string; tok: number; calls: number }>;

const q = db.prepare(`SELECT ${vendorSqlCase('m', 'p')} AS v FROM (SELECT ? AS m, ? AS p)`);

console.log('\n--- every pair, and the vendor it resolves to ---');
const disagree: string[] = [];
const unknown: string[] = [];
for (const p of pairs) {
  const sql = (q.get(p.model, p.provider) as { v: string }).v;
  const ts = vendorOf(p.model || null, p.provider || null);
  const flag = sql !== ts ? ' <<< SQL/TS DISAGREE sql=' + sql : '';
  if (sql !== ts) disagree.push(`${p.model} via ${p.provider}: sql=${sql} ts=${ts}`);
  if (ts === 'unknown' && p.model) unknown.push(`${p.model} via ${p.provider || '(null)'}`);
  console.log(
    '  ' +
      (p.model || '(null)').padEnd(34) +
      ('via ' + (p.provider || '(null)')).padEnd(22) +
      vendorLabel(ts).padEnd(16) +
      (p.tok / 1e6).toFixed(1).padStart(8) +
      'M' +
      flag,
  );
}

console.log(`\ndisagreements: ${disagree.length}`);
for (const d of disagree) console.log('  ' + d);
console.log(`unknown: ${unknown.length}`);
for (const u of unknown) console.log('  ' + u);
db.close();
