// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { useAuth, getStats } = vi.hoisted(() => ({ useAuth: vi.fn(), getStats: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useAuth }));
vi.mock('../../lib/api', () => ({ getStats }));

import DailyPicker, { DailyPickerWithProgress } from './DailyPicker';
import { useGameStore } from '../../store/gameStore';
import { addDays, utcDateString } from '../../lib/daily';
import type { Puzzle } from '../../engine/types';

const puzzle = { initial: [], solution: [], difficulty: 'easy', mode: 'killer', gridSize: 9 } as unknown as Puzzle;
const today = utcDateString();
const yesterday = addDays(today, -1);

describe('DailyPicker', () => {
  beforeEach(() => {
    useGameStore.setState({ mode: 'killer', puzzle: { ...puzzle, daily: undefined }, completionSyncStatus: 'idle' });
  });

  it('lists today and recent days with difficulty, and starts the chosen date in the current mode', async () => {
    const user = userEvent.setup();
    const onRequestDaily = vi.fn();
    render(<DailyPicker onRequestDaily={onRequestDaily} completedDates={[yesterday]} />);

    const trigger = screen.getByRole('button', { name: /Daily/ });
    expect(trigger).toHaveAttribute('aria-pressed', 'false');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Daily puzzles' });
    const items = within(dialog).getAllByRole('button');
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toHaveAccessibleName(/^Today, .*(Easy|Medium|Hard|Expert)$/);
    expect(items[1]).toHaveAccessibleName(/, completed$/);
    expect(within(dialog).getByText(/don't change your streak/)).toBeInTheDocument();

    await user.click(items[1]);
    expect(onRequestDaily).toHaveBeenCalledWith('killer', yesterday);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('marks the daily being played and does not restart it', async () => {
    const user = userEvent.setup();
    const onRequestDaily = vi.fn();
    useGameStore.setState({ puzzle: { ...puzzle, daily: { id: 1, date: today } } });
    render(<DailyPicker onRequestDaily={onRequestDaily} />);

    expect(screen.getByRole('button', { name: /Daily/ })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: /Daily/ }));
    const current = screen.getByRole('button', { name: /playing now$/ });
    expect(current).toHaveAttribute('aria-current', 'true');
    await user.click(current);
    expect(onRequestDaily).not.toHaveBeenCalled();
  });

  it('with progress: fetches completed dates when signed in and refetches after a sync', async () => {
    const user = userEvent.setup();
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    getStats.mockResolvedValue({ dailyDates: [today] });
    render(<DailyPickerWithProgress onRequestDaily={vi.fn()} />);
    await vi.waitFor(() => expect(getStats).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /Daily/ }));
    expect(screen.getByRole('button', { name: /^Today, .*completed$/ })).toBeInTheDocument();

    useGameStore.setState({ completionSyncStatus: 'synced' });
    await vi.waitFor(() => expect(getStats).toHaveBeenCalledTimes(2));
  });

  it('with progress: shows no marks when signed out and never calls the API', () => {
    getStats.mockReset();
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    render(<DailyPickerWithProgress onRequestDaily={vi.fn()} />);
    expect(getStats).not.toHaveBeenCalled();
  });
});
