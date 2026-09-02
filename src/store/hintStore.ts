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
import { DIFFICULTY_ORDER, gridFromValues } from '../engine/types';
import { generateMiniPuzzleAsync } from '../engine/generateAsync';
import { findConflicts } from '../engine/validator';
import { useGameStore } from './gameStore';

/**
 * A snapshot of a game state saved when the player requests a hint.
 * When the hint puzzle is solved (or abandoned), we restore this.
 */
export type StackEntry = {
  grid: Grid;
  puzzle: Puzzle;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  inputMode: InputMode;
  history: HistoryEntry[];
  historyIndex: number;
  elapsedMs: number;
  hintsUsed: number;
  errorsMade: number;
  hintCell: CellPosition; // The cell in THIS puzzle that needs the hint
  hintDigit: Digit;       // The answer for that cell
};

export type TransitionDirection = 'deeper' | 'back' | null;

type HintState = {
  stack: StackEntry[];
  transition: TransitionDirection;
  hintRevealCell: CellPosition | null;

  // Actions
  requestHint: () => void;
  completeHintPuzzle: () => void;
  abandonHintPuzzle: () => void;
  abandonToLevel: (level: number) => void;
  clearTransition: () => void;
  clearHintReveal: () => void;
};

function cloneGrid(grid: Grid): Grid {
  return grid.map((row) =>
    row.map((cell) => ({
      ...cell,
      cornerNotes: new Set(cell.cornerNotes),
      centerNotes: new Set(cell.centerNotes),
    }))
  );
}

function cloneHistory(history: HistoryEntry[]): HistoryEntry[] {
  return history.map((entry) => ({
    changes: entry.changes.map((c) => ({
      ...c,
      previousCornerNotes: new Set(c.previousCornerNotes),
      newCornerNotes: new Set(c.newCornerNotes),
      previousCenterNotes: new Set(c.previousCenterNotes),
      newCenterNotes: new Set(c.newCenterNotes),
    })),
  }));
}

