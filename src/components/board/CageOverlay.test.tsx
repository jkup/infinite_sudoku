// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { generatePuzzle } from '../../engine/generator';
import { gridFromValues } from '../../engine/types';
import { useGameStore } from '../../store/gameStore';
import Board from './Board';

describe('killer mode board', () => {
  it('draws one cage outline per cage and labels each cage with its sum once', () => {
    const puzzle = generatePuzzle('easy', 'killer');
    useGameStore.setState({
      grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'killer', selectedCell: null,
      conflicts: new Map(), status: 'playing',
    });
    const { container } = render(<Board />);

    const cages = puzzle.cages!;
    expect(container.querySelectorAll('svg path').length).toBe(cages.length);
    const labelled = screen.getAllByRole('gridcell', { name: /cage sum \d+/ });
    expect(labelled).toHaveLength(cages.length);
    // Every cage's sum appears as a label on one of its own cells.
    for (const cage of cages) {
      const inCage = cage.cells.some(({ row, col }) =>
        screen.queryByRole('gridcell', { name: new RegExp(`^Row ${row + 1}, Column ${col + 1},.*cage sum ${cage.sum}$`) }) !== null);
      expect(inCage).toBe(true);
    }
  });
});
