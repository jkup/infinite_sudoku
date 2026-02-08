export type Digit = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type CellPosition = {
  row: number; // 0-8
  col: number; // 0-8
};

export type Cell = {
  position: CellPosition;
  digit: Digit | null;
  isGiven: boolean;
  cornerNotes: Set<Digit>;
  centerNotes: Set<Digit>;
  colorIndex: number | null; // 0-7 for cell highlighting
  isError: boolean;
};

export type Grid = Cell[][];

export type Cage = {
  sum: number;
  cells: CellPosition[];
};

export type Difficulty = 'beginner' | 'easy' | 'medium' | 'hard' | 'expert';

export type GameMode = 'classic' | 'killer';

export type GameStatus = 'playing' | 'paused' | 'completed';

export type InputMode = 'digit' | 'corner' | 'center' | 'color';

export type Puzzle = {
  initial: (Digit | null)[][]; // 9x9 grid of initial values
  solution: Digit[][];         // 9x9 solved grid
  difficulty: Difficulty;
  mode: GameMode;
  cages?: Cage[];              // Only for killer mode
};

/** A snapshot of one cell's before/after state within a single undoable action. */
export type CellChange = {
  position: CellPosition;
  previousDigit: Digit | null;
  newDigit: Digit | null;
  previousCornerNotes: Set<Digit>;
  newCornerNotes: Set<Digit>;
  previousCenterNotes: Set<Digit>;
  newCenterNotes: Set<Digit>;
};

/**
 * One undoable action. May affect multiple cells
 * (e.g. placing a digit also removes that digit from peer notes).
 */
export type HistoryEntry = {
  changes: CellChange[];
};

export const DIFFICULTY_ORDER: Difficulty[] = [
  'beginner',
  'easy',
  'medium',
  'hard',
  'expert',
];

export const DIGITS: Digit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export function getBox(row: number, col: number): number {
  return Math.floor(row / 3) * 3 + Math.floor(col / 3);
}

export function createEmptyGrid(): Grid {
  return Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => ({
      position: { row, col },
      digit: null,
      isGiven: false,
      cornerNotes: new Set<Digit>(),
      centerNotes: new Set<Digit>(),
      colorIndex: null,
      isError: false,
    }))
  );
}

export function gridFromValues(values: (Digit | null)[][], asGivens: boolean): Grid {
  return Array.from({ length: 9 }, (_, row) =>
    Array.from({ length: 9 }, (_, col) => ({
      position: { row, col },
      digit: values[row][col],
      isGiven: asGivens && values[row][col] !== null,
      cornerNotes: new Set<Digit>(),
      centerNotes: new Set<Digit>(),
      colorIndex: null,
      isError: false,
    }))
  );
}
