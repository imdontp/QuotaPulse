/**
 * Report i18n keys that nothing asks for.
 *
 * ## Why this exists
 *
 * The dictionary is the one place in this codebase where a mistake is both easy and invisible.
 * A key that nothing reads costs nothing at runtime, so it survives every test, every build
 * and every review -- and two dictionaries drift apart, because a key added to `en.ts` and
 * forgotten in `th.ts` is a silent hole that only a Thai reader finds.
 *
 * Around forty keys were already in that state before this branch started, and they were
 * found by hand, which does not scale and does not survive.
 *
 * ## Why it is a script and not a test
 *
 * A test that fails on an unused key is the wrong shape. Keys get added ahead of the code
 * that will use them -- while splitting a section up, while writing a translation -- and a
 * gate that fails the build for a forward reference teaches people to delete the key and
 * re-add it later. This reports, and a person decides. That is the same division the repo
 * already uses for the two check suites: a gate for what must be true, a report for what
 * is worth knowing.
 *
 * ## What counts as "used"
 *
 * A key is used if its literal string appears anywhere outside the dictionaries themselves.
 * That is deliberately crude and deliberately over-inclusive: a key built at runtime with a
 * template would otherwise be reported dead while being very much alive, and a false report
 * that gets a live key deleted is far worse than a dead key that lingers. The
 * `MISSED = ` output below exists so that over-inclusion is visible rather than silent.
 *
 * Usage:  node scripts/find-dead-i18n.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const repo = join(import.meta.dirname, '..');
const webSrc = join(repo, 'packages', 'web', 'src');
const dictionaries = [join(webSrc, 'i18n', 'en.ts'), join(webSrc, 'i18n', 'th.ts')];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.tsx?$/.test(path)) yield path;
  }
}

const en = readFileSync(dictionaries[0], 'utf8');
const th = readFileSync(dictionaries[1], 'utf8');

const keys = [...en.matchAll(/^\s*'([a-zA-Z0-9_.]+)':/gm)].map(match => match[1]);
const thKeys = new Set([...th.matchAll(/^\s*'([a-zA-Z0-9_.]+)':/gm)].map(match => match[1]));

// Everything outside the two dictionaries is fair game as evidence of use.
const source = [...walk(webSrc)]
  .filter(path => !dictionaries.includes(path))
  .map(path => readFileSync(path, 'utf8'))
  .join('\n');

/*
 * Keys assembled at runtime are the dangerous case, and the first version of this script got
 * them wrong. `t(`quota.${status}`)` really does read `quota.attention`, `quota.check` and
 * `quota.available` -- and a detector that reports those as dead will get a live key deleted
 * the first time somebody trusts it. So a template literal that interpolates into a key
 * marks its whole prefix as live, and the report prints those prefixes, because "these are
 * alive but I cannot prove which ones" is far more useful than a list that quietly contains
 * live keys.
 */
const dynamicPrefixes = new Set(
  [...source.matchAll(/`([a-zA-Z0-9_]+(?:\.[a-zA-Z0-9_]+)*)\.\$\{/g)].map(match => `${match[1]}.`),
);

const isUsed = key =>
  source.includes(`'${key}'`) || [...dynamicPrefixes].some(prefix => key.startsWith(prefix));

const dead = keys.filter(key => !isUsed(key));
const missingInThai = keys.filter(key => !thKeys.has(key));
const orphanedInThai = [...thKeys].filter(key => !keys.includes(key));

console.log(`\n${keys.length} keys in en.ts, ${thKeys.size} in th.ts`);
console.log(`${dynamicPrefixes.size} prefixes are built at runtime; their keys count as used:\n`);
for (const prefix of [...dynamicPrefixes].sort()) console.log(`  ${prefix}*`);
console.log('');

if (missingInThai.length) {
  console.log(`MISSING IN TH (${missingInThai.length}) -- a Thai reader sees the key, not a sentence:`);
  for (const key of missingInThai) console.log(`  ${key}`);
  console.log('');
}
if (orphanedInThai.length) {
  console.log(`ORPHANED IN TH (${orphanedInThai.length}) -- no English counterpart to compare against:`);
  for (const key of orphanedInThai) console.log(`  ${key}`);
  console.log('');
}
console.log(`UNUSED (${dead.length}):`);
for (const key of dead) console.log(`  ${key}`);
console.log('\nOver-inclusive by design: a key assembled at runtime is counted as used.\n');
