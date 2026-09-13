import { test } from 'node:test';
import assert from 'node:assert/strict';
import { thresholdAlerts, type AlertState } from '../src/alerts.js';
import type { Limit } from '../src/limits.js';

const now = 1_800_000_000_000;
const reset = now+3600000;
const limit = (patch: Partial<Limit> = {}): Limit => ({ source_id:1,display_name:'Fixture',window_kind:'weekly',used_percent:75,
  resets_at:reset,origin:'fixture',ageSeconds:0,burn:null,subscription_key:'a',...patch });

test('75% with 28ms reset jitter emits one alert; a real rollover can alert again', () => {
  const state = new Map<string,AlertState>();
  assert.equal(thresholdAlerts([limit()],state,now).length,1);
  assert.equal(thresholdAlerts([limit({resets_at:reset+28})],state,now).length,0);
  assert.equal(thresholdAlerts([limit({resets_at:reset+2000})],state,now).length,0);
  assert.equal(thresholdAlerts([limit({resets_at:reset+2001})],state,now).length,1);
  assert.equal(thresholdAlerts([limit({resets_at:reset+7*86400000,used_percent:10})],state,now).length,0);
  assert.equal(thresholdAlerts([limit({resets_at:reset+7*86400000})],state,now).length,1);
});

test('threshold escalation keeps the reset anchor and ignores lower or expired readings', () => {
  const state = new Map<string,AlertState>();
  for(const [percent,delta,expected] of [[49,0,0],[50,0,1],[75,28,0],[80,1000,1],[95,1800,1],[95,2000,0],[60,0,0]]) {
    assert.equal(thresholdAlerts([limit({used_percent:percent,resets_at:reset+delta})],state,now).length,expected);
  }
  assert.equal(state.get('a:weekly')?.resetsAt,reset);
  assert.equal(thresholdAlerts([limit({resets_at:now})],state,now).length,0);
  assert.equal(thresholdAlerts([limit({used_percent:null})],state,now).length,0);
});

test('deduplicates subscription readers without merging subscriptions or window kinds', () => {
  const state = new Map<string,AlertState>();
  assert.equal(thresholdAlerts([limit(),limit({source_id:2,ageSeconds:10}),limit({source_id:3,subscription_key:'b'}),limit({window_kind:'5h'})],state,now).length,3);
  const unknown = new Map<string,AlertState>();
  assert.equal(thresholdAlerts([limit({resets_at:null})],unknown,now).length,1);
  assert.equal(thresholdAlerts([limit({resets_at:null})],unknown,now).length,0);
  assert.equal(thresholdAlerts([limit()],unknown,now).length,1);
});
