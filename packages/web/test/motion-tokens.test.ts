import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DURATION, EASE } from '../src/lib/motion';

/**
 * The motion scale exists in two files: `index.css` for CSS transitions, and
 * `lib/motion.ts` for everything JS-driven. They are one design decision, so they must be
 * one set of numbers.
 *
 * This test exists because the two halves are physically unable to notice each other. A CSS
 * custom property and a TypeScript constant do not disagree loudly -- the hover gets
 * slightly slower, the reveal gets slightly softer, and the only symptom is that the app
 * stops feeling like it was designed. That is precisely the kind of drift nobody files a
 * bug about, so it is pinned here instead.
 *
 * There is precedent for this in the repo: the 60/85 severity thresholds are written out in
 * three separate files on purpose, because a colour and a threshold that disagree produce a
 * *wrong answer* rather than an ugly one. Here the failure is cosmetic, which is why the
 * bar is a test rather than a type error.
 */

const raw = readFileSync(join(import.meta.dirname, '..', 'src', 'index.css'), 'utf8');
// Comments discuss these tokens in prose, and prose would otherwise count as declarations.
// Stripped once so every assertion below is looking at what the browser actually parses.
const css = raw.replace(/\/\*[\s\S]*?\*\//g, '');

test('every duration in the TypeScript scale is declared in the stylesheet', () => {
  for (const [name, ms] of Object.entries(DURATION)) {
    assert.match(
      css,
      new RegExp(`--motion-${name}:\\s*${ms}ms`),
      `--motion-${name} should be ${ms}ms in index.css, matching DURATION.${name}`,
    );
  }
});

test('every easing in the TypeScript scale is declared in the theme block', () => {
  for (const [name, [x1, y1, x2, y2]] of Object.entries(EASE)) {
    assert.match(
      css,
      new RegExp(`--ease-${name}:\\s*cubic-bezier\\(${x1},\\s*${y1},\\s*${x2},\\s*${y2}\\)`),
      `--ease-${name} should be cubic-bezier(${x1}, ${y1}, ${x2}, ${y2}) in index.css, matching EASE.${name}`,
    );
  }
});

test('the stylesheet has no shadowed second copy of an easing token', () => {
  // `--ease-*` is declared in the `@theme` block so one definition serves both the generated
  // utility and the `var()` the stylesheet needs. Declaring it in `:root` as well would put
  // two writes to the same custom property on the same element, and which one survives
  // depends on source order -- the exact kind of quiet split this test exists to prevent.
  const declarations = [...css.matchAll(/^\s*--ease-[a-z]+:/gm)];
  assert.equal(declarations.length, Object.keys(EASE).length, 'each easing is declared exactly once');
});

test('the reduced-motion clamp still exists, and still pins iteration count', () => {
  // A CSS-driven infinite animation clamped to 0.001ms does not stop, it strobes. Both
  // halves of the clamp are load-bearing and a future edit that keeps only the duration
  // would reintroduce a seizure risk for anyone who asked for less motion.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /animation-duration:\s*0\.001ms\s*!important/);
  assert.match(css, /animation-iteration-count:\s*1\s*!important/);
  // The shimmer is the only infinite animation the stylesheet owns, so if this ever becomes
  // untrue the comment claiming it is, too. It is declared as a theme variable rather than
  // an `animation:` shorthand, because the `animate-shimmer` utility has to carry it, so the
  // count is over every `infinite` in the file rather than over animation shorthands.
  const infinite = [...css.matchAll(/infinite/g)];
  assert.equal(infinite.length, 1, 'exactly one infinite animation, the shimmer');
  assert.match(css, /--animate-shimmer:\s*qp-shimmer[^;]*infinite/);
  assert.match(css, /@keyframes qp-shimmer/);
});

/*
 * Reduced motion has to be a behaviour, not a duration.
 *
 * The stylesheet's clamp only reaches CSS. Every `motion` animation is JavaScript, so a
 * component that animates without asking `useMotionPref` moves regardless of what the reader
 * asked the operating system for -- and the symptom is invisible, because the animation still
 * looks correct to everyone else. Four such components existed: the sparkline's draw-on, both
 * bar lists, and the sidebar's tab pill.
 *
 * This is a source-level assertion on purpose. A behavioural test would have to measure
 * interpolation frames, which is exactly the kind of test that passes because the harness
 * cannot see the difference. The property being protected is "does this file consult the
 * motion preference at all", and grep can check that honestly.
 */
const ANIMATING = [
  'src/components/primitives.tsx',
  'src/components/stacked-bars.tsx',
  'src/components/quota-ring.tsx',
  'src/components/gauge.tsx',
  'src/components/progression-rail.tsx',
  'src/components/alert-bell.tsx',
  'src/components/pet-popup.tsx',
  'src/components/ui/tabs.tsx',
];

for (const file of ANIMATING) {
  test(`${file} honours the motion preference`, () => {
    const source = readFileSync(join(import.meta.dirname, '..', file), 'utf8');
    assert.match(
      source,
      /useMotionPref\(\)|useReducedMotion\(\)/,
      `${file} animates but never asks what the motion preference is`,
    );
    // The house curve, spelled out. If this count goes up, someone is reaching past the
    // token for the literal again, and a change to the curve will not reach their code.
    const literals = [...source.matchAll(/\[0\.22,\s*1,\s*0\.36,\s*1\]/g)];
    assert.equal(literals.length, 0, `${file} still hardcodes the house easing curve`);
  });
}
