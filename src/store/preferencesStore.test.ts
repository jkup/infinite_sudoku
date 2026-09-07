// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('preferences store', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear(); });

  it('defaults check-answers off and persists changes', async () => {
    const { usePreferencesStore } = await import('./preferencesStore');
    expect(usePreferencesStore.getState().checkAnswers).toBe(false);
    usePreferencesStore.getState().setCheckAnswers(true);
    expect(usePreferencesStore.getState().checkAnswers).toBe(true);
    expect(localStorage.getItem('infinite-sudoku-check-answers')).toBe('true');
  });

  it('restores the stored preference on load', async () => {
    localStorage.setItem('infinite-sudoku-check-answers', 'true');
    const { usePreferencesStore } = await import('./preferencesStore');
    expect(usePreferencesStore.getState().checkAnswers).toBe(true);
  });
});
