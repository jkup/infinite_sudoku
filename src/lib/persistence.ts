import type { Digit, Grid, Puzzle, GameMode, Difficulty, GameStatus, InputMode, HistoryEntry, CellChange, CellPosition } from '../engine/types';

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

type SerializedCellChange = {
  position: CellPosition;
  previousDigit: Digit | null;
  newDigit: Digit | null;
  previousCornerNotes: Digit[];
  newCornerNotes: Digit[];
  previousCenterNotes: Digit[];
  newCenterNotes: Digit[];
};

type SerializedHistoryEntry = {
  changes: SerializedCellChange[];
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

function serializeCellChange(c: CellChange): SerializedCellChange {
  return {
    position: c.position,
    previousDigit: c.previousDigit,
    newDigit: c.newDigit,
    previousCornerNotes: [...c.previousCornerNotes],
    newCornerNotes: [...c.newCornerNotes],
    previousCenterNotes: [...c.previousCenterNotes],
    newCenterNotes: [...c.newCenterNotes],
  };
}

function deserializeCellChange(c: SerializedCellChange): CellChange {
  return {
    position: c.position,
    previousDigit: c.previousDigit,
    newDigit: c.newDigit,
    previousCornerNotes: new Set(c.previousCornerNotes) as Set<Digit>,
    newCornerNotes: new Set(c.newCornerNotes) as Set<Digit>,
    previousCenterNotes: new Set(c.previousCenterNotes) as Set<Digit>,
    newCenterNotes: new Set(c.newCenterNotes) as Set<Digit>,
  };
}

function serializeHistory(history: HistoryEntry[]): SerializedHistoryEntry[] {
  return history.map((entry) => ({
    changes: entry.changes.map(serializeCellChange),
  }));
}

function deserializeHistory(data: SerializedHistoryEntry[]): HistoryEntry[] {
  // Handle legacy format (flat single-cell entries without .changes wrapper)
  return data.map((entry) => {
    if ('changes' in entry && Array.isArray(entry.changes)) {
      return { changes: entry.changes.map(deserializeCellChange) };
    }
    // Legacy: entry itself is a single cell change
    const legacy = entry as unknown as SerializedCellChange;
    return { changes: [deserializeCellChange(legacy)] };
  });
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
    if (data.grid.length !== 9 && data.grid.length !== 6) return null;

    const puzzle = { ...data.puzzle, gridSize: data.puzzle.gridSize ?? 9 };

    return {
      grid: deserializeGrid(data.grid),
      puzzle,
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
