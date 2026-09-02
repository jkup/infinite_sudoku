// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Digit, Puzzle } from '../engine/types';
import { gridFromValues } from '../engine/types';

const { mockedMiniPuzzle } = vi.hoisted(() => {
  const solution = [
    [1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3],
    [2, 3, 4, 5, 6, 1], [5, 6, 1, 2, 3, 4],
    [3, 4, 5, 6, 1, 2], [6, 1, 2, 3, 4, 5],
  ];
  return {
    mockedMiniPuzzle: {
      initial: solution.map((row, r) => row.map((digit, c) => r === 0 && c === 0 ? null : digit)),
      solution,
      difficulty: 'easy',
      mode: 'classic',
      gridSize: 6,
    },
  };
});

vi.mock('../engine/generateAsync', () => ({
  generatePuzzleAsync: vi.fn(),
  generateMiniPuzzleAsync: vi.fn().mockResolvedValue(mockedMiniPuzzle),
}));
vi.mock('../lib/api', () => ({ postGameResult: vi.fn().mockResolvedValue(undefined) }));

import { useGameStore } from './gameStore';
import { useHintStore } from './hintStore';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

function parentPuzzle(difficulty: Puzzle['difficulty']): Puzzle {
  return {
    initial: solution.map((row, r) => row.map((digit, c) => r === 0 && c === 0 ? null : digit)),
    solution,
    difficulty,
    mode: 'classic',
    gridSize: 9,
  };
}

function reset(difficulty: Puzzle['difficulty']) {
  const puzzle = parentPuzzle(difficulty);
  const interval = useGameStore.getState().timerInterval;
  if (interval) clearInterval(interval);
  useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  useGameStore.setState({
    grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'classic', difficulty,
    status: 'playing', selectedCell: { row: 0, col: 0 }, inputMode: 'digit',
    history: [], historyIndex: -1, elapsedMs: 42_000, timerInterval: null,
    pausedByUser: false, conflicts: new Map(), hintsUsed: 0, errorsMade: 0,
  });
}

describe('hint stack transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    const interval = useGameStore.getState().timerInterval;
    if (interval) clearInterval(interval);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('reveals an easy hint immediately and increments usage', () => {
    reset('easy');
    useHintStore.getState().requestHint();
    expect(useGameStore.getState().grid[0][0].digit).toBe(solution[0][0]);
    expect(useGameStore.getState().hintsUsed).toBe(1);
    expect(useHintStore.getState().stack).toHaveLength(0);
  });

  it('opens an easier mini puzzle and can abandon back to an exact parent snapshot', async () => {
    reset('hard');
    useHintStore.getState().requestHint();
    await vi.waitFor(() => expect(useGameStore.getState().grid).toHaveLength(6));

    expect(useHintStore.getState().stack).toHaveLength(1);
    expect(useGameStore.getState().difficulty).toBe('medium');

    useHintStore.getState().abandonHintPuzzle();
    expect(useHintStore.getState().stack).toHaveLength(0);
    expect(useGameStore.getState().grid).toHaveLength(9);
    expect(useGameStore.getState().elapsedMs).toBe(42_000);
    expect(useGameStore.getState().hintsUsed).toBe(1);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
  });

  it('applies an earned hint to the parent with undo history', async () => {
    reset('medium');
    useHintStore.getState().requestHint();
    await vi.waitFor(() => expect(useGameStore.getState().grid).toHaveLength(6));
    useHintStore.getState().completeHintPuzzle();

    const game = useGameStore.getState();
    expect(game.grid[0][0].digit).toBe(solution[0][0]);
    expect(game.history).toHaveLength(1);
    expect(game.status).toBe('completed');
    expect(useHintStore.getState().hintRevealCell).toEqual({ row: 0, col: 0 });
  });
});
