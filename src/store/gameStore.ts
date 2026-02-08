import { create } from 'zustand';
import type {
  Digit,
  Grid,
  CellPosition,
  GameMode,
  Difficulty,
  GameStatus,
  InputMode,
  Puzzle,
  HistoryEntry,
} from '../engine/types';
import { gridFromValues, DIGITS } from '../engine/types';
import { generatePuzzle } from '../engine/generator';
import { findConflicts, getPeers } from '../engine/validator';

type GameState = {
  // Core state
  grid: Grid;
  puzzle: Puzzle | null;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;

  // Selection
  selectedCell: CellPosition | null;
  inputMode: InputMode;

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;

  // Timer
  elapsedMs: number;
  timerInterval: ReturnType<typeof setInterval> | null;

  // Conflicts
  conflicts: Map<string, CellPosition[]>;

  // Actions
  newGame: (difficulty: Difficulty, mode?: GameMode) => void;
  selectCell: (pos: CellPosition | null) => void;
  placeDigit: (digit: Digit) => void;
  eraseCell: () => void;
  toggleNote: (digit: Digit) => void;
  setInputMode: (mode: InputMode) => void;
  autoNote: () => void;
  undo: () => void;
  redo: () => void;
  tick: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
};

function updateConflicts(grid: Grid): Map<string, CellPosition[]> {
  return findConflicts(grid);
}

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      cornerNotes: new Set(cell.cornerNotes),
      centerNotes: new Set(cell.centerNotes),
    }))
  );
}

function checkCompletion(grid: Grid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c].digit === null) return false;
    }
  }
  return findConflicts(grid).size === 0;
}

