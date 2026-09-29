import type { QuotaWindow, UsageRecord } from './model';

export const fixtureNow = Date.UTC(2026, 8, 29, 10);
export const fixtureRecords: UsageRecord[] = [
  { id: 'sample-1', project: 'QuotaPulse', harness: 'Codex', provider: 'OpenAI', model: 'gpt-5.4', session: 'a', grain: 'call', tokens: 240000, cost: 1.2, costSource: 'computed' },
  { id: 'sample-2', project: 'QuotaPulse', harness: 'Codex', provider: 'OpenAI', model: 'gpt-5.4', session: 'a', grain: 'call', tokens: 180000, cost: 0.9, costSource: 'computed' },
  { id: 'sample-3', project: 'Workbench', harness: 'Claude Code', provider: 'Anthropic', model: 'claude-sonnet-4-6', session: 'b', grain: 'call', tokens: 320000, cost: 2.4, costSource: 'native' },
  { id: 'sample-4', project: 'Workbench', harness: 'OpenCode', provider: 'OpenAI', model: 'gpt-5.4', session: 'c', grain: 'call', tokens: 110000, cost: 0.55, costSource: 'estimated' },
  { id: 'sample-5', project: null, harness: 'Hermes', provider: 'Anthropic', model: 'claude-sonnet-4-6', session: 'd', grain: 'session_model_aggregate', tokens: 150000, cost: null, costSource: 'unknown' },
];
export const fixtureQuotas: QuotaWindow[] = [
  { id: 'openai-primary', owner: 'OpenAI', window: '5h', usedPercent: 38, observedAt: fixtureNow - 60000, resetAt: fixtureNow + 7200000 },
  { id: 'anthropic-weekly', owner: 'Anthropic', window: '7d', usedPercent: 82, observedAt: fixtureNow - 120000, resetAt: fixtureNow + 86400000 },
];
