import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from '@/api';
import { en, type MessageKey } from './en';
import { th } from './th';

export type Lang = 'en' | 'th';
export type CurrencyCode = 'USD' | 'THB';

const DICTS: Record<Lang, Record<MessageKey, string>> = { en, th };

export const CURRENCIES: Record<CurrencyCode, { symbol: string; decimals: number; defaultRate: number }> = {
  // rate = units of this currency per 1 USD. USD is the source unit, so its rate is 1.
  USD: { symbol: '$', decimals: 2, defaultRate: 1 },
  THB: { symbol: '฿', decimals: 0, defaultRate: 36 },
};

export interface Prefs {
  lang: Lang;
  currency: CurrencyCode;
  /** Units of `currency` per 1 USD. Set by the user; nothing fetches it. */
  rate: number;
  /** Stable subscription keys hidden from the Live cards and alert bell. */
  hiddenSubscriptions: string[];
}

const STORAGE_KEY = 'quotapulse-prefs';
/*
 * The keys this app used under its previous names, newest first. Preferences live in the
 * browser, so a rename would otherwise reset everyone's language and currency on upgrade
 * with no way to tell that from a first run. Read once, then write forward under the
 * current key; the old entries are left in place rather than deleted, which keeps a
 * downgrade working.
 */
const LEGACY_STORAGE_KEYS = ['plimsoll-prefs'];

export function normalizeHiddenSubscriptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((key): key is string => typeof key === 'string' && key.trim() !== '')
        .map((key) => key.trim()),
    ),
  ];
}

export function setSubscriptionVisibility(
  hiddenSubscriptions: string[],
  key: string,
  visible: boolean,
): string[] {
  const hidden = new Set(normalizeHiddenSubscriptions(hiddenSubscriptions));
  const normalizedKey = key.trim();
  if (!normalizedKey) return [...hidden];
  if (visible) hidden.delete(normalizedKey);
  else hidden.add(normalizedKey);
  return [...hidden];
}

function loadPrefs(): Prefs {
  const fallback: Prefs = { lang: 'en', currency: 'USD', rate: 1, hiddenSubscriptions: [] };
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ??
      LEGACY_STORAGE_KEYS.map((k) => localStorage.getItem(k)).find((v) => v != null) ??
      null;
    if (!raw) return fallback;
    const p = JSON.parse(raw) as Partial<Prefs>;
    const lang: Lang = p.lang === 'th' ? 'th' : 'en';
    const currency: CurrencyCode = p.currency === 'THB' ? 'THB' : 'USD';
    const rate = Number(p.rate);
    return {
      lang,
      currency,
      rate: Number.isFinite(rate) && rate > 0 ? rate : CURRENCIES[currency].defaultRate,
      hiddenSubscriptions: normalizeHiddenSubscriptions(p.hiddenSubscriptions),
    };
  } catch {
    // Private window or blocked storage: preferences are a convenience, not a requirement.
    return fallback;
  }
}

interface I18nValue extends Prefs {
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
  setCurrency: (currency: CurrencyCode) => void;
  setRate: (rate: number) => void;
  setSubscriptionVisible: (key: string, visible: boolean) => void;
  syncHiddenSubscriptions: (hidden: string[], updatedAt?: number) => void;
}

