// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gridFromValues } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import { useTutorialStore } from '../../store/tutorialStore';
import { useHintStore } from '../../store/hintStore';
import { TUTORIALS } from '../../data/tutorials';
import Board from './Board';
import DigitBar from './DigitBar';
import ControlBar from '../controls/ControlBar';
import { useKeyboard } from '../../hooks/useKeyboard';

function Game() {
  useKeyboard();
  return <><ControlBar onRequestNewGame={() => {}} /><Board /><DigitBar /></>;
}

describe('cell color highlighting', () => {
  beforeEach(() => {
    const tutorial = TUTORIALS[0];
    useGameStore.setState({
      grid: gridFromValues(tutorial.practicePuzzle.initial, true), puzzle: tutorial.practicePuzzle,
      selectedCell: null, conflicts: new Map(), inputMode: 'digit', status: 'playing', history: [], historyIndex: -1,
    });
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    useHintStore.setState({ hintRevealCell: null });
  });

  it('swaps the digit pad for a palette in color mode and paints the selected cell', async () => {
    const user = userEvent.setup();
    render(<Game />);
    expect(screen.getByRole('group', { name: 'Digit input pad' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Color' }));
    const palette = screen.getByRole('group', { name: 'Cell color palette' });
    expect(palette).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^Paint color \d$/ })).toHaveLength(8);

    const cell = screen.getByRole('gridcell', { name: /^Row 1, Column 1,/ });
    await user.click(cell);
    await user.click(screen.getByRole('button', { name: 'Paint color 3' }));
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(2);
    expect(screen.getByRole('gridcell', { name: /^Row 1, Column 1,.*color 3/ })).toHaveAttribute('data-paint', '2');
    expect(screen.getByRole('button', { name: 'Paint color 3' })).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Clear color' }));
    expect(useGameStore.getState().grid[0][0].colorIndex).toBeNull();
  });

  it('supports the keyboard: C toggles color mode, digits paint, 9 clears', async () => {
    const user = userEvent.setup();
    render(<Game />);
    act(() => useGameStore.getState().selectCell({ row: 0, col: 0 }));

    await user.keyboard('c');
    expect(useGameStore.getState().inputMode).toBe('color');
    await user.keyboard('4');
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(3);
    await user.keyboard('9');
    expect(useGameStore.getState().grid[0][0].colorIndex).toBeNull();
    await user.keyboard('c');
    expect(useGameStore.getState().inputMode).toBe('digit');
  });

  it('keeps a painted cell identifiable while selected', async () => {
    const user = userEvent.setup();
    render(<Game />);
    act(() => {
      useGameStore.getState().selectCell({ row: 0, col: 0 });
      useGameStore.getState().paintCell(6);
    });
    const cell = screen.getByRole('gridcell', { name: /^Row 1, Column 1,.*color 7/ });
    await user.click(cell);
    expect(cell).toHaveAttribute('aria-selected', 'true');
    expect(cell.querySelector('[aria-hidden="true"]')).not.toBeNull(); // swatch shown over the selection color
  });
});
