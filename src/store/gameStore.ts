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
import { gridFromValues, getDigitsForSize } from '../engine/types';
import { generatePuzzleAsync } from '../engine/generateAsync';
import { findConflicts, getPeers, isPuzzleComplete, isPuzzleDefinitionValid } from '../engine/validator';
import { getCageForCell } from '../engine/killer';
import { saveGame, loadGame, hasSavedGame } from '../lib/persistence';
import { postGameResult } from '../lib/api';

export type SessionPhase = 'generating' | 'playing' | 'paused' | 'completed' | 'failed' | 'nested-hint';
export type SessionKind = 'game' | 'hint' | 'tutorial';

export type GameSessionSnapshot = {
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
};

function vibrate(ms: number | number[] = 10) {
  try { navigator.vibrate?.(ms); } catch { /* unsupported */ }
}

type GameState = {
  // Core state
  grid: Grid;
  puzzle: Puzzle | null;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  generationStatus: 'idle' | 'loading' | 'error';
  generationError: string | null;
  pendingGameSettings: { difficulty: Difficulty; mode: GameMode } | null;
  sessionPhase: SessionPhase;
  sessionKind: SessionKind;
  recoveryNotice: string | null;

  // Selection
  selectedCell: CellPosition | null;
  inputMode: InputMode;

  // History (undo/redo)
  history: HistoryEntry[];
  historyIndex: number;

  // Timer
  elapsedMs: number;
  pausedByUser: boolean;

  // Conflicts
  conflicts: Map<string, CellPosition[]>;

  // Stats tracking
  hintsUsed: number;
  errorsMade: number;
  submittedCompletionId: string | null;

  // Actions
  newGame: (difficulty: Difficulty, mode?: GameMode) => void;
  selectCell: (pos: CellPosition | null) => void;
  placeDigit: (digit: Digit) => void;
  revealHint: (pos: CellPosition, digit: Digit, incrementUsage?: boolean) => void;
  eraseCell: () => void;
  toggleNote: (digit: Digit) => void;
  setInputMode: (mode: InputMode) => void;
  autoNote: () => void;
  loadSavedGame: () => boolean;
  undo: () => void;
  redo: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  autoPause: () => void;
  autoResume: () => void;
  incrementHintsUsed: () => void;
  captureSession: () => GameSessionSnapshot | null;
  replaceSession: (snapshot: GameSessionSnapshot, kind: SessionKind, selectedCell?: CellPosition | null) => void;
  clearRecoveryNotice: () => void;
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

let latestGameRequestId = 0;
let timerInterval: ReturnType<typeof setInterval> | null = null;
let timerStartedAt = 0;
let timerBaseElapsedMs = 0;

function stopTimer(set: (partial: Partial<GameState>) => void): number {
  if (timerInterval === null) return useGameStore.getState().elapsedMs;
  const elapsedMs = timerBaseElapsedMs + Math.max(0, Date.now() - timerStartedAt);
  clearInterval(timerInterval);
  timerInterval = null;
  set({ elapsedMs });
  return elapsedMs;
}

function startTimer(set: (partial: Partial<GameState>) => void, get: () => GameState, elapsedMs: number): void {
  if (timerInterval !== null) clearInterval(timerInterval);
  timerBaseElapsedMs = elapsedMs;
  timerStartedAt = Date.now();
  set({ elapsedMs });
  timerInterval = setInterval(() => {
    if (get().status !== 'playing') return;
    set({ elapsedMs: timerBaseElapsedMs + Math.max(0, Date.now() - timerStartedAt) });
  }, 1000);
}

/**
 * When a digit is removed from a cell, restore that digit to corner notes
 * of any peer cell that (a) already has corner notes and (b) has no other
 * placed peer supplying the same digit (i.e. the digit is a valid candidate).
 * Also recalculate candidates for the cleared cell itself if auto-notes are active.
 * Returns CellChange entries for all affected peers.
 */
function restoreNotesOnRemoval(
  grid: Grid,
  row: number,
  col: number,
  removedDigit: Digit,
  cages?: Puzzle['cages'],
): CellChange[] {
  const gridSize = grid.length;
  const changes: CellChange[] = [];

  for (const peer of getPeers(row, col, gridSize)) {
    const peerCell = grid[peer.row][peer.col];
    // Only restore for empty cells that already have corner notes (auto-notes active)
    if (peerCell.digit !== null || peerCell.cornerNotes.size === 0) continue;
    // Already has this digit noted
    if (peerCell.cornerNotes.has(removedDigit)) continue;

    // Check if removedDigit is actually a valid candidate for this peer
    let isCandidate = true;
    for (const peerPeer of getPeers(peer.row, peer.col, gridSize)) {
      if (grid[peerPeer.row][peerPeer.col].digit === removedDigit) {
        isCandidate = false;
        break;
      }
    }

    // Also check killer cage constraint
    if (isCandidate && cages) {
      const cage = getCageForCell(cages, peer.row, peer.col);
      if (cage) {
        for (const cc of cage.cells) {
          if (cc.row === peer.row && cc.col === peer.col) continue;
          if (grid[cc.row][cc.col].digit === removedDigit) {
            isCandidate = false;
            break;
          }
        }
      }
    }

    if (isCandidate) {
      const change: CellChange = {
        position: peer,
        previousDigit: null,
        newDigit: null,
        previousCornerNotes: new Set(peerCell.cornerNotes),
        newCornerNotes: new Set(peerCell.cornerNotes),
        previousCenterNotes: new Set(peerCell.centerNotes),
        newCenterNotes: new Set(peerCell.centerNotes),
      };
      peerCell.cornerNotes.add(removedDigit);
      change.newCornerNotes = new Set(peerCell.cornerNotes);
      changes.push(change);
    }
  }

  // Recalculate candidates for the now-empty cell itself if auto-notes are in use
  // (heuristic: if any peer has corner notes, auto-notes are active)
  const autoNotesActive = getPeers(row, col, gridSize).some(
    (p) => grid[p.row][p.col].digit === null && grid[p.row][p.col].cornerNotes.size > 0,
  );
  if (autoNotesActive) {
    const cell = grid[row][col];
    const usedDigits = new Set<Digit>();
    for (const peer of getPeers(row, col, gridSize)) {
      const d = grid[peer.row][peer.col].digit;
      if (d !== null) usedDigits.add(d);
    }
    if (cages) {
      const cage = getCageForCell(cages, row, col);
      if (cage) {
        for (const cc of cage.cells) {
          if (cc.row === row && cc.col === col) continue;
          const d = grid[cc.row][cc.col].digit;
          if (d !== null) usedDigits.add(d);
        }
      }
    }
    const candidates = new Set<Digit>();
    for (const d of getDigitsForSize(gridSize)) {
      if (!usedDigits.has(d)) candidates.add(d);
    }

    const prevCorner = cell.cornerNotes;
    if (candidates.size !== prevCorner.size || [...candidates].some((d) => !prevCorner.has(d))) {
      changes.push({
        position: { row, col },
        previousDigit: null,
        newDigit: null,
        previousCornerNotes: new Set(prevCorner),
        newCornerNotes: new Set(candidates),
        previousCenterNotes: new Set(cell.centerNotes),
        newCenterNotes: new Set<Digit>(),
      });
      cell.cornerNotes = candidates;
      cell.centerNotes = new Set<Digit>();
    }
  }

  return changes;
}

/** Fire-and-forget cloud save when a game completes */
function saveToCloud(state: {
  completionId: string;
  mode: GameMode;
  difficulty: Difficulty;
  elapsedMs: number;
  hintsUsed: number;
  errorsMade: number;
}): void {
  postGameResult({
    completionId: state.completionId,
    mode: state.mode,
    difficulty: state.difficulty,
    solveTimeMs: state.elapsedMs,
    hintsUsed: state.hintsUsed,
    maxHintDepth: 0,
    errorsMade: state.errorsMade,
  }).catch(() => {
    // Cloud save is best-effort — fail silently
  });
}

function completeCurrentSession(set: (partial: Partial<GameState>) => void, get: () => GameState): void {
  if (get().status === 'completed' && get().sessionPhase === 'completed') return;
  const elapsedMs = stopTimer(set);
  set({ status: 'completed', sessionPhase: 'completed' });
  vibrate([50, 50, 50, 50, 100]);
  const { mode, difficulty, hintsUsed, errorsMade, puzzle, submittedCompletionId, sessionKind } = get();
  const completionId = puzzle?.completionId ?? crypto.randomUUID();
  if (sessionKind !== 'game' || submittedCompletionId === completionId) return;
  set({ submittedCompletionId: completionId });
  saveToCloud({ completionId, mode, difficulty, elapsedMs, hintsUsed, errorsMade });
}

export const useGameStore = create<GameState>((set, get) => ({
  grid: [],
  puzzle: null,
  mode: 'classic',
  difficulty: 'easy',
  status: 'playing',
  generationStatus: 'idle',
  generationError: null,
  pendingGameSettings: null,
  sessionPhase: 'playing',
  sessionKind: 'game',
  recoveryNotice: null,
  selectedCell: null,
  inputMode: 'digit',
  history: [],
  historyIndex: -1,
  elapsedMs: 0,
  pausedByUser: false,
  conflicts: new Map(),
  hintsUsed: 0,
  errorsMade: 0,
  submittedCompletionId: null,

  newGame: (difficulty, mode = 'classic') => {
    const requestId = ++latestGameRequestId;
    stopTimer(set);
    set({
      generationStatus: 'loading',
      generationError: null,
      pendingGameSettings: { difficulty, mode },
      sessionPhase: 'generating',
      sessionKind: 'game',
    });

    generatePuzzleAsync(difficulty, mode).then((puzzle) => {
      if (requestId !== latestGameRequestId) return;
      if (!isPuzzleDefinitionValid(puzzle)) throw new Error('Puzzle generation returned invalid data');
      const grid = gridFromValues(puzzle.initial, true);

      set({
        grid,
        puzzle: { ...puzzle, completionId: crypto.randomUUID() },
        mode: puzzle.mode,
        difficulty: puzzle.difficulty,
        status: 'playing',
        generationStatus: 'idle',
        generationError: null,
        pendingGameSettings: null,
        sessionPhase: 'playing',
        sessionKind: 'game',
        selectedCell: null,
        inputMode: 'digit',
        history: [],
        historyIndex: -1,
        elapsedMs: 0,
        pausedByUser: false,
        conflicts: new Map(),
        hintsUsed: 0,
        errorsMade: 0,
        submittedCompletionId: null,
      });
      startTimer(set, get, 0);
    }).catch((error: unknown) => {
      if (requestId !== latestGameRequestId) return;
      set({
        generationStatus: 'error',
        generationError: error instanceof Error ? error.message : 'Puzzle generation failed',
        sessionPhase: 'failed',
      });
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

    vibrate();

    if (target.digit === digit) {
      // Toggle off
      target.digit = null;
      // Restore notes that were auto-removed when this digit was placed
      const restored = restoreNotesOnRemoval(newGrid, row, col, digit, get().puzzle?.cages);
      changes.push(...restored);
      // Update primaryChange to reflect any note restoration on this cell
      primaryChange.newCornerNotes = new Set(target.cornerNotes);
      primaryChange.newCenterNotes = new Set(target.centerNotes);
    } else {
      target.digit = digit;
      // Clear notes when placing a digit
      target.cornerNotes.clear();
      target.centerNotes.clear();
      primaryChange.newCornerNotes = new Set();
      primaryChange.newCenterNotes = new Set();

      // Auto-remove this digit from notes in all peer cells
      for (const peer of getPeers(row, col, grid.length)) {
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
    const isComplete = target.digit !== null && get().puzzle !== null && isPuzzleComplete(newGrid, get().puzzle!);

    // Track errors: if the placed digit creates a conflict, count it
    const cellKey = `${row},${col}`;
    const isNewError = target.digit !== null && conflicts.has(cellKey);

    // Truncate redo history
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes });

    set({
      grid: newGrid,
      conflicts,
      history: newHistory,
      historyIndex: newHistory.length - 1,
      status: 'playing',
      errorsMade: isNewError ? get().errorsMade + 1 : get().errorsMade,
    });

    if (isComplete) {
      completeCurrentSession(set, get);
    }
  },

  revealHint: (pos, digit, incrementUsage = true) => {
    const state = get();
    if (state.status !== 'playing') return;

    const cell = state.grid[pos.row]?.[pos.col];
    if (!cell || cell.isGiven || cell.digit !== null) return;

    set({
      selectedCell: pos,
      inputMode: 'digit',
      hintsUsed: incrementUsage ? state.hintsUsed + 1 : state.hintsUsed,
    });
    get().placeDigit(digit);
  },

  eraseCell: () => {
    const { grid, selectedCell, status, history, historyIndex } = get();
    if (!selectedCell || status !== 'playing') return;

    const { row, col } = selectedCell;
    const cell = grid[row][col];
    if (cell.isGiven) return;
    if (cell.digit === null && cell.cornerNotes.size === 0 && cell.centerNotes.size === 0) return;

    vibrate();

    const newGrid = cloneGrid(grid);
    const target = newGrid[row][col];

    const removedDigit = target.digit;

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

    // Restore notes that were auto-removed when this digit was placed
    const restoredChanges: CellChange[] = [];
    if (removedDigit !== null) {
      const restored = restoreNotesOnRemoval(newGrid, row, col, removedDigit, get().puzzle?.cages);
      restoredChanges.push(...restored);
      // Update change to reflect any note restoration on this cell
      change.newCornerNotes = new Set(target.cornerNotes);
      change.newCenterNotes = new Set(target.centerNotes);
    }

    const conflicts = updateConflicts(newGrid);
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes: [change, ...restoredChanges] });

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

    const gridSize = grid.length;
    const digits = getDigitsForSize(gridSize);

    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const cell = newGrid[r][c];
        if (cell.digit !== null) continue;

        // Standard Sudoku: eliminate digits seen in row/col/box
        const usedDigits = new Set<Digit>();
        for (const peer of getPeers(r, c, gridSize)) {
          const d = newGrid[peer.row][peer.col].digit;
          if (d !== null) usedDigits.add(d);
        }

        const candidates = new Set<Digit>();
        for (const d of digits) {
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

    // If no changes, notes already match candidates — toggle them off
    if (changes.length === 0) {
      const clearGrid = cloneGrid(grid);
      const clearChanges: CellChange[] = [];

      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          const cell = clearGrid[r][c];
          if (cell.digit !== null) continue;
          if (cell.cornerNotes.size === 0 && cell.centerNotes.size === 0) continue;

          clearChanges.push({
            position: { row: r, col: c },
            previousDigit: null,
            newDigit: null,
            previousCornerNotes: new Set(cell.cornerNotes),
            newCornerNotes: new Set<Digit>(),
            previousCenterNotes: new Set(cell.centerNotes),
            newCenterNotes: new Set<Digit>(),
          });
          cell.cornerNotes = new Set<Digit>();
          cell.centerNotes = new Set<Digit>();
        }
      }

      if (clearChanges.length === 0) return;

      const clearHistory = history.slice(0, historyIndex + 1);
      clearHistory.push({ changes: clearChanges });

      set({
        grid: clearGrid,
        history: clearHistory,
        historyIndex: clearHistory.length - 1,
      });
      return;
    }

    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ changes });

    set({
      grid: newGrid,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },

  loadSavedGame: () => {
    const hadSave = hasSavedGame();
    const saved = loadGame();
    if (!saved) {
      if (hadSave) set({ recoveryNotice: 'Your previous game could not be restored, so a fresh puzzle was started.' });
      return false;
    }

    stopTimer(set);

    set({
      grid: saved.grid,
      puzzle: saved.puzzle,
      mode: saved.mode,
      difficulty: saved.difficulty,
      status: saved.status,
      generationStatus: 'idle',
      generationError: null,
      pendingGameSettings: null,
      sessionPhase: saved.status,
      sessionKind: 'game',
      inputMode: saved.inputMode,
      history: saved.history,
      historyIndex: saved.historyIndex,
      elapsedMs: saved.elapsedMs,
      pausedByUser: false,
      selectedCell: null,
      conflicts: updateConflicts(saved.grid),
      hintsUsed: saved.hintsUsed,
      errorsMade: saved.errorsMade,
      submittedCompletionId: saved.status === 'completed'
        ? saved.submittedCompletionId ?? saved.puzzle.completionId ?? null
        : saved.submittedCompletionId,
    });
    if (saved.status === 'playing') startTimer(set, get, saved.elapsedMs);
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

    const wasCompleted = get().status === 'completed';
    set({
      grid: newGrid,
      historyIndex: historyIndex - 1,
      conflicts: updateConflicts(newGrid),
      status: 'playing',
      sessionPhase: get().sessionKind === 'hint' ? 'nested-hint' : 'playing',
    });
    if (wasCompleted) startTimer(set, get, get().elapsedMs);
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
    const isComplete = get().puzzle !== null && isPuzzleComplete(newGrid, get().puzzle!);

    set({
      grid: newGrid,
      historyIndex: historyIndex + 1,
      conflicts,
      status: 'playing',
    });

    if (isComplete) {
      completeCurrentSession(set, get);
    }
  },

  pauseGame: () => {
    if (get().status !== 'playing') return;
    stopTimer(set);
    set({ status: 'paused', sessionPhase: 'paused', pausedByUser: true });
  },

  resumeGame: () => {
    if (get().status !== 'paused') return;
    set({ status: 'playing', sessionPhase: get().sessionKind === 'hint' ? 'nested-hint' : 'playing', pausedByUser: false });
    startTimer(set, get, get().elapsedMs);
  },

  autoPause: () => {
    const { status } = get();
    if (status === 'playing') {
      stopTimer(set);
      set({ status: 'paused', sessionPhase: 'paused' });
    }
  },

  autoResume: () => {
    const { status, pausedByUser } = get();
    if (status === 'paused' && !pausedByUser) {
      set({ status: 'playing', sessionPhase: get().sessionKind === 'hint' ? 'nested-hint' : 'playing' });
      startTimer(set, get, get().elapsedMs);
    }
  },

  incrementHintsUsed: () => set({ hintsUsed: get().hintsUsed + 1 }),

  captureSession: () => {
    const state = get();
    if (!state.puzzle) return null;
    const elapsedMs = stopTimer(set);
    return {
      grid: cloneGrid(state.grid), puzzle: state.puzzle, mode: state.mode,
      difficulty: state.difficulty, status: state.status, inputMode: state.inputMode,
      history: state.history, historyIndex: state.historyIndex, elapsedMs,
      hintsUsed: state.hintsUsed, errorsMade: state.errorsMade,
    };
  },

  replaceSession: (snapshot, kind, selectedCell = null) => {
    stopTimer(set);
    const grid = cloneGrid(snapshot.grid);
    set({
      ...snapshot,
      grid,
      history: snapshot.history.map((entry) => ({
        changes: entry.changes.map((change) => ({
          ...change,
          previousCornerNotes: new Set(change.previousCornerNotes),
          newCornerNotes: new Set(change.newCornerNotes),
          previousCenterNotes: new Set(change.previousCenterNotes),
          newCenterNotes: new Set(change.newCenterNotes),
        })),
      })),
      selectedCell,
      sessionKind: kind,
      sessionPhase: snapshot.status === 'playing' && kind === 'hint' ? 'nested-hint' : snapshot.status,
      pausedByUser: snapshot.status === 'paused',
      conflicts: updateConflicts(grid),
    });
    if (snapshot.status === 'playing') startTimer(set, get, snapshot.elapsedMs);
  },

  clearRecoveryNotice: () => set({ recoveryNotice: null }),
}));

// Auto-save on every state change (debounced slightly)
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
useGameStore.subscribe((state) => {
  // Nested hint/tutorial sessions are ephemeral. The most recent top-level
  // snapshot remains the recovery point if the app reloads mid-session.
  if (!state.puzzle || state.sessionKind !== 'game') return;
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
      hintsUsed: state.hintsUsed,
      errorsMade: state.errorsMade,
      submittedCompletionId: state.submittedCompletionId,
    });
  }, 500);
});
