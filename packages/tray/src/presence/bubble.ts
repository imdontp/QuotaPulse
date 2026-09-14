import type {
  BubbleAction,
  BubbleTone,
  PetBubble,
  PresenceEvent,
  ProviderPresence,
} from './types.js';

/**
 * Speech bubble content (docs/PET_MODE_V2_SPEC.md §21–§25).
 *
 * English-only, like the tray menu: the Pet is a Windows shell surface with no i18n
 * loader of its own. Text is built here rather than in the renderer so it can be asserted
 * headlessly.
 */

const WINDOW_LABEL: Record<string, string> = {
  '5h': '5-hour',
  weekly: 'Weekly',
  weekly_opus: 'Weekly (Opus)',
  weekly_sonnet: 'Weekly (Sonnet)',
  monthly: 'Monthly',
  credits: 'Credits',
  session: 'Session',
};

const windowLabel = (kind: string): string => WINDOW_LABEL[kind] ?? kind;

const clock = (ms: number): string =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const toneForSeverity = (severity: ProviderPresence['severity']): BubbleTone =>
  severity === 'crit' ? 'crit' : severity === 'warn' ? 'warn' : 'info';

/** Visibility by interruption level (§22): informational 4s, warning 6s, critical 8–10s. */
const durationForTone = (tone: BubbleTone): number =>
  tone === 'crit' ? 9_000 : tone === 'warn' ? 6_000 : 4_000;

/** The interactive status bubble shown on hover or click (§23–§25). */
export function statusBubble(provider: ProviderPresence, now: number, pinned = false): PetBubble {
  const tone = toneForSeverity(provider.severity);
  const lines: string[] = [];
  if (provider.windows.length > 0) {
    // Every window of THIS provider, not just the worst one: the question being answered is
    // "how is this provider doing?", and one number cannot answer it.
    for (const w of provider.windows) {
      const used = `${windowLabel(w.windowKind)} · ${Math.round(w.usedPercent)}%`;
      lines.push(
        w.resetsAt != null && w.resetsAt > now
          ? `${used} — resets ${clock(w.resetsAt)}`
          : `${used} — no reset reported`,
      );
    }
  } else {
    lines.push('Quota data unavailable');
  }
  const actions: BubbleAction[] = ['details', pinned ? 'unpin' : 'pin', 'open-dashboard', 'snooze'];
  return {
    kind: 'status',
    ownerKey: provider.key,
    tone,
    title: provider.name,
    lines,
    until: null, // interactive bubbles do not auto-dismiss (§23)
    actions,
  };
}

/** The automatic bubble for a meaningful event, or null when nothing should be shown (§22). */
export function eventBubble(
  event: PresenceEvent,
  provider: ProviderPresence | undefined,
  now: number,
): PetBubble | null {
  const name = provider?.name ?? event.ownerKey;
  const window = provider ? windowLabel(provider.windowKind) : 'quota';
  const pct = event.percent != null ? Math.round(event.percent) : null;
  switch (event.type) {
    case 'usage-half':
      return make('info', name, [`${name} is halfway through its ${window} quota.`], now);
    case 'warning':
      return make('warn', name, [`${name} has reached ${pct}%.`], now);
    case 'critical':
      return make('crit', name, [`${name} is almost out — ${pct}%.`], now);
    case 'reset':
      return make('info', name, [`${name} quota has reset!`], now);
    case 'activity-start':
      // Spec §22 lists "activity started" as an automatic bubble. The caller throttles it so
      // a busy day does not turn into a stream of bubbles (§3.5).
      return make('info', name, [`${name} is active again.`], now);
    default:
      // Activity stop is already expressed by the Pet leaving its working animation.
      return null;
  }
}

function make(tone: BubbleTone, title: string, lines: string[], now: number): PetBubble {
  return {
    kind: 'event',
    ownerKey: null,
    tone,
    title,
    lines,
    until: now + durationForTone(tone),
    actions: ['details'],
  };
}

/** Confirmation shown after a Snooze action, so the button's effect is visible (§25). */
export function snoozedBubble(minutes: number, now: number): PetBubble {
  return {
    kind: 'status',
    ownerKey: null,
    tone: 'info',
    title: 'QuotaPulse',
    lines: [`Notifications snoozed for ${minutes} minutes.`],
    until: now + 4_000,
    actions: [],
  };
}

/** The offline bubble, shown on interaction when the daemon is unreachable (§46). */
export function daemonDownBubble(now: number): PetBubble {
  return {
    kind: 'status',
    ownerKey: null,
    tone: 'info',
    title: 'QuotaPulse',
    lines: ['QuotaPulse daemon is unavailable.'],
    until: now + 4_000,
    actions: ['details'],
  };
}

/**
 * The daemon is up but no quota window can be read (§45). The Pet must not look Critical;
 * it says what is actually true instead.
 */
export function noDataBubble(now: number): PetBubble {
  return {
    kind: 'status',
    ownerKey: null,
    tone: 'info',
    title: 'QuotaPulse',
    lines: ['Quota data unavailable'],
    until: now + 4_000,
    actions: ['details'],
  };
}
