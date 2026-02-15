import { writable, derived } from 'svelte/store';

export type ThemePreference = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'dd-theme';

function getStored(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(STORAGE_KEY) as ThemePreference) ?? 'system';
}

function applyTheme(pref: ThemePreference) {
  if (typeof document === 'undefined') return;
  const isDark =
    pref === 'dark' ||
    (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

function createThemeStore() {
  const { subscribe, set } = writable<ThemePreference>(getStored());

  return {
    subscribe,
    set(pref: ThemePreference) {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, pref);
      }
      applyTheme(pref);
      set(pref);
    },
    init() {
      const pref = getStored();
      applyTheme(pref);
      // Listen for OS theme changes when in system mode
      if (typeof window !== 'undefined') {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
          const current = getStored();
          if (current === 'system') applyTheme('system');
        });
      }
    },
  };
}

export const theme = createThemeStore();
