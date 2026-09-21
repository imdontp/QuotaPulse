import type { Adapter } from './types.js';
import { claudeCodeAdapter } from './claude-code.js';
import { codexAdapter } from './codex.js';
import { opencodeAdapter } from './opencode.js';
import { hermesAdapter } from './hermes.js';
import { openaiAccountAdapter } from './openai-account.js';
import { opencodeAccountAdapter } from './opencode-account.js';
import { quotaEventsAdapter } from './quota-events.js';
import { claudeAccountAdapter } from './claude-account.js';

/** Order is cosmetic only; every adapter is independent and failure-isolated. */
export const ALL_ADAPTERS: Adapter[] = [
  claudeCodeAdapter,
  claudeAccountAdapter,
  codexAdapter,
  opencodeAdapter,
  hermesAdapter,
  openaiAccountAdapter,
  opencodeAccountAdapter,
  quotaEventsAdapter,
];
export * from './types.js';
