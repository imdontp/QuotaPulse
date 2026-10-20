import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialProjectSelectionMotion, observeProjectSelectionMotion, projectDetailMotionKey, projectMotionKey,
  type ProjectSelectionMotionState, type ProjectSelectionObservation } from '../src/redesign/project-selection-motion.ts';
import { cancelModelSelectionMotion } from '../src/redesign/model-selection-motion.ts';
const A = projectDetailMotionKey('Alpha', 'overview'), B = projectDetailMotionKey('Beta', 'overview');
const contextKey = 'scope-all-tokens-search-empty';
const observation = (overrides: Partial<ProjectSelectionObservation> = {}): ProjectSelectionObservation => ({
  contextKey, selectedKey: A, detailKey: 'aggregate-Alpha', acceptedDetailKey: 'aggregate-Alpha',
  intent: null, enabled: true, failed: false, rowVisible: true, detailVisible: true, offset: 0, ...overrides });
const baseline = () => observeProjectSelectionMotion(initialProjectSelectionMotion(), observation()).state;
const choose = (state: ProjectSelectionMotionState, overrides: Partial<ProjectSelectionObservation> = {}) => observeProjectSelectionMotion(state,
  observation({ selectedKey: B, detailKey: 'aggregate-Beta', acceptedDetailKey: 'aggregate-Beta',
    intent: { serial: 1, key: B, contextKey, kind: 'project', openerKey: projectMotionKey('Beta') }, ...overrides }));

test('exact project identities distinguish null/empty/case and selected tab without label collisions', () => {
  assert.notEqual(projectMotionKey(null), projectMotionKey(''));
  assert.notEqual(projectMotionKey('Alpha'), projectMotionKey('alpha'));
  assert.notEqual(projectDetailMotionKey(null, 'overview'), projectDetailMotionKey('', 'overview'));
  assert.notEqual(projectDetailMotionKey('Alpha', 'overview'), projectDetailMotionKey('Alpha', 'details'));
});

test('initial/deep-link/default presentation is static, then a real project opener and accepted aggregate detail respond once', () => {
  const first = observeProjectSelectionMotion(initialProjectSelectionMotion(), observation());
  assert.equal(first.row, false); assert.equal(first.detail, false);
  const chosen = choose(first.state);
  assert.equal(chosen.row, true); assert.equal(chosen.detail, true); assert.equal(chosen.state.pending, null);
  const duplicate = choose(chosen.state);
  assert.equal(duplicate.row, false); assert.equal(duplicate.detail, false); assert.equal(duplicate.cancel, false);
});

test('sessions/usage selection responds at opener but never animates pending or foreign fetched data', () => {
  const key = projectDetailMotionKey('Beta', 'sessions');
  const input = observation({ selectedKey: key, detailKey: 'request-Beta-sessions-page0', acceptedDetailKey: null,
    intent: { serial: 1, key, contextKey, kind: 'project', openerKey: projectMotionKey('Beta') } });
  const chosen = observeProjectSelectionMotion(baseline(), input);
  assert.equal(chosen.row, true); assert.equal(chosen.detail, false);
  const foreign = observeProjectSelectionMotion(chosen.state, { ...input, acceptedDetailKey: 'request-Alpha-sessions-page0' });
  assert.equal(foreign.detail, false);
  const actual = observeProjectSelectionMotion(foreign.state, { ...input, acceptedDetailKey: input.detailKey });
  assert.equal(actual.detail, true); assert.equal(actual.row, false);
  const duplicate = observeProjectSelectionMotion(actual.state, { ...input, acceptedDetailKey: input.detailKey });
  assert.equal(duplicate.detail, false); assert.equal(duplicate.cancel, false);
});

test('real tab/breakdown detail selection uses accepted content once without replaying an old project opener', () => {
  const key = projectDetailMotionKey('Alpha', 'details');
  const input = observation({ selectedKey: key, detailKey: 'aggregate-Alpha-details', acceptedDetailKey: 'aggregate-Alpha-details',
    intent: { serial: 1, key, contextKey, kind: 'detail', openerKey: null } });
  const chosen = observeProjectSelectionMotion(baseline(), input);
  assert.equal(chosen.row, false); assert.equal(chosen.detail, true);
  const repeated = observeProjectSelectionMotion(chosen.state, { ...input, intent: { ...input.intent!, serial: 2 } });
  assert.equal(repeated.row, false); assert.equal(repeated.detail, false);
});

