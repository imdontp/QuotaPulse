import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectOf } from '../src/util/paths.js';

// Built from a char code rather than written inline, so this file cannot itself lose a
// backslash the way the code under test did.
const BS = String.fromCharCode(92);
const win = (...seg: string[]) => seg.join(BS);

/**
 * This shipped broken: the separator class lost a backslash in transit and degraded to
 * "forward slash only", so every Windows cwd stored its whole path as the project name
 * for 457 sessions. The Windows case is the one that regressed, so it is pinned first.
 */
test('projectOf takes the last segment of a Windows path', () => {
  assert.equal(projectOf(win('C:', 'Users', 'me', 'Projects', 'quotapulse')), 'quotapulse');
  assert.equal(projectOf(win('C:', 'Users', 'me', 'Projects', 'quotapulse', '')), 'quotapulse');
});

test('projectOf takes the last segment of a POSIX path', () => {
  assert.equal(projectOf('/home/me/projects/quotapulse'), 'quotapulse');
  assert.equal(projectOf('/home/me/projects/quotapulse/'), 'quotapulse');
});

test('projectOf handles mixed separators and spaces', () => {
  assert.equal(projectOf('C:/Users/me/OneDrive - Corp' + BS + 'my_project'), 'my_project');
});

test('projectOf returns null when there is nothing usable', () => {
  assert.equal(projectOf(null), null);
  assert.equal(projectOf(undefined), null);
  assert.equal(projectOf(''), null);
  assert.equal(projectOf('///'), null);
});
