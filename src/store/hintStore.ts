import { create } from 'zustand';
import type {
  Digit,
  CellPosition,
} from '../engine/types';
import { DIFFICULTY_ORDER, gridFromValues } from '../engine/types';
import { generateMiniPuzzleAsync } from '../engine/generateAsync';
import { useGameStore, type GameSessionSnapshot } from './gameStore';

/**
 * A snapshot of a game state saved when the player requests a hint.
 * When the hint puzzle is solved (or abandoned), we restore this.
 */
export type StackEntry = GameSessionSnapshot & {
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
    game.incrementHintsUsed();
    const captured = useGameStore.getState().captureSession();
    if (!captured) return;

    // Save current game state to the stack
    const snapshot: StackEntry = {
      ...captured,
      hintCell: { row, col },
      hintDigit,
    };

    // Generate an easier puzzle (off main thread when possible)
    const easierDifficulty = DIFFICULTY_ORDER[currentDiffIndex - 1];

    // Push onto stack immediately
    set({ stack: [...get().stack, snapshot], transition: 'deeper' });

    void generateMiniPuzzleAsync(easierDifficulty).then((hintPuzzle) => {
      const hintGrid = gridFromValues(hintPuzzle.initial, true);

      useGameStore.getState().replaceSession({
        grid: hintGrid,
        puzzle: hintPuzzle,
        mode: hintPuzzle.mode,
        difficulty: easierDifficulty,
        status: 'playing',
        inputMode: 'digit',
        history: [],
        historyIndex: -1,
        elapsedMs: 0,
        hintsUsed: 0,
        errorsMade: 0,
      }, 'hint');
    }).catch(() => {
      set({ stack: get().stack.filter((entry) => entry !== snapshot), transition: null });
      useGameStore.getState().replaceSession({ ...snapshot, hintsUsed: game.hintsUsed }, get().stack.length > 0 ? 'hint' : 'game');
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
    useGameStore.getState().replaceSession(parent, newStack.length > 0 ? 'hint' : 'game', parent.hintCell);
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
    useGameStore.getState().replaceSession(parent, newStack.length > 0 ? 'hint' : 'game');
  },

  abandonToLevel: (level: number) => {
    const { stack } = get();
    if (level < 0 || level >= stack.length) return;

    // Pop all the way back to the target level
    const target = stack[level];
    const newStack = stack.slice(0, level);

    set({ stack: newStack, transition: 'back' });

    useGameStore.getState().replaceSession(target, newStack.length > 0 ? 'hint' : 'game');
  },
}));
