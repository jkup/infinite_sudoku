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
  CellChange,
  HistoryEntry,
} from '../engine/types';
import { gridFromValues, DIGITS } from '../engine/types';
import { generatePuzzle } from '../engine/generator';
import { findConflicts, getPeers } from '../engine/validator';
import { getCageForCell } from '../engine/killer';
import { saveGame, loadGame } from '../lib/persistence';
import { postGameResult } from '../lib/api';
import { calculateScore } from '../lib/scoring';

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
  loadSavedGame: () => boolean;
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

/** Fire-and-forget cloud save when a game completes */
function saveToCloud(state: {
  mode: GameMode;
  difficulty: Difficulty;
  elapsedMs: number;
}): void {
  const score = calculateScore({
    difficulty: state.difficulty,
    mode: state.mode,
    solveTimeMs: state.elapsedMs,
    hintsUsed: 0,
    errorsMade: 0,
  });

  postGameResult({
    mode: state.mode,
    difficulty: state.difficulty,
    solveTimeMs: state.elapsedMs,
    hintsUsed: 0,
    maxHintDepth: 0,
    errorsMade: 0,
    score,
  }).catch(() => {
    // Cloud save is best-effort — fail silently
  });
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
    const changes: CellChange[] = [];

    const primaryChange: CellChange = {
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
      primaryChange.newCornerNotes = new Set();
      primaryChange.newCenterNotes = new Set();

      // Auto-remove this digit from notes in all peer cells
      for (const peer of getPeers(row, col)) {
        const peerCell = newGrid[peer.row][peer.col];
        if (peerCell.digit !== null) continue;
        const hadCorner = peerCell.cornerNotes.has(digit);
        const hadCenter = peerCell.centerNotes.has(digit);
        if (!hadCorner && !hadCenter) continue;

        const peerChange: CellChange = {
          position: peer,
          previousDigit: null,
          newDigit: null,
          previousCornerNotes: new Set(peerCell.cornerNotes),
          previousCenterNotes: new Set(peerCell.centerNotes),
          newCornerNotes: new Set(peerCell.cornerNotes),
          newCenterNotes: new Set(peerCell.centerNotes),
        };

        if (hadCorner) peerCell.cornerNotes.delete(digit);
        if (hadCenter) peerCell.centerNotes.delete(digit);

        peerChange.newCornerNotes = new Set(peerCell.cornerNotes);
        peerChange.newCenterNotes = new Set(peerCell.centerNotes);
        changes.push(peerChange);
      }
    }

    changes.unshift(primaryChange);

    const conflicts = updateConflicts(newGrid);
    const isComplete = target.digit !== null && checkCompletion(newGrid);

    // Truncate redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes });

    set({
      grid: newGrid,
      conflicts,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      status: isComplete ? 'completed' : 'playing',
    });

    if (isComplete) {
      const { timerInterval, mode, difficulty, elapsedMs } = get();
      if (timerInterval) clearInterval(timerInterval);
      saveToCloud({ mode, difficulty, elapsedMs });
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

    const change: CellChange = {
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
    newHistory.push({ changes: [change] });

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

    const change: CellChange = {
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
      change.newCornerNotes = new Set(target.cornerNotes);
    } else {
      change.newCenterNotes = new Set(target.centerNotes);
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes: [change] });

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
    const { grid, puzzle, status, history, historyIndex } = get();
    if (status !== 'playing') return;

    const newGrid = cloneGrid(grid);
    const cages = puzzle?.cages;
    const changes: CellChange[] = [];

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell = newGrid[r][c];
        if (cell.digit !== null) continue;

        // Standard Sudoku: eliminate digits seen in row/col/box
        const usedDigits = new Set<Digit>();
        for (const peer of getPeers(r, c)) {
          const d = newGrid[peer.row][peer.col].digit;
          if (d !== null) usedDigits.add(d);
        }

        const candidates = new Set<Digit>();
        for (const d of DIGITS) {
          if (!usedDigits.has(d)) candidates.add(d);
        }

        // Killer mode: also eliminate digits already placed in the same cage
        if (cages) {
          const cage = getCageForCell(cages, r, c);
          if (cage) {
            for (const cageCell of cage.cells) {
              if (cageCell.row === r && cageCell.col === c) continue;
              const d = newGrid[cageCell.row][cageCell.col].digit;
              if (d !== null) candidates.delete(d);
            }
          }
        }

        // Only record a change if notes actually differ
        const prevCorner = cell.cornerNotes;
        const prevCenter = cell.centerNotes;
        const notesChanged =
          candidates.size !== prevCorner.size ||
          [...candidates].some((d) => !prevCorner.has(d));

        if (notesChanged || prevCenter.size > 0) {
          changes.push({
            position: { row: r, col: c },
            previousDigit: null,
            newDigit: null,
            previousCornerNotes: new Set(prevCorner),
            newCornerNotes: new Set(candidates),
            previousCenterNotes: new Set(prevCenter),
            newCenterNotes: new Set<Digit>(),
          });
          cell.cornerNotes = candidates;
          cell.centerNotes = new Set<Digit>();
        }
      }
    }

    if (changes.length === 0) return;

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes });

    set({
      grid: newGrid,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  loadSavedGame: () => {
    const saved = loadGame();
    if (!saved) return false;

    const { timerInterval } = get();
    if (timerInterval) clearInterval(timerInterval);

    const interval = setInterval(() => {
      const state = get();
      if (state.status === 'playing') {
        set({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    set({
      grid: saved.grid,
      puzzle: saved.puzzle,
      mode: saved.mode,
      difficulty: saved.difficulty,
      status: saved.status,
      inputMode: saved.inputMode,
      history: saved.history,
      historyIndex: saved.historyIndex,
      elapsedMs: saved.elapsedMs,
      timerInterval: interval,
      selectedCell: null,
      conflicts: updateConflicts(saved.grid),
    });
    return true;
  },

  undo: () => {
    const { grid, history, historyIndex } = get();
    if (historyIndex < 0) return;

    const entry = history[historyIndex];
    const newGrid = cloneGrid(grid);

    // Reverse all changes in this entry
    for (const change of entry.changes) {
      const target = newGrid[change.position.row][change.position.col];
      target.digit = change.previousDigit;
      target.cornerNotes = new Set(change.previousCornerNotes);
      target.centerNotes = new Set(change.previousCenterNotes);
    }

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

    // Reapply all changes in this entry
    for (const change of entry.changes) {
      const target = newGrid[change.position.row][change.position.col];
      target.digit = change.newDigit;
      target.cornerNotes = new Set(change.newCornerNotes);
      target.centerNotes = new Set(change.newCenterNotes);
    }

    const conflicts = updateConflicts(newGrid);
    const isComplete = checkCompletion(newGrid);

    set({
      grid: newGrid,
      historyIndex: historyIndex + 1,
      conflicts,
      status: isComplete ? 'completed' : 'playing',
    });

    if (isComplete) {
      const { mode, difficulty, elapsedMs } = get();
      saveToCloud({ mode, difficulty, elapsedMs });
    }
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

// Auto-save on every state change (debounced slightly)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
useGameStore.subscribe((state) => {
  if (!state.puzzle) return;
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveGame({
      grid: state.grid,
      puzzle: state.puzzle!,
      mode: state.mode,
      difficulty: state.difficulty,
      status: state.status,
      inputMode: state.inputMode,
      history: state.history,
      historyIndex: state.historyIndex,
      elapsedMs: state.elapsedMs,
    });
  }, 500);
});
