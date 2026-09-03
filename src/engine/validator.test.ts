import { describe, expect, it } from 'vitest';
import { findConflicts, getDigitCounts, getPeers, isGridComplete, isPuzzleComplete, isPuzzleDefinitionValid } from './validator';
import { gridFromValues } from './types';
import type { Digit, Puzzle } from './types';

const SOLVED_9: Digit[][] = [
  [5, 3, 4, 6, 7, 8, 9, 1, 2],
  [6, 7, 2, 1, 9, 5, 3, 4, 8],
  [1, 9, 8, 3, 4, 2, 5, 6, 7],
  [8, 5, 9, 7, 6, 1, 4, 2, 3],
  [4, 2, 6, 8, 5, 3, 7, 9, 1],
  [7, 1, 3, 9, 2, 4, 8, 5, 6],
  [9, 6, 1, 5, 3, 7, 2, 8, 4],
  [2, 8, 7, 4, 1, 9, 6, 3, 5],
  [3, 4, 5, 2, 8, 6, 1, 7, 9],
];

describe('Sudoku validation', () => {
  it('recognizes a valid completed grid', () => {
    expect(isGridComplete(gridFromValues(SOLVED_9, false))).toBe(true);
  });

  it('reports both cells in a row conflict', () => {
    const values = SOLVED_9.map((row) => [...row]);
    values[0][1] = 5;
    const conflicts = findConflicts(gridFromValues(values, false));

    expect(conflicts.has('0,0')).toBe(true);
    expect(conflicts.has('0,1')).toBe(true);
    expect(isGridComplete(gridFromValues(values, false))).toBe(false);
  });

  it('returns unique peers for both supported grid sizes', () => {
    expect(getPeers(4, 4, 9)).toHaveLength(20);
    expect(getPeers(2, 2, 6)).toHaveLength(12);
    expect(new Set(getPeers(2, 2, 6).map(({ row, col }) => `${row},${col}`)).size).toBe(12);
  });

  it('counts placed digits', () => {
    const grid = gridFromValues(SOLVED_9, false);
    expect([...getDigitCounts(grid).values()]).toEqual(Array(9).fill(9));
  });

  it('requires the canonical solution, not merely a conflict-free full grid', () => {
    const puzzle: Puzzle = {
      initial: SOLVED_9.map((row) => row.map(() => null)), solution: SOLVED_9,
      difficulty: 'easy', mode: 'classic', gridSize: 9,
    };
    const shifted = SOLVED_9.map((row) => row.map((digit) => (digit === 9 ? 1 : digit + 1) as Digit));
    expect(isGridComplete(gridFromValues(shifted, false))).toBe(true);
    expect(isPuzzleComplete(gridFromValues(shifted, false), puzzle)).toBe(false);
  });

  it('rejects killer definitions with missing, overlapping, or incorrect cages', () => {
    const cages = SOLVED_9.flatMap((row, rowIndex) => row.map((digit, colIndex) => ({
      sum: digit, cells: [{ row: rowIndex, col: colIndex }],
    })));
    const puzzle: Puzzle = {
      initial: SOLVED_9.map((row) => row.map(() => null)), solution: SOLVED_9,
      difficulty: 'easy', mode: 'killer', gridSize: 9, cages,
    };
    expect(isPuzzleDefinitionValid(puzzle)).toBe(true);
    expect(isPuzzleDefinitionValid({ ...puzzle, cages: cages.slice(1) })).toBe(false);
    expect(isPuzzleDefinitionValid({ ...puzzle, cages: [{ ...cages[0], sum: cages[0].sum + 1 }, ...cages.slice(1)] })).toBe(false);
  });
});
