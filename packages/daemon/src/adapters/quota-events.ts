import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename } from 'node:path';
import type { Adapter, IngestCtx, Profile, WatchTarget, WindowKind } from './types.js';
import { readJsonlDelta } from '../ingest/jsonl.js';
import { QUOTA_EVENTS_PATH } from '../util/paths.js';
import { logger } from '../util/log.js';

const log = logger('quota-events');

const WINDOW_KINDS = new Set<WindowKind>([
  '5h',
  'weekly',
  'weekly_opus',
  'weekly_sonnet',
  'monthly',
  'credits',
  'session',
]);

interface QuotaEventWindow {
  window_kind?: string;
  used_percent?: number | null;
  used_dollars?: number | null;
  limit_dollars?: number | null;
  resets_at?: number | string | null;
  severity?: string | null;
}

interface QuotaEventAccount {
  key?: string;
  provider?: string;
  display_name?: string;
}

/**
 * The optional hand-off contract for an already-running harness invocation.
 * It deliberately contains quota metadata only: no prompt, response, token or credential
 * fields are accepted or persisted by this adapter.
 */
export interface QuotaEventEnvelope {
  schema?: number;
  source?: string;
  profile?: string;
  account?: QuotaEventAccount | null;
  account_key?: string | null;
  account_provider?: string | null;
  account_display_name?: string | null;
  execution_mode?: 'interactive' | 'headless' | 'exec' | 'unknown';
  observed_at?: number | string;
  source_fetched_at?: number | string | null;
  origin?: string;
  route_key?: string | null;
  windows?: QuotaEventWindow[];
}

interface EventProfile extends Profile {
  eventKey: string;
}

function asMillis(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1_000_000_000_000 ? Math.round(value * 1000) : Math.round(value);
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asNonEmpty(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function accountFor(event: QuotaEventEnvelope) {
  const nested = event.account;
  const key = asNonEmpty(nested?.key) ?? asNonEmpty(event.account_key);
  if (!key) return undefined;
  return {
    key,
    provider: asNonEmpty(nested?.provider) ?? asNonEmpty(event.account_provider) ?? 'unknown',
    displayName:
      asNonEmpty(nested?.display_name) ?? asNonEmpty(event.account_display_name) ?? key,
  };
}

function eventKeyOf(event: QuotaEventEnvelope): string | null {
  const source = asNonEmpty(event.source);
  const profile = asNonEmpty(event.profile);
  return source && profile ? `${source}/${profile}` : null;
}

function readProfiles(eventsPath: string): EventProfile[] {
  if (!existsSync(eventsPath)) return [];
  let text: string;
  try {
    text = readFileSync(eventsPath, 'utf8');
  } catch (err) {
    log.debug(`cannot inspect ${basename(eventsPath)}`, (err as Error).message);
    return [];
  }

  const found = new Map<string, EventProfile>();
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let event: QuotaEventEnvelope;
    try {
      event = JSON.parse(line) as QuotaEventEnvelope;
    } catch {
      continue;
    }
    const eventKey = eventKeyOf(event);
    if (!eventKey) continue;
    const [source, profile] = eventKey.split('/', 2);
    if (!source || !profile) continue;
    found.set(eventKey, {
      eventKey,
      profile: eventKey,
      rootPath: eventsPath,
      displayName: `${source} (${profile}) quota events`,
      account: accountFor(event),
      sourceKind: 'account',
    });
  }
  return [...found.values()];
}

function validWindow(window: QuotaEventWindow): WindowKind | null {
  return typeof window.window_kind === 'string' && WINDOW_KINDS.has(window.window_kind as WindowKind)
    ? (window.window_kind as WindowKind)
    : null;
}

function validPercent(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function eventForProfile(event: QuotaEventEnvelope, profile: EventProfile): boolean {
  return eventKeyOf(event) === profile.eventKey;
}

export function createQuotaEventsAdapter(eventsPath = QUOTA_EVENTS_PATH): Adapter {
  return {
    id: 'quota-events',
    displayName: 'Quota event bridge',

    async detect(): Promise<Profile[]> {
      return readProfiles(eventsPath);
    },

    watchTargets(_profile: Profile): WatchTarget[] {
      return [{ kind: 'file', path: eventsPath }];
    },

    async ingest(ctx: IngestCtx): Promise<void> {
      const profile = ctx.profile as EventProfile;
      if (!existsSync(eventsPath)) return;

      let st;
      try {
        st = statSync(eventsPath);
      } catch (err) {
        ctx.cursors.recordError(eventsPath, (err as Error).message);
        return;
      }

      const cursor = ctx.cursors.get(eventsPath);
      if (st.size === cursor.fileSize && st.size === cursor.byteOffset) return;

      try {
        const result = await readJsonlDelta(eventsPath, cursor.byteOffset, (raw) => {
          const event = raw as QuotaEventEnvelope;
          if (!eventForProfile(event, profile)) return;
          if (event.schema != null && event.schema !== 1) return;

          const observedAt = asMillis(event.observed_at);
          if (observedAt == null || !Array.isArray(event.windows)) return;
          const sourceFetchedAt = asMillis(event.source_fetched_at) ?? observedAt;
          const mode = event.execution_mode ?? 'unknown';
          const baseOrigin = asNonEmpty(event.origin) ?? 'quota-event';
          const origin = `${baseOrigin}:${mode}`;

          for (const window of event.windows) {
            const windowKind = validWindow(window);
            if (!windowKind) continue;
            const usedPercent = validPercent(window.used_percent);
            if (usedPercent == null && asMillis(window.resets_at) == null) continue;
            ctx.sink.limit({
              windowKind,
              usedPercent,
              usedDollars: typeof window.used_dollars === 'number' ? window.used_dollars : null,
              limitDollars: typeof window.limit_dollars === 'number' ? window.limit_dollars : null,
              resetsAt: asMillis(window.resets_at),
              severity: asNonEmpty(window.severity),
              observedAt,
              sourceFetchedAt,
              origin,
            });
          }
        });

        ctx.cursors.set(eventsPath, {
          byteOffset: result.nextOffset,
          fileSize: result.fileSize,
          fileMtime: result.fileMtime,
        });
        ctx.cursors.clearError(eventsPath);
        if (result.restarted) log.warn(`file shrank, re-read from start: ${basename(eventsPath)}`);
      } catch (err) {
        const message = (err as Error).message;
        log.warn(`failed reading ${basename(eventsPath)}`, message);
        ctx.cursors.recordError(eventsPath, message);
      }
    },
  };
}

export const quotaEventsAdapter = createQuotaEventsAdapter();
