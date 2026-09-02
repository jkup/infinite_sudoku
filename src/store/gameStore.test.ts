// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Digit, Puzzle } from '../engine/types';
import { gridFromValues } from '../engine/types';

vi.mock('../lib/api', () => ({ postGameResult: vi.fn().mockResolvedValue(undefined) }));

import { useGameStore } from './gameStore';
import { useHintStore } from './hintStore';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

function makePuzzle(emptyCells: [number, number][] = [[0, 0]]): Puzzle {
  const empty = new Set(emptyCells.map(([row, col]) => `${row},${col}`));
  return {
    initial: solution.map((row, rowIndex) =>
      row.map((digit, colIndex) => empty.has(`${rowIndex},${colIndex}`) ? null : digit),
    ),
    solution,
    difficulty: 'easy',
    mode: 'classic',
    gridSize: 9,
  };
}

function resetGame(puzzle = makePuzzle()) {
  const interval = useGameStore.getState().timerInterval;
  if (interval) clearInterval(interval);
  useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  useGameStore.setState({
    grid: gridFromValues(puzzle.initial, true),
    puzzle,
    mode: puzzle.mode,
    difficulty: puzzle.difficulty,
    status: 'playing',
    selectedCell: null,
    inputMode: 'digit',
    history: [],
    historyIndex: -1,
    elapsedMs: 0,
    timerInterval: null,
    pausedByUser: false,
    conflicts: new Map(),
    hintsUsed: 0,
    errorsMade: 0,
    submittedCompletionId: null,
  });
}

describe('game store transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    resetGame();
  });

  afterEach(() => {
    const interval = useGameStore.getState().timerInterval;
    if (interval) clearInterval(interval);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('places the final digit, records history, and completes the game', () => {
    const game = useGameStore.getState();
    game.selectCell({ row: 0, col: 0 });
    game.placeDigit(solution[0][0]);

    const completed = useGameStore.getState();
    expect(completed.grid[0][0].digit).toBe(solution[0][0]);
    expect(completed.status).toBe('completed');
    expect(completed.historyIndex).toBe(0);
    expect(completed.history).toHaveLength(1);
  });

  it('undoes and redoes a completed placement', () => {
    const game = useGameStore.getState();
    game.selectCell({ row: 0, col: 0 });
    game.placeDigit(solution[0][0]);
    useGameStore.getState().undo();

    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    expect(useGameStore.getState().status).toBe('playing');

    useGameStore.getState().redo();
    expect(useGameStore.getState().grid[0][0].digit).toBe(solution[0][0]);
    expect(useGameStore.getState().status).toBe('completed');
  });

  it('removes a placed digit from peer notes and restores it on undo', () => {
    const puzzle = makePuzzle([[0, 0], [0, 1]]);
    resetGame(puzzle);
    const grid = useGameStore.getState().grid;
    grid[0][1].cornerNotes.add(solution[0][0]);
    useGameStore.setState({ grid });

    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(solution[0][0]);
    expect(useGameStore.getState().grid[0][1].cornerNotes.has(solution[0][0])).toBe(false);

    useGameStore.getState().undo();
    expect(useGameStore.getState().grid[0][1].cornerNotes.has(solution[0][0])).toBe(true);
  });

  it('tracks conflicts and error attempts', () => {
    const puzzle = makePuzzle([[0, 0]]);
    resetGame(puzzle);
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(solution[0][1]);

    expect(useGameStore.getState().conflicts.has('0,0')).toBe(true);
    expect(useGameStore.getState().errorsMade).toBe(1);
    expect(useGameStore.getState().status).toBe('playing');
  });

  it('preserves a manual pause across visibility-driven resume', () => {
    useGameStore.getState().pauseGame();
    useGameStore.getState().autoResume();
    expect(useGameStore.getState().status).toBe('paused');

    useGameStore.getState().resumeGame();
    useGameStore.getState().autoPause();
    expect(useGameStore.getState().status).toBe('paused');
    useGameStore.getState().autoResume();
    expect(useGameStore.getState().status).toBe('playing');
  });

  it('creates and toggles automatic candidate notes as one undoable action', () => {
    const puzzle = makePuzzle([[0, 0], [0, 1]]);
    resetGame(puzzle);
    useGameStore.getState().autoNote();

    expect(useGameStore.getState().grid[0][0].cornerNotes.size).toBeGreaterThan(0);
    expect(useGameStore.getState().history).toHaveLength(1);

    useGameStore.getState().autoNote();
    expect(useGameStore.getState().grid[0][0].cornerNotes.size).toBe(0);
    expect(useGameStore.getState().history).toHaveLength(2);
  });
});
