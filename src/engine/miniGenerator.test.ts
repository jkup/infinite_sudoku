import { describe, expect, it } from 'vitest';
import { generateMiniPuzzle } from './miniGenerator';
import { findConflicts } from './validator';
import { gridFromValues } from './types';

describe('mini puzzle generator', () => {
  it.each(['easy', 'medium', 'hard', 'expert'] as const)('generates a valid %s 6x6 puzzle', (difficulty) => {
    const puzzle = generateMiniPuzzle(difficulty);
    const clues = puzzle.initial.flat().filter((digit) => digit !== null).length;

    expect(puzzle.gridSize).toBe(6);
    expect(puzzle.difficulty).toBe(difficulty);
    expect(puzzle.initial).toHaveLength(6);
    expect(puzzle.initial.every((row) => row.length === 6)).toBe(true);
    expect(findConflicts(gridFromValues(puzzle.solution, false)).size).toBe(0);
    expect(clues).toBeGreaterThanOrEqual({ easy: 20, medium: 15, hard: 12, expert: 10 }[difficulty]);

    for (let row = 0; row < 6; row++) {
      for (let col = 0; col < 6; col++) {
        const clue = puzzle.initial[row][col];
        if (clue !== null) expect(clue).toBe(puzzle.solution[row][col]);
      }
    }
  });
});
