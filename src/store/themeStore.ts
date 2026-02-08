import { create } from 'zustand';

export type Theme = 'light' | 'dark' | 'newspaper' | 'high-contrast';

const STORAGE_KEY = 'infinite-sudoku-theme';

function applyTheme(theme: Theme) {
  if (theme === 'light') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

function loadTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'newspaper' || stored === 'high-contrast') {
      return stored;
    }
  } catch { /* ignore */ }
  return 'light';
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

export const useThemeStore = create<ThemeState>((set) => {
  const initial = loadTheme();
  applyTheme(initial);

  return {
    theme: initial,
    setTheme: (theme: Theme) => {
      applyTheme(theme);
      try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
      set({ theme });
    },
  };
});
