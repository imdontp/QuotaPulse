import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Limit } from '../src/limits.js';
import {
  DEFAULT_PET_SETTINGS,
  buildProviderPresence,
  resolveGlobalSeverity,
  resolvePetFrame,
  peekBubble,
  statusBubble,
  type PetSettings,
  type PresenceEvent,
} from '../src/presence/index.js';
import { selectFocus } from '../src/presence/focus-resolver.js';
import { resolvePetMood } from '../src/presence/mood-resolver.js';
import type { ProviderPresence } from '../src/presence/types.js';

const NOW = Date.parse('2026-09-02T12:00:00Z');
const HOUR = 3_600_000;
const DAY = 86_400_000;

function limit(p: Partial<Limit> & { display_name: string; window_kind: string }): Limit {
  return {
    source_id: 1,
    used_percent: 20,
    resets_at: NOW + 4 * HOUR,
    origin: 'statusline-snapshot',
    ageSeconds: 5,
    burn: null,
    ...p,
  };
}

function sub(key: string, name: string, state = 'active') {
  return { subscription_key: key, subscription_display_name: name, state, telemetry: { latest_usage_at: null } };
}

const KEYS = ['claude', 'openai', 'opencode-go'] as const;
const NAMES = ['Claude', 'OpenAI', 'OpenCode Go'] as const;

/** Three normal subscriptions, one window each, at the given percentages. */
function trio(pcts: [number, number, number]): Limit[] {
  return NAMES.map((name, i) =>
    limit({
      source_id: i + 1,
      display_name: name,
      subscription_key: KEYS[i],
      subscription_display_name: name,
      window_kind: 'weekly',
      used_percent: pcts[i]!,
    }),
  );
}

const trioSubs = [
  sub('claude', 'Claude'),
  sub('openai', 'OpenAI'),
  sub('opencode-go', 'OpenCode Go'),
];

test('global severity: 20/30/40 -> ok, 20/65/40 -> warn, 20/65/90 -> crit', () => {
  const of = (pcts: [number, number, number]) =>
    resolveGlobalSeverity(buildProviderPresence(trio(pcts), trioSubs, NOW));
  assert.equal(of([20, 30, 40]), 'ok');
  assert.equal(of([20, 65, 40]), 'warn');
  assert.equal(of([20, 65, 90]), 'crit');
  assert.equal(resolveGlobalSeverity([]), 'unknown');
});

test('readers sharing one subscription collapse to a single presence record', () => {
  const rows = [
    limit({
      source_id: 1,
      display_name: 'Codex CLI',
      subscription_key: 'openai',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'weekly',
      used_percent: 40,
      ageSeconds: 60,
    }),
    limit({
      source_id: 2,
      display_name: 'Hermes Agent',
      subscription_key: 'openai',
      subscription_display_name: 'OpenAI Subscription',
      window_kind: 'weekly',
      used_percent: 41,
      ageSeconds: 5,
    }),
  ];
  const providers = buildProviderPresence(rows, [sub('openai', 'OpenAI Subscription')], NOW);
  assert.equal(providers.length, 1);
  assert.equal(providers[0]!.name, 'OpenAI Subscription');
  // The freshest reader wins the window, exactly as the tray tooltip does.
  assert.equal(providers[0]!.usedPercent, 41);
});

test('a provider presence uses its WORST live window', () => {
  const rows = [
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: '5h', used_percent: 12 }),
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: 'weekly', used_percent: 80 }),
  ];
  const [p] = buildProviderPresence(rows, [sub('claude', 'Claude')], NOW);
  assert.equal(p!.usedPercent, 80);
  assert.equal(p!.windowKind, 'weekly');
});

test('a provider with no readable window is unknown, never 0%', () => {
  const providers = buildProviderPresence([], [sub('opencode-go', 'OpenCode Go')], NOW);
  assert.equal(providers.length, 1);
  assert.equal(providers[0]!.severity, 'unknown');
  assert.equal(providers[0]!.usedPercent, null);
});