export const useGameStore = create<GameState>((set, get) => ({
  grid: [],
  puzzle: null,
  mode: 'classic',
  difficulty: 'easy',
  status: 'playing',
  selectedCell: null,
  inputMode: 'digit',
  history: [],
  historyIndex: -1,
  elapsedMs: 0,
  timerInterval: null,
  conflicts: new Map(),

  newGame: (difficulty, mode = 'classic') => {
    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);

    const puzzle = generatePuzzle(difficulty, mode);
    const grid = gridFromValues(puzzle.initial, true);

    const interval = setInterval(() => {
      const state = get();
      if (state.status === 'playing') {
        set({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    set({
      grid,
      puzzle,
      mode,
      difficulty,
      status: 'playing',
      selectedCell: null,
      inputMode: 'digit',
      history: [],
      historyIndex: -1,
      elapsedMs: 0,
      timerInterval: interval,
      conflicts: new Map(),
    });
  },

  selectCell: (pos) => {
    set({ selectedCell: pos });
  },

  placeDigit: (digit) => {
    const { grid, selectedCell, inputMode, status, history, historyIndex } = get();
    if (!selectedCell || status !== 'playing') return;

    const { row, col } = selectedCell;
    const cell = grid[row][col];
    if (cell.isGiven) return;

    if (inputMode === 'corner' || inputMode === 'center') {
      get().toggleNote(digit);
      return;
    }

    // Digit mode
    const newGrid = cloneGrid(grid);
    const target = newGrid[row][col];

    const entry: HistoryEntry = {
      position: { row, col },
      previousDigit: target.digit,
      newDigit: target.digit === digit ? null : digit,
      previousCornerNotes: new Set(target.cornerNotes),
      newCornerNotes: new Set(target.cornerNotes),
      previousCenterNotes: new Set(target.centerNotes),
      newCenterNotes: new Set(target.centerNotes),
    };

    if (target.digit === digit) {
      // Toggle off
      target.digit = null;
    } else {
      target.digit = digit;
      // Clear notes when placing a digit
      target.cornerNotes.clear();
      target.centerNotes.clear();
      entry.newCornerNotes = new Set();
      entry.newCenterNotes = new Set();
    }

    const conflicts = updateConflicts(newGrid);
    const isComplete = target.digit !== null && checkCompletion(newGrid);

    // Truncate redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      grid: newGrid,
      conflicts,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      status: isComplete ? 'completed' : 'playing',
    });

    if (isComplete) {
      const { timerInterval } = get();
      if (timerInterval) clearInterval(timerInterval);
    }
  },

  eraseCell: () => {
    const { grid, selectedCell, status, history, historyIndex } = get();
    if (!selectedCell || status !== 'playing') return;

    const { row, col } = selectedCell;
    const cell = grid[row][col];
    if (cell.isGiven) return;
    if (cell.digit === null && cell.cornerNotes.size === 0 && cell.centerNotes.size === 0) return;

    const newGrid = cloneGrid(grid);
    const target = newGrid[row][col];

    const entry: HistoryEntry = {
      position: { row, col },
      previousDigit: target.digit,
      newDigit: null,
      previousCornerNotes: new Set(target.cornerNotes),
      newCornerNotes: new Set<Digit>(),
      previousCenterNotes: new Set(target.centerNotes),
      newCenterNotes: new Set<Digit>(),
    };

    target.digit = null;
    target.cornerNotes.clear();
    target.centerNotes.clear();

    const conflicts = updateConflicts(newGrid);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      grid: newGrid,
      conflicts,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  toggleNote: (digit) => {
    const { grid, selectedCell, inputMode, status, history, historyIndex } = get();
    if (!selectedCell || status !== 'playing') return;

    const { row, col } = selectedCell;
    const cell = grid[row][col];
    if (cell.isGiven || cell.digit !== null) return;

    const newGrid = cloneGrid(grid);
    const target = newGrid[row][col];

    const noteSet = inputMode === 'corner' ? 'cornerNotes' : 'centerNotes';

    const entry: HistoryEntry = {
      position: { row, col },
      previousDigit: null,
      newDigit: null,
      previousCornerNotes: new Set(target.cornerNotes),
      newCornerNotes: new Set(target.cornerNotes),
      previousCenterNotes: new Set(target.centerNotes),
      newCenterNotes: new Set(target.centerNotes),
    };

    if (target[noteSet].has(digit)) {
      target[noteSet].delete(digit);
    } else {
      target[noteSet].add(digit);
    }

    if (noteSet === 'cornerNotes') {
      entry.newCornerNotes = new Set(target.cornerNotes);
    } else {
      entry.newCenterNotes = new Set(target.centerNotes);
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(entry);

    set({
      grid: newGrid,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  setInputMode: (mode) => {
    set({ inputMode: mode });
  },

  autoNote: () => {
    const { grid, status } = get();
    if (status !== 'playing') return;

    const newGrid = cloneGrid(grid);

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = newGrid[r][c];
        if (cell.digit !== null) continue;

        // Find all digits already placed in this cell's peers
        const usedDigits = new Set<Digit>();
        for (const peer of getPeers(r, c)) {
          const d = newGrid[peer.row][peer.col].digit;
          if (d !== null) usedDigits.add(d);
        }

        // Candidates = all digits not used by any peer
        const candidates = new Set<Digit>();
        for (const d of DIGITS) {
          if (!usedDigits.has(d)) candidates.add(d);
        }

        cell.cornerNotes = candidates;
      }
    }

    set({ grid: newGrid });
  },

  undo: () => {
    const { grid, history, historyIndex } = get();
    if (historyIndex < 0) return;

    const entry = history[historyIndex];
    const newGrid = cloneGrid(grid);
    const target = newGrid[entry.position.row][entry.position.col];

    target.digit = entry.previousDigit;
    target.cornerNotes = new Set(entry.previousCornerNotes);
    target.centerNotes = new Set(entry.previousCenterNotes);

    set({
      grid: newGrid,
      historyIndex: historyIndex - 1,
      conflicts: updateConflicts(newGrid),
      status: 'playing',
    });
  },

  redo: () => {
    const { grid, history, historyIndex } = get();
    if (historyIndex >= history.length - 1) return;

    const entry = history[historyIndex + 1];
    const newGrid = cloneGrid(grid);
    const target = newGrid[entry.position.row][entry.position.col];

    target.digit = entry.newDigit;
    target.cornerNotes = new Set(entry.newCornerNotes);
    target.centerNotes = new Set(entry.newCenterNotes);

    const conflicts = updateConflicts(newGrid);
    const isComplete = checkCompletion(newGrid);

    set({
      grid: newGrid,
      historyIndex: historyIndex + 1,
      conflicts,
      status: isComplete ? 'completed' : 'playing',
    });
  },

  tick: () => {
    set((state) => ({ elapsedMs: state.elapsedMs + 1000 }));
  },

  pauseGame: () => {
    set({ status: 'paused' });
  },

  resumeGame: () => {
    set({ status: 'playing' });
  },
}));
