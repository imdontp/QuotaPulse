import type { AccountState } from '../adapters/types.js';

/**
 * The dashboard has three different concepts that must not be collapsed into one:
 *
 * - a subscription owns a quota pool;
 * - a harness is the tool that performs work;
 * - a delegate is a child route beneath a harness (currently Hermes).
 *
 * Adapter/source rows remain the ingestion implementation detail. This catalog is the
 * stable presentation and relationship layer above those rows, so adding another quota
 * reader never creates another visible card for the same entitlement.
 */

export interface SubscriptionDefinition {
  key: string;
  provider: string;
  displayName: string;
  /** Keep known subscriptions visible even when their local credential is absent. */
  alwaysVisible: boolean;
  stateWhenMissing: AccountState;
}

export interface HarnessDefinition {
  key: string;
  adapter: string;
  /** A null profile means that all profiles of this adapter aggregate into one card. */
  profile: string | null;
  displayName: string;
  vendor: string;
  subscriptionKeys: string[];
  delegateKeys: string[];
  parentKey: string | null;
  /** Delegates do not own a source row; their usage is attributed when routing metadata exists. */
  usageAttributed: boolean;
}

export const SUBSCRIPTION_CATALOG: readonly SubscriptionDefinition[] = [
  {
    key: 'openai:subscription',
    provider: 'openai',
    displayName: 'OpenAI Subscription',
    alwaysVisible: true,
    stateWhenMissing: 'waiting',
  },
  {
    key: 'anthropic:claude:company',
    provider: 'anthropic',
    displayName: 'Claude Company Subscription',
    alwaysVisible: true,
    stateWhenMissing: 'inactive',
  },
  {
    key: 'anthropic:claude:personal',
    provider: 'anthropic',
    displayName: 'Claude Personal Subscription',
    alwaysVisible: true,
    stateWhenMissing: 'inactive',
  },
  {
    // Optional: the account reader must receive a successful Go quota response before
    // this card is shown. A local OpenCode API key alone is not proof of Go entitlement.
    key: 'opencode:go',
    provider: 'opencode',
    displayName: 'OpenCode Go Subscription',
    alwaysVisible: false,
    stateWhenMissing: 'unavailable',
  },
];

export const HARNESS_CATALOG: readonly HarnessDefinition[] = [
  {
    key: 'codex-cli',
    adapter: 'codex',
    profile: 'default',
    displayName: 'Codex CLI',
    vendor: 'openai',
    subscriptionKeys: ['openai:subscription'],
    delegateKeys: [],
    parentKey: null,
    usageAttributed: true,
  },
  {
    key: 'claude-code-company',
    adapter: 'claude-code',
    profile: 'company',
    displayName: 'Claude Code Company',
    vendor: 'anthropic',
    subscriptionKeys: ['anthropic:claude:company'],
    delegateKeys: [],
    parentKey: null,
    usageAttributed: true,
  },
  {
    key: 'claude-code-personal',
    adapter: 'claude-code',
    profile: 'default',
    displayName: 'Claude Code Personal',
    vendor: 'anthropic',
    subscriptionKeys: ['anthropic:claude:personal'],
    delegateKeys: [],
    parentKey: null,
    usageAttributed: true,
  },
  {
    key: 'opencode',
    adapter: 'opencode',
    profile: 'default',
    displayName: 'OpenCode',
    vendor: 'opencode',
    subscriptionKeys: ['opencode:go'],
    delegateKeys: [],
    parentKey: null,
    usageAttributed: true,
  },
  {
    key: 'hermes-agent',
    adapter: 'hermes',
    profile: null,
    displayName: 'Hermes Agent',
    vendor: 'nous',
    subscriptionKeys: [],
    delegateKeys: [
      'hermes-delegate-codex-cli',
      'hermes-delegate-claude-code-company',
      'hermes-delegate-claude-code-personal',
    ],
    parentKey: null,
    usageAttributed: true,
  },
  {
    key: 'hermes-delegate-codex-cli',
    adapter: 'codex',
    profile: 'default',
    displayName: 'Delegate Codex CLI',
    vendor: 'openai',
    subscriptionKeys: ['openai:subscription'],
    delegateKeys: [],
    parentKey: 'hermes-agent',
    usageAttributed: false,
  },
  {
    key: 'hermes-delegate-claude-code-company',
    adapter: 'claude-code',
    profile: 'company',
    displayName: 'Delegate Claude Code Company',
    vendor: 'anthropic',
    subscriptionKeys: ['anthropic:claude:company'],
    delegateKeys: [],
    parentKey: 'hermes-agent',
    usageAttributed: false,
  },
  {
    key: 'hermes-delegate-claude-code-personal',
    adapter: 'claude-code',
    profile: 'default',
    displayName: 'Delegate Claude Code Personal',
    vendor: 'anthropic',
    subscriptionKeys: ['anthropic:claude:personal'],
    delegateKeys: [],
    parentKey: 'hermes-agent',
    usageAttributed: false,
  },
];

export function subscriptionDefinitionFor(key: string): SubscriptionDefinition | undefined {
  return SUBSCRIPTION_CATALOG.find((definition) => definition.key === key);
}