test('focus priority: event beats pin, pin beats active, active beats rotation', () => {
  const providers = buildProviderPresence(trio([20, 30, 40]), trioSubs, NOW).map((p) => ({
    ...p,
    active: p.key === 'openai',
  }));
  const claude = providers.find((p) => p.key === 'claude')!;
  const openai = providers.find((p) => p.key === 'openai')!;
  const event: PresenceEvent = { type: 'critical', ownerKey: 'claude', at: NOW };

  assert.equal(selectFocus(providers, { now: NOW, pinnedOwnerKey: 'openai', activeOwnerKey: 'openai', event })!.key, 'claude');
  assert.equal(selectFocus(providers, { now: NOW, pinnedOwnerKey: 'claude', activeOwnerKey: 'openai' })!.key, 'claude');
  assert.equal(selectFocus(providers, { now: NOW, activeOwnerKey: 'openai' })!.key, 'openai');
  // After the event window closes, the pin takes over again.
  assert.equal(
    selectFocus(providers, { now: NOW + 11_000, pinnedOwnerKey: 'openai', activeOwnerKey: 'openai', event })!.key,
    'openai',
  );
  assert.equal(openai.active, true);
});

test('idle rotation steps through providers every 8 seconds', () => {
  const providers = buildProviderPresence(trio([20, 30, 40]), trioSubs, NOW);
  const at = (ms: number) => selectFocus(providers, { now: ms })!.key;
  assert.equal(at(0), 'claude');
  assert.equal(at(8_000), 'openai');
  assert.equal(at(16_000), 'opencode-go');
  assert.equal(at(24_000), 'claude');
});

test('rotation skips a provider with no readable window', () => {
  const providers = buildProviderPresence(trio([20, 30, 40]), [
    ...trioSubs,
    sub('claude-personal', 'Claude Personal Subscription', 'unavailable'),
  ], NOW);
  assert.equal(providers.length, 4, 'the unavailable provider is still listed');
  const seen = new Set([0, 8_000, 16_000, 24_000].map((ms) => selectFocus(providers, { now: ms })!.key));
  assert.equal(seen.has('claude-personal'), false, 'rotation must not land on a provider with no reading');
  assert.equal(seen.size, 3);
});

test('mood follows the focused provider, not the global worst', () => {
  const providers = buildProviderPresence(trio([20, 30, 40]), trioSubs, NOW).map((p) => ({
    ...p,
    active: p.key === 'openai',
  }));
  const by = (key: string) => providers.find((p) => p.key === key)!;
  assert.equal(resolvePetMood({ ...by('claude'), severity: 'crit' }), 'critical');
  assert.equal(resolvePetMood({ ...by('claude'), severity: 'warn' }), 'warning');
  assert.equal(resolvePetMood(by('openai')), 'working');
  assert.equal(resolvePetMood(by('claude')), 'healthy');
  assert.equal(resolvePetMood(null), 'unknown', 'no focus means unknown data, not healthy');
  assert.equal(
    resolvePetMood(by('claude'), { type: 'reset', ownerKey: 'claude', at: NOW }),
    'reset',
  );
});

test('the Pet stays contextual while a global risk badge shows the real worst', () => {
  const settings: PetSettings = { ...DEFAULT_PET_SETTINGS, movement: 'minimal' };
  const rows = trio([90, 35, 20]);
  const subscriptions = trioSubs.map((s) =>
    s.subscription_key === 'openai' ? { ...s, telemetry: { latest_usage_at: NOW - 1_000 } } : s,
  );
  const frame = resolvePetFrame({ limits: rows, subscriptions, settings, now: NOW });

  assert.equal(frame.global.severity, 'crit');
  assert.equal(frame.global.highest!.key, 'claude');
  // OpenAI is active, so the Pet focuses it and stays Working rather than panicking.
  assert.equal(frame.focus!.key, 'openai');
  assert.equal(frame.mood, 'working');
  assert.equal(frame.showGlobalAlert, true);
  assert.equal(frame.alertColorCss, '#ff4d4f');
});

