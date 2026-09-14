import { useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

const KEY = 'quotapulse-theme';
/** The key this app used under its previous name; read once so a rename does not flip it. */
const LEGACY_KEY = 'plimsoll-theme';

/**
 * Theme preference, shared by the dashboard and the pet popup so a small window that is
 * opened beside the dashboard never disagrees with it about light or dark.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* private window or blocked storage: fall through to the OS preference */
    }
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem(KEY, theme);
    } catch {
      /* remembering the choice is a convenience, never a requirement */
    }
  }, [theme]);

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}
