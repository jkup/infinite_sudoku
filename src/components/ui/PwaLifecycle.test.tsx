// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pwa = vi.hoisted(() => ({
  options: null as null | { onNeedRefresh?: () => void; onOfflineReady?: () => void },
  update: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('virtual:pwa-register', () => ({
  registerSW: vi.fn((options) => {
    pwa.options = options;
    return pwa.update;
  }),
}));

import PwaLifecycle from './PwaLifecycle';
import { useGameStore } from '../../store/gameStore';

describe('PWA lifecycle UI', () => {
  const originalRetry = useGameStore.getState().retryCompletion;
  const retry = vi.fn();

  beforeEach(() => {
    pwa.options = null;
    pwa.update.mockClear();
    retry.mockClear();
    useGameStore.setState({ retryCompletion: retry });
  });

  afterEach(() => {
    cleanup();
    useGameStore.setState({ retryCompletion: originalRetry });
  });

  it('waits for player consent before activating an update', async () => {
    const user = userEvent.setup();
    render(<PwaLifecycle />);
    act(() => pwa.options?.onNeedRefresh?.());

    expect(screen.getByText('An update is ready.')).toBeInTheDocument();
    expect(screen.getByText(/Your puzzle is saved/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update now' }));
    expect(pwa.update).toHaveBeenCalledWith(true);
  });

  it('can defer an update without reloading', async () => {
    const user = userEvent.setup();
    render(<PwaLifecycle />);
    act(() => pwa.options?.onNeedRefresh?.());
    await user.click(screen.getByRole('button', { name: 'Later' }));
    expect(screen.queryByText('An update is ready.')).not.toBeInTheDocument();
    expect(pwa.update).not.toHaveBeenCalled();
  });

  it('announces offline readiness and retries completions when connectivity returns', () => {
    render(<PwaLifecycle />);
    retry.mockClear();
    act(() => pwa.options?.onOfflineReady?.());
    expect(screen.getByText('Ready to play offline.')).toBeInTheDocument();
    act(() => { window.dispatchEvent(new Event('online')); });
    expect(retry).toHaveBeenCalledOnce();
  });
});
