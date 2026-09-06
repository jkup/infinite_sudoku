// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';

const { useAuth, getLeaderboard } = vi.hoisted(() => ({ useAuth: vi.fn(), getLeaderboard: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useAuth }));
vi.mock('../../lib/api', () => ({ getLeaderboard }));

import Leaderboard from './Leaderboard';
import type { LeaderboardResponse } from '../../lib/api';

const board: LeaderboardResponse = {
  date: '2026-09-06', mode: 'classic', totalEntries: 60,
  entries: [
    { rank: 1, displayName: 'Ada L.', score: 15_000, solveTimeMs: 500_000, difficulty: 'expert', completedAt: '', isYou: false },
    { rank: 2, displayName: null, score: 14_200, solveTimeMs: 640_000, difficulty: 'expert', completedAt: '', isYou: false },
  ],
  you: { rank: 57, score: 2_000, solveTimeMs: 3_000_000 },
};

describe('Leaderboard', () => {
  beforeEach(() => {
    getLeaderboard.mockReset();
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
  });

  it('lists ranked entries, names anonymous players, and shows your standing when unlisted', async () => {
    getLeaderboard.mockResolvedValue(board);
    render(<Leaderboard date="2026-09-06" mode="classic" />);

    const list = await screen.findByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('1.Ada L.8:2015,000');
    expect(items[1]).toHaveTextContent('Anonymous');
    expect(screen.getByText('You: #57 of 60 with 2,000 points.')).toBeInTheDocument();
    expect(getLeaderboard).toHaveBeenCalledWith('2026-09-06', 'classic');
  });

  it('highlights your own row and refetches when the refresh key changes', async () => {
    const mine = { ...board, entries: [{ ...board.entries[0], isYou: true }], you: { rank: 1, score: 15_000, solveTimeMs: 500_000 } };
    getLeaderboard.mockResolvedValue(mine);
    const { rerender } = render(<Leaderboard date="2026-09-06" mode="classic" refreshKey="syncing" />);

    const row = await screen.findByRole('listitem');
    expect(row).toHaveAttribute('aria-current', 'true');
    expect(row).toHaveTextContent('Ada L. (you)');
    expect(screen.queryByText(/^You: #/)).not.toBeInTheDocument();

    rerender(<Leaderboard date="2026-09-06" mode="classic" refreshKey="synced" />);
    await vi.waitFor(() => expect(getLeaderboard).toHaveBeenCalledTimes(2));
  });

  it('prompts for sign-in, and reports empty and failed boards', async () => {
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    const { unmount } = render(<Leaderboard date="2026-09-06" mode="killer" />);
    expect(screen.getByText("Sign in to see today's rankings.")).toBeInTheDocument();
    expect(getLeaderboard).not.toHaveBeenCalled();
    unmount();

    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    getLeaderboard.mockResolvedValueOnce({ ...board, entries: [], you: null, totalEntries: 0 });
    const empty = render(<Leaderboard date="2026-09-06" mode="killer" />);
    expect(await screen.findByText(/Be the first!/)).toBeInTheDocument();
    empty.unmount();

    getLeaderboard.mockRejectedValueOnce(new Error('offline'));
    render(<Leaderboard date="2026-09-06" mode="killer" />);
    expect(await screen.findByText("Couldn't load the leaderboard.")).toBeInTheDocument();
  });
});
