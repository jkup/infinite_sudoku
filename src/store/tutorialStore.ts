import { create } from 'zustand';
import type {
  Difficulty,
} from '../engine/types';
import { gridFromValues } from '../engine/types';
import { useGameStore, type GameSessionSnapshot } from './gameStore';
import { TUTORIALS, type TutorialDefinition } from '../data/tutorials';

type SavedGameSnapshot = GameSessionSnapshot;

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
    const snapshot = game.captureSession();
    if (!snapshot) return;

    set({ savedGame: snapshot, phase: 'practice' });

    // Load the practice puzzle into gameStore
    const practiceGrid = gridFromValues(tutorial.practicePuzzle.initial, true);

    // Auto-select the first focus cell so the player sees where to start
    const firstFocus = tutorial.focusCells.length > 0 ? tutorial.focusCells[0] : null;

    useGameStore.getState().replaceSession({
      grid: practiceGrid,
      puzzle: tutorial.practicePuzzle,
      mode: tutorial.practicePuzzle.mode,
      difficulty: tutorial.practicePuzzle.difficulty as Difficulty,
      status: 'playing',
      inputMode: 'digit',
      history: [],
      historyIndex: -1,
      elapsedMs: 0,
      hintsUsed: 0,
      errorsMade: 0,
    }, 'tutorial', firstFocus);
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
  useGameStore.getState().replaceSession(snapshot, 'game');
}
