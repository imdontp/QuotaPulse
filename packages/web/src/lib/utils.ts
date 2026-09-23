import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const WINDOW_SIZE_KEY = 'quotapulse_window_size';
const DEFAULT_WIDTH = 1080;
const DEFAULT_HEIGHT = 860;
const MIN_WIDTH = 540;
const MIN_HEIGHT = 640;
const MAX_WIDTH = 2560;
const MAX_HEIGHT = 1440;

export interface WindowSize {
  width: number;
  height: number;
}

export function loadWindowSize(): WindowSize {
  if (typeof window === 'undefined') {
    return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  }
  try {
    const saved = localStorage.getItem(WINDOW_SIZE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<WindowSize>;
      const width = typeof parsed.width === 'number' ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parsed.width)) : DEFAULT_WIDTH;
      const height = typeof parsed.height === 'number' ? Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, parsed.height)) : DEFAULT_HEIGHT;
      return { width, height };
    }
  } catch {
    // If localStorage is unavailable or corrupted, use defaults
  }
  return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
}

export function saveWindowSize(size: WindowSize): void {
  if (typeof window === 'undefined') return;
  try {
    const validated: WindowSize = {
      width: Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, size.width)),
      height: Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, size.height)),
    };
    localStorage.setItem(WINDOW_SIZE_KEY, JSON.stringify(validated));
  } catch {
    // Silently fail if localStorage is unavailable
  }
}

export function resetWindowSize(): WindowSize {
  const defaults = { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  saveWindowSize(defaults);
  return defaults;
}
