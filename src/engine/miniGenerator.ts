import type { Digit, Difficulty, Puzzle } from './types';

const MINI_DIGITS: Digit[] = [1, 2, 3, 4, 5, 6];
const SIZE = 6;
const BOX_ROWS = 2;
const BOX_COLS = 3;

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function generateFilledMiniGrid(): Digit[][] {
  const grid: (Digit | null)[][] = Array.from({ length: SIZE }, () =>
    Array(SIZE).fill(null)
  );

  function isValid(row: number, col: number, digit: Digit): boolean {
    for (let c = 0; c < SIZE; c++) {
      if (grid[row][c] === digit) return false;
    }
    for (let r = 0; r < SIZE; r++) {
      if (grid[r][col] === digit) return false;
    }
    const boxR = Math.floor(row / BOX_ROWS) * BOX_ROWS;
    const boxC = Math.floor(col / BOX_COLS) * BOX_COLS;
    for (let r = boxR; r < boxR + BOX_ROWS; r++) {
      for (let c = boxC; c < boxC + BOX_COLS; c++) {
        if (grid[r][c] === digit) return false;
      }
    }
    return true;
  }

  function fill(pos: number): boolean {
    if (pos === SIZE * SIZE) return true;
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;

    const shuffled = shuffle([...MINI_DIGITS]);
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

function hasUniqueSolutionMini(puzzle: (Digit | null)[][]): boolean {
  let solutions = 0;

  function isValid(grid: (Digit | null)[][], row: number, col: number, digit: Digit): boolean {
    for (let c = 0; c < SIZE; c++) {
      if (grid[row][c] === digit) return false;
    }
    for (let r = 0; r < SIZE; r++) {
      if (grid[r][col] === digit) return false;
    }
    const boxR = Math.floor(row / BOX_ROWS) * BOX_ROWS;
    const boxC = Math.floor(col / BOX_COLS) * BOX_COLS;
    for (let r = boxR; r < boxR + BOX_ROWS; r++) {
      for (let c = boxC; c < boxC + BOX_COLS; c++) {
        if (grid[r][c] === digit) return false;
      }
    }
    return true;
  }

  function solve(grid: (Digit | null)[][], pos: number): void {
    if (solutions > 1) return;
    if (pos === SIZE * SIZE) {
      solutions++;
      return;
    }
    const row = Math.floor(pos / SIZE);
    const col = pos % SIZE;

    if (grid[row][col] !== null) {
      solve(grid, pos + 1);
      return;
    }

    for (const d of MINI_DIGITS) {
      if (isValid(grid, row, col, d)) {
        grid[row][col] = d;
        solve(grid, pos + 1);
        grid[row][col] = null;
        if (solutions > 1) return;
      }
    }
  }

  const copy = puzzle.map((row) => [...row]);
  solve(copy, 0);
  return solutions === 1;
}

const MINI_CLUE_TARGETS: Record<Difficulty, { min: number; max: number }> = {
  beginner: { min: 22, max: 26 },
  easy:     { min: 18, max: 22 },
  medium:   { min: 15, max: 18 },
  hard:     { min: 12, max: 15 },
  expert:   { min: 10, max: 14 },
};

export function generateMiniPuzzle(targetDifficulty: Difficulty): Puzzle {
  const { min: minClues } = MINI_CLUE_TARGETS[targetDifficulty];

  const solution = generateFilledMiniGrid();
  const puzzle = solution.map((row) => [...row]) as (Digit | null)[][];

  const positions = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => ({
      row: Math.floor(i / SIZE),
      col: i % SIZE,
    }))
  );

  let clueCount = SIZE * SIZE;

  for (const { row, col } of positions) {
    if (clueCount <= minClues) break;

    const saved = puzzle[row][col];
    puzzle[row][col] = null;

    if (!hasUniqueSolutionMini(puzzle)) {
      puzzle[row][col] = saved;
      continue;
    }

    clueCount--;
  }

  return {
    initial: puzzle,
    solution,
    difficulty: targetDifficulty,
    mode: 'classic',
    gridSize: 6,
  };
}
