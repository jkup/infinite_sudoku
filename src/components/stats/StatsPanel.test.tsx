// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const { useAuth, getStats } = vi.hoisted(() => ({ useAuth: vi.fn(), getStats: vi.fn() }));
vi.mock('@clerk/clerk-react', () => ({ useAuth }));
vi.mock('../../lib/api', () => ({ getStats }));

import StatsPanel from './StatsPanel';
import { utcDateString } from '../../lib/daily';

describe('StatsPanel', () => {
  beforeEach(() => { getStats.mockReset(); });

  it('renders nothing until auth is known, then prompts sign-in', () => {
    useAuth.mockReturnValue({ isLoaded: false, isSignedIn: false });
    const { container, rerender } = render(<StatsPanel />);
    expect(container).toBeEmptyDOMElement();
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: false });
    rerender(<StatsPanel />);
    expect(screen.getByText(/Sign in to track your stats/)).toBeInTheDocument();
    expect(getStats).not.toHaveBeenCalled();
  });

  it('shows the cards and the streak calendar for a signed-in player', async () => {
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    getStats.mockResolvedValue({
      totalGamesCompleted: 12, totalHintsUsed: 3, totalScore: 45_678,
      currentDailyStreak: 4, longestDailyStreak: 9, dailyDates: [utcDateString()],
    });
    render(<StatsPanel />);
    expect(screen.getByText('Loading stats...')).toBeInTheDocument();
    expect(await screen.findByText('45,678')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByRole('grid', { name: /Daily puzzle completions/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/: completed$/)).toBeInTheDocument();
  });

  it('explains when there are no stats yet or the request fails', async () => {
    useAuth.mockReturnValue({ isLoaded: true, isSignedIn: true });
    getStats.mockResolvedValueOnce(null);
    const first = render(<StatsPanel />);
    expect(await screen.findByText(/No stats yet/)).toBeInTheDocument();
    first.unmount();

    getStats.mockRejectedValueOnce(new Error('offline'));
    render(<StatsPanel />);
    expect(await screen.findByText(/No stats yet/)).toBeInTheDocument();
  });
});
