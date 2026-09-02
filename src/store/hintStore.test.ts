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
import { postGameResult } from '../lib/api';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

function parentPuzzle(
  difficulty: Puzzle['difficulty'],
  blanks: Array<[number, number]> = [[0, 0]],
): Puzzle {
  return {
    initial: solution.map((row, r) => row.map((digit, c) =>
      blanks.some(([blankRow, blankCol]) => blankRow === r && blankCol === c) ? null : digit,
    )),
    solution,
    difficulty,
    mode: 'classic',
    gridSize: 9,
    completionId: 'c0ffee00-0000-4000-8000-000000000002',
  };
}

function reset(difficulty: Puzzle['difficulty'], blanks?: Array<[number, number]>) {
  const puzzle = parentPuzzle(difficulty, blanks);
  const interval = useGameStore.getState().timerInterval;
  if (interval) clearInterval(interval);
  useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  useGameStore.setState({
    grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'classic', difficulty,
    status: 'playing', selectedCell: { row: 0, col: 0 }, inputMode: 'digit',
    history: [], historyIndex: -1, elapsedMs: 42_000, timerInterval: null,
    pausedByUser: false, conflicts: new Map(), hintsUsed: 0, errorsMade: 0,
    submittedCompletionId: null,
  });
}

describe('hint stack transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
  });

  afterEach(() => {
    const interval = useGameStore.getState().timerInterval;
    if (interval) clearInterval(interval);
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('reveals a final easy hint, completes once, and supports undo/redo', () => {
    reset('easy');
    useHintStore.getState().requestHint();
    const completed = useGameStore.getState();
    expect(completed.grid[0][0].digit).toBe(solution[0][0]);
    expect(completed.hintsUsed).toBe(1);
    expect(completed.status).toBe('completed');
    expect(completed.history).toHaveLength(1);
    expect(postGameResult).toHaveBeenCalledOnce();
    expect(useHintStore.getState().stack).toHaveLength(0);

    completed.undo();
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    expect(useGameStore.getState().status).toBe('playing');
    useGameStore.getState().redo();
    expect(useGameStore.getState().status).toBe('completed');
    expect(postGameResult).toHaveBeenCalledOnce();
  });

  it('records a non-final easy hint and removes its digit from peer notes', () => {
    reset('easy', [[0, 0], [0, 1]]);
    const grid = useGameStore.getState().grid;
    grid[0][1].cornerNotes.add(solution[0][0]);

    useHintStore.getState().requestHint();
    const hinted = useGameStore.getState();
    expect(hinted.status).toBe('playing');
    expect(hinted.grid[0][1].cornerNotes.has(solution[0][0])).toBe(false);
    expect(hinted.history[0].changes).toHaveLength(2);
    expect(postGameResult).not.toHaveBeenCalled();

    hinted.undo();
    expect(useGameStore.getState().grid[0][1].cornerNotes.has(solution[0][0])).toBe(true);
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
    expect(postGameResult).toHaveBeenCalledOnce();
  });

  it('does not submit when completing a nested hint puzzle', async () => {
    reset('hard');
    useHintStore.getState().requestHint();
    await vi.waitFor(() => expect(useGameStore.getState().grid).toHaveLength(6));
    useGameStore.setState({ selectedCell: { row: 0, col: 0 } });
    useHintStore.getState().requestHint();
    await vi.waitFor(() => expect(useHintStore.getState().stack).toHaveLength(2));

    useHintStore.getState().completeHintPuzzle();
    expect(useHintStore.getState().stack).toHaveLength(1);
    expect(postGameResult).not.toHaveBeenCalled();
  });
});