export const useHintStore = create<HintState>((set, get) => ({
  stack: [],
  transition: null,
  hintRevealCell: null,

  clearTransition: () => set({ transition: null }),
  clearHintReveal: () => set({ hintRevealCell: null }),

  requestHint: () => {
    const game = useGameStore.getState();
    if (!game.puzzle || !game.selectedCell) return;
    if (game.status !== 'playing') return;

    const { row, col } = game.selectedCell;
    const cell = game.grid[row][col];

    // Can't hint on given cells or already-filled cells
    if (cell.isGiven || cell.digit !== null) return;

    const hintDigit = game.puzzle.solution[row][col] as Digit;
    const currentDiffIndex = DIFFICULTY_ORDER.indexOf(game.difficulty);

    // At easy, hints are free — just reveal the answer
    if (currentDiffIndex <= 0) {
      game.revealHint({ row, col }, hintDigit);
      return;
    }

    // Increment hint count before snapshotting so it's preserved in the stack
    const updatedHintsUsed = game.hintsUsed + 1;
    useGameStore.setState({ hintsUsed: updatedHintsUsed });

    // Save current game state to the stack
    const snapshot: StackEntry = {
      grid: cloneGrid(game.grid),
      puzzle: game.puzzle,
      mode: game.mode,
      difficulty: game.difficulty,
      status: game.status,
      inputMode: game.inputMode,
      history: cloneHistory(game.history),
      historyIndex: game.historyIndex,
      elapsedMs: game.elapsedMs,
      hintsUsed: updatedHintsUsed,
      errorsMade: game.errorsMade,
      hintCell: { row, col },
      hintDigit,
    };

    // Generate an easier puzzle (off main thread when possible)
    const easierDifficulty = DIFFICULTY_ORDER[currentDiffIndex - 1];

    // Push onto stack immediately
    set({ stack: [...get().stack, snapshot], transition: 'deeper' });

    void generateMiniPuzzleAsync(easierDifficulty).then((hintPuzzle) => {
      const hintGrid = gridFromValues(hintPuzzle.initial, true);

      // Clear the timer interval and start a fresh one for the hint puzzle
      const prevInterval = useGameStore.getState().timerInterval;
      if (prevInterval) clearInterval(prevInterval);
      const interval = setInterval(() => {
        const state = useGameStore.getState();
        if (state.status === 'playing') {
          useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
        }
      }, 1000);

      // Load the hint puzzle into the game store
      useGameStore.setState({
        grid: hintGrid,
        puzzle: hintPuzzle,
        mode: hintPuzzle.mode,
        difficulty: easierDifficulty,
        status: 'playing',
        selectedCell: null,
        inputMode: 'digit',
        history: [],
        historyIndex: -1,
        elapsedMs: 0,
        timerInterval: interval,
        conflicts: new Map(),
      });
    }).catch(() => {
      set({ stack: get().stack.filter((entry) => entry !== snapshot), transition: null });
      useGameStore.setState({ hintsUsed: game.hintsUsed });
    });
  },

  completeHintPuzzle: () => {
    const { stack } = get();
    if (stack.length === 0) return;

    // Pop the parent state
    const parent = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);

    set({ stack: newStack, transition: 'back', hintRevealCell: parent.hintCell });

    // Restore the parent, then route the earned reveal through the same domain
    // transition as a normal placement so notes, history, completion, and sync
    // behavior cannot drift apart.
    const prevInterval = useGameStore.getState().timerInterval;
    if (prevInterval) clearInterval(prevInterval);
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.status === 'playing') {
        useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    useGameStore.setState({
      grid: cloneGrid(parent.grid),
      puzzle: parent.puzzle,
      mode: parent.mode,
      difficulty: parent.difficulty,
      status: parent.status,
      inputMode: parent.inputMode,
      history: cloneHistory(parent.history),
      historyIndex: parent.historyIndex,
      elapsedMs: parent.elapsedMs,
      hintsUsed: parent.hintsUsed,
      errorsMade: parent.errorsMade,
      timerInterval: interval,
      selectedCell: parent.hintCell,
      conflicts: findConflicts(parent.grid),
    });
    useGameStore.getState().revealHint(parent.hintCell, parent.hintDigit, false);
  },

  abandonHintPuzzle: () => {
    const { stack } = get();
    if (stack.length === 0) return;

    // Pop the parent state — no hint revealed
    const parent = stack[stack.length - 1];
    const newStack = stack.slice(0, -1);

    set({ stack: newStack, transition: 'back' });

    // Restore parent game state as-is
    const prevInterval = useGameStore.getState().timerInterval;
    if (prevInterval) clearInterval(prevInterval);
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.status === 'playing') {
        useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    useGameStore.setState({
      grid: cloneGrid(parent.grid),
      puzzle: parent.puzzle,
      mode: parent.mode,
      difficulty: parent.difficulty,
      status: parent.status,
      inputMode: parent.inputMode,
      history: cloneHistory(parent.history),
      historyIndex: parent.historyIndex,
      elapsedMs: parent.elapsedMs,
      hintsUsed: parent.hintsUsed,
      errorsMade: parent.errorsMade,
      timerInterval: interval,
      selectedCell: null,
      conflicts: findConflicts(parent.grid),
    });
  },

  abandonToLevel: (level: number) => {
    const { stack } = get();
    if (level < 0 || level >= stack.length) return;

    // Pop all the way back to the target level
    const target = stack[level];
    const newStack = stack.slice(0, level);

    set({ stack: newStack, transition: 'back' });

    const prevInterval = useGameStore.getState().timerInterval;
    if (prevInterval) clearInterval(prevInterval);
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.status === 'playing') {
        useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    useGameStore.setState({
      grid: cloneGrid(target.grid),
      puzzle: target.puzzle,
      mode: target.mode,
      difficulty: target.difficulty,
      status: target.status,
      inputMode: target.inputMode,
      history: cloneHistory(target.history),
      historyIndex: target.historyIndex,
      elapsedMs: target.elapsedMs,
      hintsUsed: target.hintsUsed,
      errorsMade: target.errorsMade,
      timerInterval: interval,
      selectedCell: null,
      conflicts: findConflicts(target.grid),
    });
  },
}));
