// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import ScoreSummary from './ScoreSummary';
import { useGameStore } from '../../store/gameStore';

describe('ScoreSummary', () => {
  it('shows the total and an itemised breakdown from the completed game stats', () => {
    useGameStore.setState({ difficulty: 'hard', mode: 'killer', elapsedMs: 500_000, hintsUsed: 2, errorsMade: 3 });
    render(<ScoreSummary />);

    expect(screen.getByTestId('score-total')).toHaveTextContent('11,630');
    const section = screen.getByRole('region', { name: 'Score' });
    expect(within(section).getByText('Base').nextElementSibling).toHaveTextContent('hard killer');
    expect(within(section).getByText('8:20 (par 8:00)').nextElementSibling).toHaveTextContent('−20');
    expect(within(section).getByText('Hints').nextElementSibling?.nextElementSibling).toHaveTextContent('−200');
    expect(within(section).getByText('Errors').nextElementSibling?.nextElementSibling).toHaveTextContent('−150');
    expect(screen.queryByText(/Minimum score applied/)).not.toBeInTheDocument();
  });

  it('explains when the score floor was applied', () => {
    useGameStore.setState({ difficulty: 'easy', mode: 'classic', elapsedMs: 3_600_000, hintsUsed: 10, errorsMade: 0 });
    render(<ScoreSummary />);

    expect(screen.getByTestId('score-total')).toHaveTextContent('100');
    expect(screen.getByText('Minimum score applied (100 points).')).toBeInTheDocument();
  });
});
