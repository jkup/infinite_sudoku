// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { gridFromValues, type Digit, type Puzzle } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import Board from './Board';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

const puzzle: Puzzle = {
  initial: solution.map((row, rowIndex) => row.map((digit, colIndex) =>
    rowIndex === 0 && colIndex < 2 ? null : digit,
  )),
  solution,
  difficulty: 'easy',
  mode: 'classic',
  gridSize: 9,
};

describe('Board keyboard navigation', () => {
  beforeEach(() => {
    useGameStore.setState({
      grid: gridFromValues(puzzle.initial, true),
      puzzle,
      selectedCell: null,
      conflicts: new Map(),
    });
  });

  it('provides one tab stop and selects the cell when focus enters the grid', async () => {
    const user = userEvent.setup();
    render(<Board />);

    const cells = screen.getAllByRole('gridcell');
    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[0]]);

    await user.tab();
    expect(cells[0]).toHaveFocus();
    expect(cells[0]).toHaveAttribute('aria-selected', 'true');
    expect(cells.filter((cell) => cell.tabIndex === 0)).toEqual([cells[0]]);
  });

  it('moves focus and the roving tab stop with arrows, Home, and End', async () => {
    const user = userEvent.setup();
    render(<Board />);
    const cells = screen.getAllByRole('gridcell');

    await user.tab();
    await user.keyboard('{ArrowRight}');
    expect(cells[1]).toHaveFocus();
    expect(cells[1]).toHaveAttribute('tabindex', '0');

    await user.keyboard('{ArrowDown}{End}');
    expect(cells[17]).toHaveFocus();

    await user.keyboard('{Control>}{Home}{/Control}');
    expect(cells[0]).toHaveFocus();
  });

  it('announces editability, givens, conflicts, notes, and cage clues', () => {
    const grid = gridFromValues(puzzle.initial, true);
    grid[0][0].cornerNotes.add(2);
    grid[0][0].centerNotes.add(3);
    useGameStore.setState({ grid, conflicts: new Map([['0,0', [{ row: 0, col: 1 }]]]) });

    render(<Board />);

    expect(screen.getByRole('gridcell', { name: /Row 1, Column 1, empty, editable, conflict, corner notes 2, center notes 3/ }))
      .toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('gridcell', { name: /Row 1, Column 3, value 3, given/ }))
      .toHaveAttribute('aria-readonly', 'true');
  });
});
