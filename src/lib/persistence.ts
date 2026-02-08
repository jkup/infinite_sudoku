import type { Digit, Grid, Puzzle, GameMode, Difficulty, GameStatus, InputMode, HistoryEntry, CellPosition } from '../engine/types';

const SAVE_KEY = 'infinite-sudoku-save';

/**
 * The subset of game state we persist to localStorage.
 * Excludes ephemeral things like timerInterval, conflicts (recomputed), selectedCell.
 */
export type SavedGameState = {
  grid: SerializedGrid;
  puzzle: Puzzle;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  inputMode: InputMode;
  history: SerializedHistoryEntry[];
  historyIndex: number;
  elapsedMs: number;
};

// Grid cells with Set<Digit> converted to Digit[]
type SerializedCell = {
  row: number;
  col: number;
  digit: Digit | null;
  isGiven: boolean;
  cornerNotes: Digit[];
  centerNotes: Digit[];
  colorIndex: number | null;
};

type SerializedGrid = SerializedCell[][];

type SerializedHistoryEntry = {
  position: CellPosition;
  previousDigit: Digit | null;
  newDigit: Digit | null;
  previousCornerNotes: Digit[];
  newCornerNotes: Digit[];
  previousCenterNotes: Digit[];
  newCenterNotes: Digit[];
};

function serializeGrid(grid: Grid): SerializedGrid {
  return grid.map((row) =>
    row.map((cell) => ({
      row: cell.position.row,
      col: cell.position.col,
      digit: cell.digit,
      isGiven: cell.isGiven,
      cornerNotes: [...cell.cornerNotes],
      centerNotes: [...cell.centerNotes],
      colorIndex: cell.colorIndex,
    }))
  );
}

function deserializeGrid(data: SerializedGrid): Grid {
  return data.map((row) =>
    row.map((cell) => ({
      position: { row: cell.row, col: cell.col },
      digit: cell.digit,
      isGiven: cell.isGiven,
      cornerNotes: new Set(cell.cornerNotes) as Set<Digit>,
      centerNotes: new Set(cell.centerNotes) as Set<Digit>,
      colorIndex: cell.colorIndex,
      isError: false,
    }))
  );
}

function serializeHistory(history: HistoryEntry[]): SerializedHistoryEntry[] {
  return history.map((e) => ({
    position: e.position,
    previousDigit: e.previousDigit,
    newDigit: e.newDigit,
    previousCornerNotes: [...e.previousCornerNotes],
    newCornerNotes: [...e.newCornerNotes],
    previousCenterNotes: [...e.previousCenterNotes],
    newCenterNotes: [...e.newCenterNotes],
  }));
}

function deserializeHistory(data: SerializedHistoryEntry[]): HistoryEntry[] {
  return data.map((e) => ({
    position: e.position,
    previousDigit: e.previousDigit,
    newDigit: e.newDigit,
    previousCornerNotes: new Set(e.previousCornerNotes) as Set<Digit>,
    newCornerNotes: new Set(e.newCornerNotes) as Set<Digit>,
    previousCenterNotes: new Set(e.previousCenterNotes) as Set<Digit>,
    newCenterNotes: new Set(e.newCenterNotes) as Set<Digit>,
  }));
}

export function saveGame(state: {
  grid: Grid;
  puzzle: Puzzle;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  inputMode: InputMode;
  history: HistoryEntry[];
  historyIndex: number;
  elapsedMs: number;
}): void {
  try {
    const data: SavedGameState = {
      grid: serializeGrid(state.grid),
      puzzle: state.puzzle,
      mode: state.mode,
      difficulty: state.difficulty,
      status: state.status,
      inputMode: state.inputMode,
      history: serializeHistory(state.history),
      historyIndex: state.historyIndex,
      elapsedMs: state.elapsedMs,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // localStorage might be full or unavailable — fail silently
  }
}

export function loadGame(): {
  grid: Grid;
  puzzle: Puzzle;
  mode: GameMode;
  difficulty: Difficulty;
  status: GameStatus;
  inputMode: InputMode;
  history: HistoryEntry[];
  historyIndex: number;
  elapsedMs: number;
} | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;

    const data: SavedGameState = JSON.parse(raw);

    // Basic validation
    if (!data.grid || !data.puzzle || !data.puzzle.solution) return null;
    if (data.grid.length !== 9) return null;

    return {
      grid: deserializeGrid(data.grid),
      puzzle: data.puzzle,
      mode: data.mode,
      difficulty: data.difficulty,
      status: data.status === 'completed' ? 'completed' : 'playing', // unpause on reload
      inputMode: data.inputMode ?? 'digit',
      history: deserializeHistory(data.history ?? []),
      historyIndex: data.historyIndex ?? -1,
      elapsedMs: data.elapsedMs ?? 0,
    };
  } catch {
    return null;
  }
}

export function clearSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
