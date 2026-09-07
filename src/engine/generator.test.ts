import { afterEach, describe, expect, it, vi } from 'vitest';
import { generatePuzzle } from './generator';
import { hasUniqueSolution, solveWithLogic } from './solver';
import { findConflicts } from './validator';
import { gridFromValues } from './types';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

describe('full-size puzzle generator', () => {
  afterEach(() => vi.restoreAllMocks());

  it('generates a valid, uniquely solvable classic puzzle from a reproducible seed', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(20_260_902));
    const puzzle = generatePuzzle('easy', 'classic');

    expect(puzzle.gridSize).toBe(9);
    expect(puzzle.mode).toBe('classic');
    expect(puzzle.difficulty).toBe('easy');
    expect(findConflicts(gridFromValues(puzzle.solution, false)).size).toBe(0);
    expect(hasUniqueSolution(puzzle.initial)).toBe(true);

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const clue = puzzle.initial[row][col];
        if (clue !== null) expect(clue).toBe(puzzle.solution[row][col]);
      }
    }
  });

  it('only ever returns puzzles the logic solver finishes with the true solution', () => {
    // This holds for the fallback path too: it used to check uniqueness only,
    // so an "easy" fallback could require guessing and the solver would stall.
    // Generation time varies (medium can take a few seconds on a CI runner),
    // hence the generous timeout; the assertion itself is deterministic.
    for (const difficulty of ['easy', 'medium'] as const) {
      const puzzle = generatePuzzle(difficulty, 'classic');
      const result = solveWithLogic(puzzle.initial);
      expect(result.solved).toBe(true);
      expect(result.grid).toEqual(puzzle.solution);
    }
  }, 30_000);

  it('generates killer cages that tile the returned solution', () => {
    vi.spyOn(Math, 'random').mockImplementation(seededRandom(20_260_903));
    const puzzle = generatePuzzle('easy', 'killer');
    const cages = puzzle.cages ?? [];
    const cells = cages.flatMap((cage) => cage.cells);

    expect(cells).toHaveLength(81);
    expect(new Set(cells.map(({ row, col }) => `${row},${col}`)).size).toBe(81);
    for (const cage of cages) {
      expect(cage.sum).toBe(cage.cells.reduce(
        (sum, { row, col }) => sum + puzzle.solution[row][col],
        0,
      ));
    }
  });
});
