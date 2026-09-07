// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Cage, Digit, Puzzle } from '../engine/types';
import { gridFromValues } from '../engine/types';

vi.mock('../engine/generateAsync', () => ({
  generatePuzzleAsync: vi.fn(), generatePuzzleInBackground: vi.fn(), generateMiniPuzzleAsync: vi.fn(),
}));
vi.mock('../engine/puzzlePrefetch', () => ({ takePuzzle: vi.fn(), prefetchPuzzle: vi.fn() }));
vi.mock('../lib/api', () => ({ postGameResult: vi.fn().mockResolvedValue(undefined), getDailyPuzzle: vi.fn() }));

import { useGameStore } from './gameStore';
import { useHintStore } from './hintStore';
import { postGameResult } from '../lib/api';
import { queueCompletion } from '../lib/completionQueue';
import { getPeers } from '../engine/validator';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

/** Puzzle with the given cells blank; everything else is a given. */
function makePuzzle(blanks: [number, number][], extra: Partial<Puzzle> = {}): Puzzle {
  const empty = new Set(blanks.map(([r, c]) => `${r},${c}`));
  return {
    initial: solution.map((row, r) => row.map((d, c) => (empty.has(`${r},${c}`) ? null : d))),
    solution, difficulty: 'easy', mode: 'classic', gridSize: 9, ...extra,
  };
}

function load(puzzle: Puzzle) {
  useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  useGameStore.setState({
    grid: gridFromValues(puzzle.initial, true), puzzle, mode: puzzle.mode, difficulty: puzzle.difficulty,
    status: 'playing', sessionPhase: 'playing', sessionKind: 'game', selectedCell: null, inputMode: 'digit',
    history: [], historyIndex: -1, elapsedMs: 0, pausedByUser: false, conflicts: new Map(),
    hintsUsed: 0, errorsMade: 0, submittedCompletionId: null, completionSyncStatus: 'idle', completionSyncError: null,
    generationStatus: 'idle', generationError: null, pendingGameSettings: null, recoveryNotice: null,
  });
}

const notes = (r: number, c: number) => [...useGameStore.getState().grid[r][c].cornerNotes].sort();

/** Digits not visible from (r, c) in the current grid: what auto-notes should write there. */
function candidatesFor(r: number, c: number): Digit[] {
  const grid = useGameStore.getState().grid;
  const seen = new Set<Digit>();
  for (const p of getPeers(r, c, 9)) { const d = grid[p.row][p.col].digit; if (d !== null) seen.add(d); }
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).filter((d) => !seen.has(d));
}

describe('auto notes', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { useGameStore.getState().captureSession(); vi.clearAllTimers(); vi.useRealTimers(); });

  // (0,0) can hold 1 or 2 once (0,1) and (3,0) are blank: 2 disappears from its row
  // and column. (0,5) is a further blank whose notes survive any placement at (0,0),
  // which is what tells the store that auto-notes are in use.
  const blanks: [number, number][] = [[0, 0], [0, 1], [3, 0], [0, 5]];

  it('fills every empty cell with its candidates, then toggles all notes off on a second press', () => {
    load(makePuzzle(blanks));
    useGameStore.getState().autoNote();
    expect(notes(0, 0)).toEqual([1, 2]);
    expect(notes(0, 1)).toEqual(candidatesFor(0, 1));
    expect(notes(3, 0)).toEqual(candidatesFor(3, 0));
    expect(notes(0, 5)).toEqual(candidatesFor(0, 5));
    expect(useGameStore.getState().history).toHaveLength(1);

    useGameStore.getState().autoNote(); // already correct → clears
    expect(notes(0, 0)).toEqual([]);
    expect(notes(0, 1)).toEqual([]);

    useGameStore.getState().autoNote(); // empty → refills
    useGameStore.getState().undo();
    expect(notes(0, 0)).toEqual([]);
    useGameStore.getState().redo();
    expect(notes(0, 0)).toEqual([1, 2]);
  });

  it('removes a placed digit from peer notes and restores it when the digit is removed again', () => {
    load(makePuzzle(blanks));
    const game = useGameStore.getState();
    game.autoNote();
    expect(notes(0, 1)).toContain(2);
    expect(notes(3, 0)).toContain(2);
    game.selectCell({ row: 0, col: 0 });
    game.placeDigit(2); // a peer-visible placement (wrong for the puzzle, but consistent)
    expect(notes(0, 1)).toEqual([]); // 2 was its only candidate
    expect(notes(3, 0)).toEqual([]);
    expect(notes(0, 5)).toEqual(candidatesFor(0, 5)); // unaffected neighbour keeps its notes
    expect(useGameStore.getState().errorsMade).toBe(0); // no conflict, so not an error

    useGameStore.getState().placeDigit(2); // toggle it back off
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    expect(notes(0, 1)).toEqual([2]); // sole candidate restored
    expect(notes(3, 0)).toEqual([2]);
    expect(notes(0, 0)).toEqual([1, 2]); // recomputed for the emptied cell

    useGameStore.getState().undo(); // back to placed
    expect(useGameStore.getState().grid[0][0].digit).toBe(2);
    expect(notes(0, 1)).not.toContain(2);
  });

  it('erasing a digit restores peer notes too, and erasing an empty cell is a no-op', () => {
    load(makePuzzle(blanks));
    const game = useGameStore.getState();
    game.autoNote();
    game.selectCell({ row: 0, col: 0 });
    game.placeDigit(2);
    const before = useGameStore.getState().history.length;
    useGameStore.getState().eraseCell();
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    expect(notes(0, 1)).toContain(2);
    expect(useGameStore.getState().history).toHaveLength(before + 1);

    useGameStore.getState().eraseCell(); // notes present → clears them
    expect(notes(0, 0)).toEqual([]);
    const after = useGameStore.getState().history.length;
    useGameStore.getState().eraseCell(); // nothing left → no history entry
    expect(useGameStore.getState().history).toHaveLength(after);
  });

  it('respects killer cages: a digit already in the cage is never a candidate', () => {
    // Blank the three cells that show 9 to (0,0) so 9 becomes a candidate by
    // row/column/box rules alone; the cage partner at (4,4) holds 9 and must veto it.
    expect(solution[4][4]).toBe(9);
    const cages: Cage[] = [{ sum: 1 + 9, cells: [{ row: 0, col: 0 }, { row: 4, col: 4 }] }];
    load(makePuzzle([[0, 0], [0, 8], [8, 0], [2, 2]], { mode: 'killer', cages }));
    expect(candidatesFor(0, 0)).toEqual([1, 9]);
    useGameStore.getState().autoNote();
    expect(notes(0, 0)).toEqual([1]);

    // Removing a digit restores peer notes under the same cage rule.
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(1);
    useGameStore.getState().eraseCell();
    expect(notes(0, 0)).toEqual([1]);
  });
});

