// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Onboarding from './Onboarding';

describe('Onboarding', () => {
  beforeEach(() => localStorage.clear());

  it('walks a first-time player through steps and persists dismissal', async () => {
    const user = userEvent.setup();
    render(<Onboarding />);

    expect(screen.getByRole('heading', { name: 'Welcome to Infinite Sudoku!' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { name: 'Select & Place' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip' }));
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(localStorage.getItem('infinite-sudoku-onboarded')).toBe('1');
  });

  it('stays hidden for a returning player', () => {
    localStorage.setItem('infinite-sudoku-onboarded', '1');
    render(<Onboarding />);
    expect(screen.queryByText('Welcome to Infinite Sudoku!')).not.toBeInTheDocument();
  });
});