test('new project/tab resets session offset as part of genuine selection, not as an inert pagination event', () => {
  const prior = { ...baseline(), offset: 20 };
  const chosen = choose(prior, { offset: 0 });
  assert.equal(chosen.row, true); assert.equal(chosen.detail, true);
  const key = projectDetailMotionKey('Alpha', 'usage');
  const tab = observeProjectSelectionMotion(prior, observation({ selectedKey: key, detailKey: 'actual-usage', acceptedDetailKey: 'actual-usage', offset: 0,
    intent: { serial: 1, key, contextKey, kind: 'detail', openerKey: null } }));
  assert.equal(tab.row, false); assert.equal(tab.detail, true);
});

test('ordinary session paging consumes pending data and retry on that page is static', () => {
  const pending = choose(baseline(), { acceptedDetailKey: null });
  const page = choose(pending.state, { offset: 20, detailKey: 'Beta-page20', acceptedDetailKey: null });
  assert.equal(page.cancel, true); assert.equal(page.row, false); assert.equal(page.detail, false); assert.equal(page.state.pending, null);
  const accepted = choose(page.state, { offset: 20, detailKey: 'Beta-page20', acceptedDetailKey: 'Beta-page20' });
  assert.equal(accepted.detail, false);
});

test('search/sort/range/harness/filter replacement seeds even if its default selected project changes', () => {
  for (const replacement of ['search-Beta', 'sort-recent', 'range-today', 'harness-hermes', 'tab-unassigned']) {
    const chosen = choose(baseline(), { contextKey: replacement });
    assert.equal(chosen.row, false); assert.equal(chosen.detail, false); assert.equal(chosen.cancel, true);
    assert.equal(chosen.state.pending, null);
  }
  const automatic = observeProjectSelectionMotion(baseline(), observation({ selectedKey: B, detailKey: 'aggregate-Beta', acceptedDetailKey: 'aggregate-Beta' }));
  assert.equal(automatic.row, false); assert.equal(automatic.detail, false);
});

test('accepted scope replacement and rapid project choice retire old pending request authorization', () => {
  const pending = choose(baseline(), { acceptedDetailKey: null });
  const newScope = choose(pending.state, { detailKey: 'new-scope-Beta', acceptedDetailKey: 'new-scope-Beta' });
  assert.equal(newScope.detail, false); assert.equal(newScope.state.pending, null);
  const C = projectDetailMotionKey(null, 'overview');
  const nextInput = observation({ selectedKey: C, detailKey: 'aggregate-unassigned', acceptedDetailKey: null,
    intent: { serial: 2, key: C, contextKey, kind: 'project', openerKey: projectMotionKey(null) } });
  const chosen = observeProjectSelectionMotion(pending.state, nextInput);
  const late = observeProjectSelectionMotion(chosen.state, { ...nextInput, acceptedDetailKey: 'aggregate-Beta' });
  assert.equal(late.detail, false);
  const actual = observeProjectSelectionMotion(late.state, { ...nextInput, acceptedDetailKey: 'aggregate-unassigned' });
  assert.equal(actual.detail, true);
});

test('error/offscreen/hidden/reduced consumption prevents delayed or retry/restoration playback', () => {
  for (const loss of [{ failed: true }, { enabled: false }, { detailVisible: false }]) {
    const pending = choose(baseline(), { acceptedDetailKey: null });
    const lost = choose(pending.state, { acceptedDetailKey: null, ...loss });
    assert.equal(lost.state.pending, null);
    const restored = choose(lost.state);
    assert.equal(restored.row, false); assert.equal(restored.detail, false);
  }
  const prior = baseline();
  const consumed = { ...cancelModelSelectionMotion(prior, 1), offset: prior.offset };
  const delayed = choose(consumed);
  assert.equal(delayed.row, false); assert.equal(delayed.detail, false);
});