function sameHiddenSubscriptions(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const pendingHiddenSubscriptions = useRef<{ version: number; value: string[] } | null>(null);
  const nextHiddenSubscriptionVersion = useRef(0);
  const lastSettingsUpdatedAt = useRef(0);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* remembering the choice is a convenience, never a requirement */
    }
  }, []);

  const syncHiddenSubscriptions = useCallback((hidden: string[], updatedAt?: number) => {
    const normalized = normalizeHiddenSubscriptions(hidden);
    const pending = pendingHiddenSubscriptions.current;
    if (pending) {
      if (!sameHiddenSubscriptions(normalized, pending.value)) return;
      pendingHiddenSubscriptions.current = null;
    }
    // An overview/settings request can have started before the user's click and finish
    // afterwards. The daemon timestamp lets us ignore that stale response even after the
    // PUT response has already confirmed the optimistic value.
    if (updatedAt != null && lastSettingsUpdatedAt.current > 0 && updatedAt <= lastSettingsUpdatedAt.current) return;
    if (updatedAt != null && updatedAt > 0) lastSettingsUpdatedAt.current = updatedAt;
    if (sameHiddenSubscriptions(normalized, prefsRef.current.hiddenSubscriptions)) return;
    persist({ ...prefsRef.current, hiddenSubscriptions: normalized });
  }, [persist]);

  // Language/currency remain browser-local, but subscription visibility is shared with
  // the tray through the daemon. Migrate the old browser-only list once, then treat the
  // daemon response as authoritative for every later window or process.
  useEffect(() => {
    let active = true;
    void api.settings().then((remote) => {
      if (!active) return;
      // A user may click before the initial settings request returns. Do not let that
      // older response undo the optimistic choice.
      if (pendingHiddenSubscriptions.current) return;
      let migrated = false;
      try { migrated = localStorage.getItem('quotapulse-settings-migrated') === '1'; } catch { /* convenience only */ }
      if (!migrated && remote.hidden_subscriptions.length === 0 && prefs.hiddenSubscriptions.length > 0) {
        void api.updateSettings({ hidden_subscriptions: prefs.hiddenSubscriptions }).then((next) => {
          if (!active) return;
          if (pendingHiddenSubscriptions.current) return;
          lastSettingsUpdatedAt.current = Math.max(lastSettingsUpdatedAt.current, next.updated_at);
          persist({ ...prefsRef.current, hiddenSubscriptions: next.hidden_subscriptions });
          try { localStorage.setItem('quotapulse-settings-migrated', '1'); } catch { /* convenience only */ }
        }).catch(() => undefined);
        return;
      }
      lastSettingsUpdatedAt.current = Math.max(lastSettingsUpdatedAt.current, remote.updated_at);
      persist({ ...prefsRef.current, hiddenSubscriptions: normalizeHiddenSubscriptions(remote.hidden_subscriptions) });
      try { localStorage.setItem('quotapulse-settings-migrated', '1'); } catch { /* convenience only */ }
    }).catch(() => undefined);
    return () => { active = false; };
  }, [persist]);

  const value = useMemo<I18nValue>(() => {
    const dict = DICTS[prefs.lang];
    return {
      ...prefs,
      t: (key, vars) => {
        let s: string = dict[key] ?? en[key] ?? key;
        if (vars) {
          for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
        }
        return s;
      },
      setLang: (lang) => {
        // Switching to Thai offers baht by default; the rate stays whatever was set.
        const currency: CurrencyCode = lang === 'th' ? 'THB' : 'USD';
        const rate = prefs.currency === currency ? prefs.rate : CURRENCIES[currency].defaultRate;
        persist({ ...prefs, lang, currency, rate });
      },
      setCurrency: (currency) => {
        const rate = currency === prefs.currency ? prefs.rate : CURRENCIES[currency].defaultRate;
        persist({ ...prefs, currency, rate });
      },
      setRate: (rate) => persist({ ...prefs, rate: rate > 0 ? rate : prefs.rate }),
      setSubscriptionVisible: (key, visible) => {
        const hiddenSubscriptions = setSubscriptionVisibility(prefs.hiddenSubscriptions, key, visible);
        const next = {
          ...prefs,
          hiddenSubscriptions,
        };
        const request = {
          version: ++nextHiddenSubscriptionVersion.current,
          value: hiddenSubscriptions,
        };
        pendingHiddenSubscriptions.current = request;
        persist(next);
        void api.updateSettings({ hidden_subscriptions: hiddenSubscriptions }).then((remote) => {
          if (pendingHiddenSubscriptions.current?.version !== request.version) return;
          pendingHiddenSubscriptions.current = null;
          lastSettingsUpdatedAt.current = Math.max(lastSettingsUpdatedAt.current, remote.updated_at);
          persist({ ...prefsRef.current, hiddenSubscriptions: remote.hidden_subscriptions });
        }).catch(() => {
          if (pendingHiddenSubscriptions.current?.version !== request.version) return;
          pendingHiddenSubscriptions.current = null;
          void api.settings().then((remote) => {
            if (pendingHiddenSubscriptions.current) return;
            if (remote.updated_at > 0 && remote.updated_at < lastSettingsUpdatedAt.current) return;
            lastSettingsUpdatedAt.current = Math.max(lastSettingsUpdatedAt.current, remote.updated_at);
            persist({ ...prefsRef.current, hiddenSubscriptions: remote.hidden_subscriptions });
          }).catch(() => undefined);
        });
      },
      syncHiddenSubscriptions,
    };
  }, [prefs, persist, syncHiddenSubscriptions]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}

export const useT = () => useI18n().t;
export type { MessageKey };
