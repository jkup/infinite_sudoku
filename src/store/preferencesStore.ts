import { create } from 'zustand';

const STORAGE_KEY = 'infinite-sudoku-check-answers';

function loadCheckAnswers(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch { /* ignore */ }
  return false;
}

type PreferencesState = {
  checkAnswers: boolean;
  setCheckAnswers: (value: boolean) => void;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  checkAnswers: loadCheckAnswers(),
  setCheckAnswers: (value: boolean) => {
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* ignore */ }
    set({ checkAnswers: value });
  },
}));
