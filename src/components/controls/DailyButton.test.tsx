// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DailyButton from './DailyButton';
import { useGameStore } from '../../store/gameStore';
import { utcDateString } from '../../lib/daily';
import type { Puzzle } from '../../engine/types';

const puzzle = { initial: [], solution: [], difficulty: 'easy', mode: 'killer', gridSize: 9 } as unknown as Puzzle;

describe('DailyButton', () => {
  it('requests the daily in the current mode', async () => {
    const user = userEvent.setup();
    const onRequestDaily = vi.fn();
    useGameStore.setState({ mode: 'killer', puzzle: { ...puzzle, daily: undefined } });
    render(<DailyButton onRequestDaily={onRequestDaily} />);

    const button = screen.getByRole('button', { name: 'Daily' });
    expect(button).toHaveAttribute('aria-pressed', 'false');
    await user.click(button);
    expect(onRequestDaily).toHaveBeenCalledWith('killer');
  });

  it("shows as active and stays put while playing today's daily", async () => {
    const user = userEvent.setup();
    const onRequestDaily = vi.fn();
    useGameStore.setState({ mode: 'killer', puzzle: { ...puzzle, daily: { id: 1, date: utcDateString() } } });
    render(<DailyButton onRequestDaily={onRequestDaily} />);

    const button = screen.getByRole('button', { name: 'Daily' });
    expect(button).toHaveAttribute('aria-pressed', 'true');
    await user.click(button);
    expect(onRequestDaily).not.toHaveBeenCalled();
  });

  it("treats an older daily as not today's", () => {
    useGameStore.setState({ mode: 'classic', puzzle: { ...puzzle, daily: { id: 1, date: '2020-01-01' } } });
    render(<DailyButton onRequestDaily={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Daily' })).toHaveAttribute('aria-pressed', 'false');
  });
});
