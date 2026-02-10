import { create } from 'zustand';
import type {
  Grid,
  GameMode,
  Difficulty,
  GameStatus,
  InputMode,
  Puzzle,
  HistoryEntry,
} from '../engine/types';
import { gridFromValues } from '../engine/types';
import { findConflicts } from '../engine/validator';
import { useGameStore } from './gameStore';
import { TUTORIALS, type TutorialDefinition } from '../data/tutorials';

type SavedGameSnapshot = {
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

export type TutorialPhase = 'idle' | 'list' | 'lesson' | 'practice';

type TutorialState = {
  phase: TutorialPhase;
  activeTutorialId: string | null;
  completedTutorials: Set<string>;
  savedGame: SavedGameSnapshot | null;

  // Actions
  openList: () => void;
  close: () => void;
  startLesson: (id: string) => void;
  startPractice: () => void;
  completePractice: () => void;
  abandonPractice: () => void;
};

const STORAGE_KEY = 'infinite-sudoku-tutorial-progress';

function loadCompleted(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch { /* ignore */ }
  return new Set();
}

function saveCompleted(completed: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch { /* ignore */ }
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

export function getTutorialById(id: string): TutorialDefinition | undefined {
  return TUTORIALS.find((t) => t.id === id);
}

export const useTutorialStore = create<TutorialState>((set, get) => ({
  phase: 'idle',
  activeTutorialId: null,
  completedTutorials: loadCompleted(),
  savedGame: null,

  openList: () => set({ phase: 'list' }),

  close: () => set({ phase: 'idle', activeTutorialId: null }),

  startLesson: (id: string) => set({ phase: 'lesson', activeTutorialId: id }),

  startPractice: () => {
    const { activeTutorialId } = get();
    if (!activeTutorialId) return;

    const tutorial = getTutorialById(activeTutorialId);
    if (!tutorial) return;

    const game = useGameStore.getState();

    // Snapshot current game state
    const snapshot: SavedGameSnapshot = {
      grid: game.grid.length > 0 ? cloneGrid(game.grid) : game.grid,
      puzzle: game.puzzle!,
      mode: game.mode,
      difficulty: game.difficulty,
      status: game.status,
      inputMode: game.inputMode,
      history: cloneHistory(game.history),
      historyIndex: game.historyIndex,
      elapsedMs: game.elapsedMs,
      hintsUsed: game.hintsUsed,
      errorsMade: game.errorsMade,
    };

    set({ savedGame: snapshot, phase: 'practice' });

    // Load the practice puzzle into gameStore
    const practiceGrid = gridFromValues(tutorial.practicePuzzle.initial, true);

    const prevInterval = useGameStore.getState().timerInterval;
    if (prevInterval) clearInterval(prevInterval);
    const interval = setInterval(() => {
      const state = useGameStore.getState();
      if (state.status === 'playing') {
        useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
      }
    }, 1000);

    // Auto-select the first focus cell so the player sees where to start
    const firstFocus = tutorial.focusCells.length > 0 ? tutorial.focusCells[0] : null;

    useGameStore.setState({
      grid: practiceGrid,
      puzzle: tutorial.practicePuzzle,
      mode: tutorial.practicePuzzle.mode,
      difficulty: tutorial.practicePuzzle.difficulty as Difficulty,
      status: 'playing',
      selectedCell: firstFocus,
      inputMode: 'digit',
      history: [],
      historyIndex: -1,
      elapsedMs: 0,
      timerInterval: interval,
      conflicts: new Map(),
      hintsUsed: 0,
      errorsMade: 0,
    });
  },

  completePractice: () => {
    const { activeTutorialId, completedTutorials, savedGame } = get();

    // Mark tutorial as completed
    const newCompleted = new Set(completedTutorials);
    if (activeTutorialId) newCompleted.add(activeTutorialId);
    saveCompleted(newCompleted);

    set({
      completedTutorials: newCompleted,
      phase: 'list',
      activeTutorialId: null,
      savedGame: null,
    });

    // Restore saved game
    if (savedGame) {
      restoreGame(savedGame);
    }
  },

  abandonPractice: () => {
    const { savedGame } = get();

    set({ phase: 'lesson', savedGame: null });

    // Restore saved game
    if (savedGame) {
      restoreGame(savedGame);
    }
  },
}));

function restoreGame(snapshot: SavedGameSnapshot) {
  const prevInterval = useGameStore.getState().timerInterval;
  if (prevInterval) clearInterval(prevInterval);
  const interval = setInterval(() => {
    const state = useGameStore.getState();
    if (state.status === 'playing') {
      useGameStore.setState({ elapsedMs: state.elapsedMs + 1000 });
    }
  }, 1000);

  useGameStore.setState({
    grid: snapshot.grid.length > 0 ? cloneGrid(snapshot.grid) : snapshot.grid,
    puzzle: snapshot.puzzle,
    mode: snapshot.mode,
    difficulty: snapshot.difficulty,
    status: snapshot.status,
    inputMode: snapshot.inputMode,
    history: cloneHistory(snapshot.history),
    historyIndex: snapshot.historyIndex,
    elapsedMs: snapshot.elapsedMs,
    hintsUsed: snapshot.hintsUsed,
    errorsMade: snapshot.errorsMade,
    timerInterval: interval,
    selectedCell: null,
    conflicts: snapshot.grid.length > 0 ? findConflicts(snapshot.grid) : new Map(),
  });
}
