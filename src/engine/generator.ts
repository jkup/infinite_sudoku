import type { Digit, Difficulty, Puzzle } from './types';
import { DIGITS, DIFFICULTY_ORDER } from './types';
import {
  solveWithLogic,
  techniqueToDifficulty,
  hasUniqueSolution,
} from './solver';

/**
 * Generate a complete, valid, randomly-filled Sudoku grid.
 */
function generateFilledGrid(): Digit[][] {
  const grid: (Digit | null)[][] = Array.from({ length: 9 }, () =>
    Array(9).fill(null)
  );

  function isValid(row: number, col: number, digit: Digit): boolean {
    for (let c = 0; c < 9; c++) {
      if (grid[row][c] === digit) return false;
    }
    for (let r = 0; r < 9; r++) {
      if (grid[r][col] === digit) return false;
    }
    const boxR = Math.floor(row / 3) * 3;
    const boxC = Math.floor(col / 3) * 3;
    for (let r = boxR; r < boxR + 3; r++) {
      for (let c = boxC; c < boxC + 3; c++) {
        if (grid[r][c] === digit) return false;
      }
    }
    return true;
  }

  function fill(pos: number): boolean {
    if (pos === 81) return true;
    const row = Math.floor(pos / 9);
    const col = pos % 9;

    const shuffled = shuffle([...DIGITS]);
    for (const d of shuffled) {
      if (isValid(row, col, d)) {
        grid[row][col] = d;
        if (fill(pos + 1)) return true;
        grid[row][col] = null;
      }
    }
    return false;
  }

  fill(0);
  return grid as Digit[][];
}

/**
 * Fisher-Yates shuffle.
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Target clue counts by difficulty.
 * These are starting points — actual count may vary based on technique requirements.
 */
const CLUE_TARGETS: Record<Difficulty, { min: number; max: number }> = {
  beginner: { min: 40, max: 50 },
  easy: { min: 34, max: 40 },
  medium: { min: 28, max: 34 },
  hard: { min: 24, max: 28 },
  expert: { min: 20, max: 26 },
};

/**
 * Generate a puzzle of the given difficulty.
 * Strategy:
 * 1. Generate a filled grid (the solution)
 * 2. Remove cells one at a time in random order
 * 3. After each removal, verify:
 *    a. Unique solution still exists
 *    b. The logic solver can still solve it
 *    c. Required techniques don't exceed target difficulty
 * 4. Stop when we reach the target clue count range and difficulty
 */
export function generatePuzzle(
  targetDifficulty: Difficulty,
  mode: 'classic' = 'classic'
): Puzzle {
  const targetLevel = DIFFICULTY_ORDER.indexOf(targetDifficulty);
  const { min: minClues } = CLUE_TARGETS[targetDifficulty];
  const maxAttempts = 20;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateFilledGrid();
    const puzzle = solution.map((row) => [...row]) as (Digit | null)[][];

    // Create a shuffled list of all cell positions
    const positions = shuffle(
      Array.from({ length: 81 }, (_, i) => ({
        row: Math.floor(i / 9),
        col: i % 9,
      }))
    );

    let clueCount = 81;

    for (const { row, col } of positions) {
      if (clueCount <= minClues) break;

      const saved = puzzle[row][col];
      puzzle[row][col] = null;

      // Must maintain unique solution
      if (!hasUniqueSolution(puzzle)) {
        puzzle[row][col] = saved;
        continue;
      }

      // Check difficulty
      const result = solveWithLogic(puzzle);
      const puzzleDifficulty = techniqueToDifficulty(result.maxTechnique);
      const puzzleLevel = DIFFICULTY_ORDER.indexOf(puzzleDifficulty);

      if (!result.solved || puzzleLevel > targetLevel) {
        // Too hard or can't be solved logically — put it back
        puzzle[row][col] = saved;
        continue;
      }

      clueCount--;
    }

    // Verify the final puzzle matches target difficulty
    const finalResult = solveWithLogic(puzzle);
    const finalDifficulty = techniqueToDifficulty(finalResult.maxTechnique);
    const finalLevel = DIFFICULTY_ORDER.indexOf(finalDifficulty);

    // Accept if it's at the target difficulty or one level below
    // (one level below is acceptable — still a good puzzle)
    if (finalResult.solved && finalLevel >= Math.max(0, targetLevel - 1)) {
      return {
        initial: puzzle,
        solution,
        difficulty: finalDifficulty,
        mode,
      };
    }
  }

  // Fallback: return whatever we can generate
  // This should rarely happen
  const solution = generateFilledGrid();
  const puzzle = solution.map((row) => [...row]) as (Digit | null)[][];

  // Remove cells conservatively for a beginner puzzle
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => ({
      row: Math.floor(i / 9),
      col: i % 9,
    }))
  );

  let removed = 0;
  for (const { row, col } of positions) {
    if (removed >= 81 - CLUE_TARGETS.beginner.max) break;
    const saved = puzzle[row][col];
    puzzle[row][col] = null;
    if (!hasUniqueSolution(puzzle)) {
      puzzle[row][col] = saved;
      continue;
    }
    removed++;
  }

  return {
    initial: puzzle,
    solution,
    difficulty: 'beginner',
    mode,
  };
}
