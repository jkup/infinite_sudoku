import { describe, expect, it } from 'vitest';
import { hasUniqueSolution, solveBruteForce, solveWithLogic, Technique, techniqueToDifficulty } from './solver';
import type { Digit } from './types';

const PUZZLE: (Digit | null)[][] = [
  [5, 3, null, null, 7, null, null, null, null],
  [6, null, null, 1, 9, 5, null, null, null],
  [null, 9, 8, null, null, null, null, 6, null],
  [8, null, null, null, 6, null, null, null, 3],
  [4, null, null, 8, null, 3, null, null, 1],
  [7, null, null, null, 2, null, null, null, 6],
  [null, 6, null, null, null, null, 2, 8, null],
  [null, null, null, 4, 1, 9, null, null, 5],
  [null, null, null, null, 8, null, null, 7, 9],
];

describe('solver', () => {
  it('solves a known unique puzzle without mutating the input', () => {
    const original = PUZZLE.map((row) => [...row]);
    const solutions = solveBruteForce(PUZZLE);

    expect(solutions).toHaveLength(1);
    expect(hasUniqueSolution(PUZZLE)).toBe(true);
    expect(PUZZLE).toEqual(original);
    expect(solutions[0][0]).toEqual([5, 3, 4, 6, 7, 8, 9, 1, 2]);
  });

  it('solves the fixture using implemented logic techniques', () => {
    const result = solveWithLogic(PUZZLE);
    expect(result.solved).toBe(true);
    expect(result.steps).toBeGreaterThan(0);
  });

  it('gives up cleanly on contradictory givens instead of looping', () => {
    const contradictory = PUZZLE.map((row) => [...row]);
    contradictory[0][2] = 5; // second 5 in row 0 and box 0
    const result = solveWithLogic(contradictory);
    expect(result.solved).toBe(false);
    expect(solveBruteForce(contradictory)).toHaveLength(0);
  });

  it('reports non-uniqueness for an underconstrained grid', () => {
    const empty: (Digit | null)[][] = Array.from({ length: 9 }, () => Array(9).fill(null));
    expect(hasUniqueSolution(empty)).toBe(false);
    expect(solveBruteForce(empty, 3)).toHaveLength(3);
  });

  it('maps technique levels to public difficulties', () => {
    expect(techniqueToDifficulty(Technique.HiddenSingle)).toBe('easy');
    expect(techniqueToDifficulty(Technique.PointingPair)).toBe('medium');
    expect(techniqueToDifficulty(Technique.NakedPair)).toBe('medium');
    expect(techniqueToDifficulty(Technique.HiddenPair)).toBe('hard');
    expect(techniqueToDifficulty(Technique.NakedTriple)).toBe('hard');
    expect(techniqueToDifficulty(Technique.XWing)).toBe('expert');
    expect(techniqueToDifficulty(Technique.YWing)).toBe('expert');
  });
});
