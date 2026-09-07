// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('theme store', () => {
  beforeEach(() => { vi.resetModules(); localStorage.clear(); delete document.documentElement.dataset.theme; });
  afterEach(() => { delete document.documentElement.dataset.theme; });

  it('defaults to light, applies a chosen theme to the document, and persists it', async () => {
    const { useThemeStore } = await import('./themeStore');
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.dataset.theme).toBeUndefined();

    useThemeStore.getState().setTheme('newspaper');
    expect(document.documentElement.dataset.theme).toBe('newspaper');
    expect(localStorage.getItem('infinite-sudoku-theme')).toBe('newspaper');

    useThemeStore.getState().setTheme('light'); // light means "no attribute", not data-theme="light"
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it('restores a stored theme on load and ignores values it does not know', async () => {
    localStorage.setItem('infinite-sudoku-theme', 'high-contrast');
    let store = await import('./themeStore');
    expect(store.useThemeStore.getState().theme).toBe('high-contrast');
    expect(document.documentElement.dataset.theme).toBe('high-contrast');

    vi.resetModules();
    localStorage.setItem('infinite-sudoku-theme', 'neon');
    store = await import('./themeStore');
    expect(store.useThemeStore.getState().theme).toBe('light');
  });
});
