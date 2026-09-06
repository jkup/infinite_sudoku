// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import StreakCalendar from './StreakCalendar';
import { addDays, utcDateString } from '../../lib/daily';

describe('StreakCalendar', () => {
  it('renders the trailing weeks with completed days, today, and streak totals', () => {
    const today = utcDateString();
    const yesterday = addDays(today, -1);
    render(<StreakCalendar dailyDates={[yesterday]} currentStreak={1} longestStreak={4} weeks={2} />);

    const grid = screen.getByRole('grid', { name: 'Daily puzzle completions, last 2 weeks' });
    expect(within(grid).getAllByRole('row')).toHaveLength(3); // header + 2 weeks
    expect(within(grid).getAllByRole('gridcell')).toHaveLength(14);
    expect(within(grid).getByLabelText(/: not completed yet$/)).toHaveAttribute('aria-label', expect.stringContaining(
      new Date(`${today}T00:00:00Z`).toLocaleDateString(undefined, { month: 'long', day: 'numeric', timeZone: 'UTC' }),
    ));
    expect(within(grid).getAllByLabelText(/: completed$/)).toHaveLength(1);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });
});
