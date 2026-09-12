import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
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
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(loadPrefs);

  const persist = useCallback((next: Prefs) => {
    setPrefs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* remembering the choice is a convenience, never a requirement */
    }
  }, []);

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
        persist({
          ...prefs,
          hiddenSubscriptions: setSubscriptionVisibility(prefs.hiddenSubscriptions, key, visible),
        });
      },
    };
  }, [prefs, persist]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const v = useContext(I18nContext);
  if (!v) throw new Error('useI18n must be used inside <I18nProvider>');
  return v;
}

export const useT = () => useI18n().t;
export type { MessageKey };