describe('timer and pause', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
  afterEach(() => { useGameStore.getState().captureSession(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('advances while playing, freezes on manual pause, and resumes from the same time', () => {
    load(makePuzzle([[0, 0]]));
    useGameStore.getState().resumeGame(); // no-op: not paused
    useGameStore.getState().replaceSession(useGameStore.getState().captureSession()!, 'game');
    vi.advanceTimersByTime(3000);
    expect(useGameStore.getState().elapsedMs).toBeGreaterThanOrEqual(3000);

    useGameStore.getState().pauseGame();
    const paused = useGameStore.getState().elapsedMs;
    vi.advanceTimersByTime(5000);
    expect(useGameStore.getState().elapsedMs).toBe(paused);
    expect(useGameStore.getState().pausedByUser).toBe(true);

    useGameStore.getState().autoResume(); // must not override a manual pause
    expect(useGameStore.getState().status).toBe('paused');
    useGameStore.getState().resumeGame();
    vi.advanceTimersByTime(1000);
    expect(useGameStore.getState().elapsedMs).toBeGreaterThanOrEqual(paused + 1000);
  });

  it('auto-pause on backgrounding is undone by auto-resume, but only if the player did not pause', () => {
    load(makePuzzle([[0, 0]]));
    useGameStore.getState().replaceSession(useGameStore.getState().captureSession()!, 'game');
    useGameStore.getState().autoPause();
    expect(useGameStore.getState().status).toBe('paused');
    expect(useGameStore.getState().pausedByUser).toBe(false);
    useGameStore.getState().autoResume();
    expect(useGameStore.getState().status).toBe('playing');
    useGameStore.getState().autoPause();
    useGameStore.getState().autoPause(); // idempotent
    expect(useGameStore.getState().status).toBe('paused');
  });
});

describe('recovery and completion retry', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); vi.mocked(postGameResult).mockReset(); });
  afterEach(() => { useGameStore.getState().captureSession(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('explains when a corrupt save cannot be restored, and clears the notice', () => {
    localStorage.setItem('infinite-sudoku-save', '{not json');
    expect(useGameStore.getState().loadSavedGame()).toBe(false);
    expect(useGameStore.getState().recoveryNotice).toMatch(/could not be restored/);
    useGameStore.getState().clearRecoveryNotice();
    expect(useGameStore.getState().recoveryNotice).toBeNull();
    expect(useGameStore.getState().loadSavedGame()).toBe(false); // no save at all → no notice
    expect(useGameStore.getState().recoveryNotice).toBeNull();
  });

  it('replays queued completions in order and surfaces the server reference on failure', async () => {
    load(makePuzzle([[0, 0]]));
    const completion = (id: string) => ({
      completionId: id, mode: 'classic' as const, difficulty: 'easy' as const,
      solveTimeMs: 1000, hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
    });
    queueCompletion(completion('c0ffee00-0000-4000-8000-000000000001'));
    queueCompletion(completion('c0ffee00-0000-4000-8000-000000000002'));
    vi.mocked(postGameResult)
      .mockResolvedValueOnce({ score: 1 })
      .mockRejectedValueOnce(Object.assign(new Error('API request failed (503)'), { correlationId: 'req-7' }));

    useGameStore.getState().retryCompletion();
    await vi.waitFor(() => expect(useGameStore.getState().completionSyncStatus).toBe('pending'));
    expect(useGameStore.getState().completionSyncError).toBe('Stats not synced. Reference: req-7');
    expect(postGameResult).toHaveBeenCalledTimes(2);

    vi.mocked(postGameResult).mockResolvedValueOnce({ score: 1 });
    useGameStore.getState().retryCompletion(); // only the failed one remains queued
    await vi.waitFor(() => expect(useGameStore.getState().completionSyncStatus).toBe('synced'));
    expect(postGameResult).toHaveBeenCalledTimes(3);
    useGameStore.getState().retryCompletion(); // queue empty → nothing happens
    expect(postGameResult).toHaveBeenCalledTimes(3);
  });
});
