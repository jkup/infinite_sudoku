// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Digit, Puzzle } from '../engine/types';
import { gridFromValues } from '../engine/types';

vi.mock('../engine/generateAsync', () => ({
  generatePuzzleAsync: vi.fn(), generatePuzzleInBackground: vi.fn(), generateMiniPuzzleAsync: vi.fn(),
}));
vi.mock('../engine/puzzlePrefetch', () => ({ takePuzzle: vi.fn(), prefetchPuzzle: vi.fn() }));
vi.mock('../lib/api', () => ({ postGameResult: vi.fn().mockResolvedValue(undefined), getDailyPuzzle: vi.fn() }));

import { useGameStore } from './gameStore';
import { getTutorialById, useTutorialStore } from './tutorialStore';
import { TUTORIALS } from '../data/tutorials';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);
const game: Puzzle = {
  initial: solution.map((row, r) => row.map((d, c) => (r === 0 && c === 0 ? null : d))),
  solution, difficulty: 'hard', mode: 'classic', gridSize: 9, completionId: 'c0ffee00-0000-4000-8000-000000000009',
};

describe('tutorial store', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null, completedTutorials: new Set(), savedGame: null });
    useGameStore.setState({
      grid: gridFromValues(game.initial, true), puzzle: game, mode: 'classic', difficulty: 'hard',
      status: 'playing', sessionPhase: 'playing', sessionKind: 'game', selectedCell: { row: 3, col: 3 },
      inputMode: 'corner', history: [], historyIndex: -1, elapsedMs: 90_000, pausedByUser: false,
      conflicts: new Map(), hintsUsed: 1, errorsMade: 2, submittedCompletionId: null,
      completionSyncStatus: 'idle', completionSyncError: null,
    });
  });
  afterEach(() => { useGameStore.getState().captureSession(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('navigates list → lesson → closed', () => {
    const store = useTutorialStore.getState();
    store.openList();
    expect(useTutorialStore.getState().phase).toBe('list');
    store.startLesson(TUTORIALS[0].id);
    expect(useTutorialStore.getState()).toMatchObject({ phase: 'lesson', activeTutorialId: TUTORIALS[0].id });
    store.close();
    expect(useTutorialStore.getState()).toMatchObject({ phase: 'idle', activeTutorialId: null });
    expect(getTutorialById('nope')).toBeUndefined();
  });

  it('parks the real game, loads the practice puzzle focused on its first target, and restores on completion', () => {
    const tutorial = TUTORIALS[0];
    useTutorialStore.getState().startLesson(tutorial.id);
    useTutorialStore.getState().startPractice();

    const practice = useGameStore.getState();
    expect(useTutorialStore.getState().phase).toBe('practice');
    expect(practice.sessionKind).toBe('tutorial');
    expect(practice.puzzle).toBe(tutorial.practicePuzzle);
    expect(practice.selectedCell).toEqual(tutorial.focusCells[0]);
    expect(practice.elapsedMs).toBe(0);
    expect(practice.inputMode).toBe('digit');

    useTutorialStore.getState().completePractice();
    const restored = useGameStore.getState();
    expect(useTutorialStore.getState()).toMatchObject({ phase: 'list', activeTutorialId: null, savedGame: null });
    expect(useTutorialStore.getState().completedTutorials.has(tutorial.id)).toBe(true);
    expect(JSON.parse(localStorage.getItem('infinite-sudoku-tutorial-progress')!)).toEqual([tutorial.id]);
    expect(restored.sessionKind).toBe('game');
    expect(restored.puzzle).toBe(game);
    expect(restored.elapsedMs).toBe(90_000);
    expect(restored.hintsUsed).toBe(1);
    expect(restored.errorsMade).toBe(2);
    expect(restored.inputMode).toBe('corner');
  });

  it('abandoning practice returns to the lesson with the game restored and nothing marked complete', () => {
    const tutorial = TUTORIALS[1];
    useTutorialStore.getState().startLesson(tutorial.id);
    useTutorialStore.getState().startPractice();
    useTutorialStore.getState().abandonPractice();
    expect(useTutorialStore.getState()).toMatchObject({ phase: 'lesson', activeTutorialId: tutorial.id, savedGame: null });
    expect(useTutorialStore.getState().completedTutorials.size).toBe(0);
    expect(useGameStore.getState().puzzle).toBe(game);
    expect(useGameStore.getState().sessionKind).toBe('game');
  });

  it('does nothing when practice is started without a lesson or a game', () => {
    useTutorialStore.getState().startPractice();
    expect(useTutorialStore.getState().phase).toBe('idle');

    useTutorialStore.getState().startLesson('unknown-tutorial');
    useTutorialStore.getState().startPractice();
    expect(useTutorialStore.getState().phase).toBe('lesson');

    useGameStore.setState({ puzzle: null });
    useTutorialStore.getState().startLesson(TUTORIALS[0].id);
    useTutorialStore.getState().startPractice();
    expect(useTutorialStore.getState().phase).toBe('lesson');
  });
});
