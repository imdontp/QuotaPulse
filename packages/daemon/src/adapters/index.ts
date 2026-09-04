import type { Adapter } from './types.js';
import { claudeCodeAdapter } from './claude-code.js';
import { codexAdapter } from './codex.js';
import { opencodeAdapter } from './opencode.js';
import { hermesAdapter } from './hermes.js';

/** Order is cosmetic only; every adapter is independent and failure-isolated. */
export const ALL_ADAPTERS: Adapter[] = [
  claudeCodeAdapter,
  codexAdapter,
  opencodeAdapter,
  hermesAdapter,
];
export * from './types.js';