test('a pin holds focus until the user changes it', () => {
  const settings: PetSettings = { ...DEFAULT_PET_SETTINGS, focusMode: 'pinned', pinnedOwnerKey: 'opencode-go' };
  const frame = resolvePetFrame({ limits: trio([20, 30, 40]), subscriptions: trioSubs, settings, now: NOW });
  assert.equal(frame.focus!.key, 'opencode-go');
  assert.equal(frame.mood, 'healthy');
  assert.equal(frame.showGlobalAlert, false);
});

test('an event bubble is built for thresholds, resets and activity starts', () => {
  const settings = DEFAULT_PET_SETTINGS;
  const critical: PresenceEvent = { type: 'critical', ownerKey: 'claude', at: NOW, percent: 95 };
  const frame = resolvePetFrame({
    limits: trio([95, 30, 40]),
    subscriptions: trioSubs,
    settings,
    now: NOW,
    event: critical,
  });
  assert.equal(frame.mood, 'critical');
  assert.equal(frame.bubble?.tone, 'crit');
  assert.match(frame.bubble!.lines[0]!, /almost out — 95%/);

  // §22 lists "activity started"; the caller throttles how often it may show (§3.5).
  const start = resolvePetFrame({
    limits: trio([20, 30, 40]),
    subscriptions: trioSubs,
    settings,
    now: NOW,
    event: { type: 'activity-start', ownerKey: 'claude', at: NOW },
  });
  assert.equal(start.bubble?.tone, 'info');
  assert.match(start.bubble!.lines[0]!, /active again/);

  // Activity stopping is already visible as the Pet leaving its working animation.
  const stop = resolvePetFrame({
    limits: trio([20, 30, 40]),
    subscriptions: trioSubs,
    settings,
    now: NOW,
    event: { type: 'activity-stop', ownerKey: 'claude', at: NOW },
  });
  assert.equal(stop.bubble, null);
});

test('speech bubbles can be turned off; the badge honours the reset window', () => {
  const settings: PetSettings = { ...DEFAULT_PET_SETTINGS, speechBubbles: false };
  const event: PresenceEvent = { type: 'warning', ownerKey: 'claude', at: NOW, percent: 80 };
  const frame = resolvePetFrame({
    limits: trio([80, 30, 40]),
    subscriptions: trioSubs,
    settings,
    now: NOW,
    event,
  });
  assert.equal(frame.bubble, null);

  const nearReset = resolvePetFrame({
    limits: [
      limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: '5h', used_percent: 40, resets_at: NOW + 12 * 60_000 }),
    ],
    subscriptions: [sub('claude', 'Claude')],
    settings,
    now: NOW,
  });
  assert.equal(nearReset.badge, '12m');
});

test('every mood is reachable and carries a sprite frame', () => {
  const pinned: PetSettings = { ...DEFAULT_PET_SETTINGS, focusMode: 'pinned', pinnedOwnerKey: 'claude' };
  const frame = (pcts: [number, number, number], extras: Partial<Parameters<typeof resolvePetFrame>[0]> = {}) =>
    resolvePetFrame({ limits: trio(pcts), subscriptions: trioSubs, settings: pinned, now: NOW, ...extras });

  const healthy = frame([20, 30, 40]);
  const working = frame([20, 30, 40], { activeOwnerKey: 'claude' });
  const warning = frame([65, 30, 40]);
  const critical = frame([90, 30, 40]);
  const reset = frame([20, 30, 40], { event: { type: 'reset', ownerKey: 'claude', at: NOW } });

  assert.equal(healthy.mood, 'healthy');
  assert.equal(working.mood, 'working');
  assert.equal(warning.mood, 'warning');
  assert.equal(critical.mood, 'critical');
  assert.equal(reset.mood, 'reset');

  const sprites = [healthy, working, warning, critical, reset].map((f) => f.spriteIndex);
  assert.deepEqual(sprites, [0, 1, 2, 3, 4]);
  for (const f of [healthy, working, warning, critical, reset]) {
    assert.match(f.colorCss, /^#[0-9a-f]{6}$/);
  }
});

test('an unknown provider is neither critical nor active', () => {
  const provider: ProviderPresence = {
    key: 'x',
    name: 'X',
    usedPercent: null,
    windowKind: '',
    resetsAt: null,
    severity: 'unknown',
    active: false,
    ageSeconds: null,
    windows: [],
  };
  assert.equal(resolvePetMood(provider), 'unknown');
  assert.equal(resolveGlobalSeverity([provider]), 'unknown');
});

test('a provider presence carries every live window, worst first', () => {
  const rows = [
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: 'weekly', used_percent: 80, resets_at: NOW + 4 * DAY }),
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: '5h', used_percent: 12, resets_at: NOW + 3 * HOUR }),
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: 'monthly', used_percent: 40, resets_at: NOW + 20 * DAY }),
  ];
  const [p] = buildProviderPresence(rows, [sub('claude', 'Claude')], NOW);
  assert.deepEqual(
    p!.windows.map((w) => [w.windowKind, w.usedPercent]),
    [['5h', 12], ['weekly', 80], ['monthly', 40]],
    'windows are ordered shortest-first for display',
  );
  assert.equal(p!.usedPercent, 80, 'the mood still follows the worst window');
  assert.equal(p!.windowKind, 'weekly');
});

