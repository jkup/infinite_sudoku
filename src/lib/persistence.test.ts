// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSave, loadGame, saveGame } from './persistence';
import { gridFromValues } from '../engine/types';
import type { Digit, Puzzle } from '../engine/types';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);
const puzzle: Puzzle = {
  initial: solution.map((row, rowIndex) => row.map((digit, colIndex) => rowIndex === 0 && colIndex === 0 ? null : digit)),
  solution,
  difficulty: 'easy',
  mode: 'classic',
  gridSize: 9,
};

describe('game persistence', () => {
  beforeEach(() => localStorage.clear());

  it('round-trips grids, notes, history, and elapsed time', () => {
    const grid = gridFromValues(puzzle.initial, true);
    grid[0][0].cornerNotes.add(1);

    saveGame({
      grid,
      puzzle,
      mode: 'classic',
      difficulty: 'easy',
      status: 'paused',
      inputMode: 'corner',
      history: [],
      historyIndex: -1,
      elapsedMs: 12_345,
      hintsUsed: 2,
      errorsMade: 3,
      submittedCompletionId: 'c0ffee00-0000-4000-8000-000000000099',
    });

    const restored = loadGame();
    expect(restored?.grid[0][0].cornerNotes).toEqual(new Set([1]));
    expect(restored?.status).toBe('playing');
    expect(restored?.inputMode).toBe('corner');
    expect(restored?.elapsedMs).toBe(12_345);
    expect(restored?.hintsUsed).toBe(2);
    expect(restored?.errorsMade).toBe(3);
    expect(restored?.submittedCompletionId).toBe('c0ffee00-0000-4000-8000-000000000099');
    expect(JSON.parse(localStorage.getItem('infinite-sudoku-save')!).version).toBe(2);
  });

  it('returns null for malformed or unsupported saved data', () => {
    localStorage.setItem('infinite-sudoku-save', '{bad json');
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('infinite-sudoku-save')).toBeNull();
    localStorage.setItem('infinite-sudoku-save', JSON.stringify({ grid: [], puzzle }));
    expect(loadGame()).toBeNull();
  });

  it('discards a save whose givens were altered', () => {
    saveGame({
      grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'classic', difficulty: 'easy',
      status: 'playing', inputMode: 'digit', history: [], historyIndex: -1, elapsedMs: 0,
      hintsUsed: 0, errorsMade: 0, submittedCompletionId: null,
    });
    const raw = JSON.parse(localStorage.getItem('infinite-sudoku-save')!);
    raw.grid[0][1].digit = solution[0][2];
    localStorage.setItem('infinite-sudoku-save', JSON.stringify(raw));

    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('infinite-sudoku-save')).toBeNull();
  });

  it('uses canonical puzzle metadata instead of stale saved labels', () => {
    saveGame({
      grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'classic', difficulty: 'easy',
      status: 'playing', inputMode: 'digit', history: [], historyIndex: -1, elapsedMs: 0,
      hintsUsed: 0, errorsMade: 0, submittedCompletionId: null,
    });
    const raw = JSON.parse(localStorage.getItem('infinite-sudoku-save')!);
    raw.difficulty = 'expert';
    localStorage.setItem('infinite-sudoku-save', JSON.stringify(raw));
    expect(loadGame()?.difficulty).toBe('easy');
  });

  it('migrates legacy flat history entries into grouped changes', () => {
    const grid = gridFromValues(puzzle.initial, true);
    saveGame({
      grid,
      puzzle,
      mode: 'classic',
      difficulty: 'easy',
      status: 'playing',
      inputMode: 'digit',
      history: [],
      historyIndex: 0,
      elapsedMs: 0,
      hintsUsed: 0,
      errorsMade: 0,
      submittedCompletionId: null,
    });
    const raw = JSON.parse(localStorage.getItem('infinite-sudoku-save') ?? '{}');
    delete raw.version;
    delete raw.hintsUsed;
    delete raw.errorsMade;
    delete raw.submittedCompletionId;
    raw.history = [{
      position: { row: 0, col: 0 },
      previousDigit: null,
      newDigit: 5,
      previousCornerNotes: [1, 2],
      newCornerNotes: [],
      previousCenterNotes: [],
      newCenterNotes: [],
    }];
    localStorage.setItem('infinite-sudoku-save', JSON.stringify(raw));

    const restored = loadGame();
    expect(restored?.history).toHaveLength(1);
    expect(restored?.history[0].changes[0].newDigit).toBe(5);
    expect(restored?.history[0].changes[0].previousCornerNotes).toEqual(new Set([1, 2]));
    expect(restored?.hintsUsed).toBe(0);
    expect(restored?.errorsMade).toBe(0);
  });

  it('rejects unsupported versions before deserializing state', () => {
    localStorage.setItem('infinite-sudoku-save', JSON.stringify({ version: 999 }));
    expect(loadGame()).toBeNull();
    expect(localStorage.getItem('infinite-sudoku-save')).toBeNull();
  });

  it('rejects malformed history before constructing note Sets', () => {
    saveGame({
      grid: gridFromValues(puzzle.initial, true), puzzle, mode: 'classic', difficulty: 'easy',
      status: 'playing', inputMode: 'digit', history: [], historyIndex: -1, elapsedMs: 0,
      hintsUsed: 0, errorsMade: 0, submittedCompletionId: null,
    });
    const raw = JSON.parse(localStorage.getItem('infinite-sudoku-save')!);
    raw.history = [{ changes: [{ position: { row: 0, col: 0 } }] }];
    localStorage.setItem('infinite-sudoku-save', JSON.stringify(raw));
    expect(loadGame()).toBeNull();
  });

  it('clears the saved game', () => {
    localStorage.setItem('infinite-sudoku-save', 'value');
    clearSave();
    expect(localStorage.getItem('infinite-sudoku-save')).toBeNull();
  });
});
