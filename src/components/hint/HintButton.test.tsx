// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gridFromValues } from '../../engine/types';
import { TUTORIALS } from '../../data/tutorials';
import { useGameStore } from '../../store/gameStore';
import { useHintStore } from '../../store/hintStore';
import HintButton from './HintButton';

describe('HintButton', () => {
  beforeEach(() => {
    const puzzle = TUTORIALS[0].practicePuzzle;
    useGameStore.setState({ grid: gridFromValues(puzzle.initial, true), puzzle, status: 'playing', selectedCell: null, difficulty: 'medium' });
    useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  });

  it('is disabled until an empty, editable cell is selected while playing', () => {
    const { rerender } = render(<HintButton />);
    const button = screen.getByRole('button', { name: 'Hint' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Select an empty cell first');

    const given = useGameStore.getState().grid.flat().find((c) => c.isGiven)!.position;
    useGameStore.setState({ selectedCell: given });
    rerender(<HintButton />);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();

    const empty = useGameStore.getState().grid.flat().find((c) => !c.isGiven && c.digit === null)!.position;
    useGameStore.setState({ selectedCell: empty });
    rerender(<HintButton />);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Hint' })).toHaveAttribute('title', 'Solve a easy puzzle to earn this hint');

    useGameStore.setState({ status: 'paused' });
    rerender(<HintButton />);
    expect(screen.getByRole('button', { name: 'Hint' })).toBeDisabled();
  });

  it('offers a free reveal at the easiest difficulty and forwards the request', async () => {
    const user = userEvent.setup();
    const empty = useGameStore.getState().grid.flat().find((c) => !c.isGiven && c.digit === null)!.position;
    useGameStore.setState({ selectedCell: empty, difficulty: 'easy' });
    const requestHint = vi.fn();
    useHintStore.setState({ requestHint });
    render(<HintButton />);
    const reveal = screen.getByRole('button', { name: 'Reveal' });
    expect(reveal).toHaveAttribute('title', 'Reveal answer (free at Beginner)');
    await user.click(reveal);
    expect(requestHint).toHaveBeenCalledOnce();
  });

  it('explains how hints work in a dismissible dialog', async () => {
    const user = userEvent.setup();
    render(<HintButton />);
    await user.click(screen.getByRole('button', { name: 'How hints work' }));
    const dialog = screen.getByRole('dialog', { name: 'How Hints Work' });
    expect(dialog).toHaveTextContent(/slightly easier puzzle/);
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