test('the selected character is presentation only: it never changes focus or mood', () => {
  const limits = trio([90, 35, 20]);
  const subscriptions = trioSubs.map((s) =>
    s.subscription_key === 'openai' ? { ...s, telemetry: { latest_usage_at: NOW - 1_000 } } : s,
  );
  const base = resolvePetFrame({ limits, subscriptions, settings: DEFAULT_PET_SETTINGS, now: NOW });
  assert.equal(base.character, 'orbit_bot');
  assert.equal(base.spriteSvg, null, 'the default mascot prefers its raster clips');

  const fox: PetSettings = { ...DEFAULT_PET_SETTINGS, character: 'pulse_fox' };
  const withFox = resolvePetFrame({ limits, subscriptions, settings: fox, now: NOW });
  assert.equal(withFox.character, 'pulse_fox');
  assert.match(withFox.spriteSvg!, /data-character="pulse_fox"/);
  // Switching the mascot must not disturb the contextual decision.
  assert.equal(withFox.focus!.key, base.focus!.key);
  assert.equal(withFox.mood, base.mood);
  assert.equal(withFox.global.severity, base.global.severity);
  assert.equal(withFox.bubble, base.bubble);
});

test('the hover bubble lists every window of the focused provider', () => {
  const rows = [
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: '5h', used_percent: 12, resets_at: NOW + 3 * HOUR }),
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: 'weekly', used_percent: 80, resets_at: NOW + 4 * DAY }),
  ];
  const [provider] = buildProviderPresence(rows, [sub('claude', 'Claude')], NOW);
  const bubble = statusBubble(provider!, NOW);
  assert.equal(bubble.title, 'Claude');
  assert.equal(bubble.mode, 'expanded');
  assert.equal(bubble.lines.length, 2);
  assert.match(bubble.lines[0]!, /5-hour · 12%/);
  assert.match(bubble.lines[1]!, /Weekly · 80%/);
  assert.deepEqual(bubble.actions, ['details', 'pin', 'open-dashboard', 'snooze']);
});

test('the peeking bubble lists every window and has no action buttons', () => {
  const rows = [
    limit({ display_name: 'Claude', subscription_key: 'claude', window_kind: 'weekly', used_percent: 80, resets_at: NOW + 4 * DAY }),
  ];
  const [provider] = buildProviderPresence(rows, [sub('claude', 'Claude')], NOW);
  const peek = peekBubble(provider!, NOW);
  assert.equal(peek.mode, 'peek');
  assert.equal(peek.title, 'Claude');
  assert.deepEqual(peek.actions, [], 'peek must not present buttons');
  assert.equal(peek.lines.length, 1, 'peek has one compact line per focused window');
  assert.match(peek.lines[0]!, /Weekly · 80% — warning/);
});
