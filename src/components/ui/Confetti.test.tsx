// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Confetti from './Confetti';

function mockMotionPreference(initial: boolean) {
  let matches = initial;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', vi.fn(() => ({
    matches,
    addEventListener: (_: string, callback: () => void) => listeners.add(callback),
    removeEventListener: (_: string, callback: () => void) => listeners.delete(callback),
  })));
  return {
    listeners,
    change: (value: boolean) => act(() => {
      matches = value;
      listeners.forEach((listener) => listener());
    }),
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('reduced-motion celebrations', () => {
  it('renders no moving celebration when reduced motion is requested', () => {
    mockMotionPreference(true);
    const { container } = render(<Confetti />);
    expect(container).toBeEmptyDOMElement();
    expect(window.matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  });

  it('stops immediately when the preference changes and cleans up the listener', () => {
    const preference = mockMotionPreference(false);
    const { container, unmount } = render(<Confetti />);
    expect(container.querySelector('.confetti')).toHaveAttribute('aria-hidden', 'true');
    preference.change(true);
    expect(container).toBeEmptyDOMElement();
    unmount();
    expect(preference.listeners.size).toBe(0);
  });

  it('does not replay an expired celebration when motion is enabled again', () => {
    vi.useFakeTimers();
    const preference = mockMotionPreference(true);
    const { container } = render(<Confetti />);
    act(() => { vi.advanceTimersByTime(4000); });
    preference.change(false);
    expect(container).toBeEmptyDOMElement();
  });
});
