// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gridFromValues } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useHintStore } from '../../store/hintStore';
import { TUTORIALS } from '../../data/tutorials';
import Board from './Board';
import DigitBar from './DigitBar';
import ControlBar from '../controls/ControlBar';
import TutorialBoard from '../tutorial/TutorialBoard';

describe('non-color game status', () => {
  beforeEach(() => {
    const tutorial = TUTORIALS[0];
    useGameStore.setState({ grid: gridFromValues(tutorial.practicePuzzle.initial, true), puzzle: tutorial.practicePuzzle, selectedCell: null, conflicts: new Map(), inputMode: 'digit' });
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    useHintStore.setState({ hintRevealCell: null });
  });

  it('exposes a completed digit as a checkmark and an accessible disabled state', () => {
    const { solution } = TUTORIALS[0].practicePuzzle;
    useGameStore.setState({ grid: gridFromValues(solution, true) });
    render(<DigitBar />);
    const digit = screen.getByRole('button', { name: 'Place digit 1, all placed' });
    expect(digit).toBeDisabled();
    expect(within(digit).getByText('✓')).toBeVisible();
    expect(within(digit).getByText('✓')).toHaveAttribute('aria-hidden', 'true');
  });

  it('moves the pressed-state cue when the player switches note modes', async () => {
    const user = userEvent.setup();
    render(<ControlBar onRequestNewGame={() => {}} />);
    expect(screen.getByRole('button', { name: 'Digit' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Corner' }));
    expect(screen.getByRole('button', { name: 'Digit' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: 'Corner' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('identifies tutorial targets in diagrams and practice, then clears the cue when filled', () => {
    const tutorial = TUTORIALS[0];
    const { unmount } = render(<TutorialBoard board={tutorial.lessonBoard} highlightCells={tutorial.highlightCells} highlightNotes={tutorial.highlightNotes} />);
    expect(screen.getAllByRole('img', { name: /tutorial target/ }).length).toBeGreaterThan(0);
    expect(screen.getByText(/Double outline: target/)).toBeVisible();
    unmount();
    useTutorialStore.setState({ phase: 'practice', activeTutorialId: tutorial.id });
    render(<Board />);
    const target = tutorial.focusCells[0];
    const cell = screen.getByRole('gridcell', { name: new RegExp(`Row ${target.row + 1}, Column ${target.col + 1},.*tutorial target`) });
    expect(cell).toHaveAttribute('data-highlight', 'target');
    act(() => {
      const grid = gridFromValues(tutorial.practicePuzzle.solution, true);
      useGameStore.setState({ grid });
    });
    expect(screen.queryByRole('gridcell', { name: /tutorial target/ })).not.toBeInTheDocument();
  });
});
