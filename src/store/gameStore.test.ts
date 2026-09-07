// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Digit, Puzzle } from '../engine/types';
import { gridFromValues } from '../engine/types';

const { mockGeneratePuzzleAsync } = vi.hoisted(() => ({ mockGeneratePuzzleAsync: vi.fn() }));
vi.mock('../engine/generateAsync', () => ({
  generatePuzzleAsync: mockGeneratePuzzleAsync,
  generateMiniPuzzleAsync: vi.fn(),
}));
vi.mock('../lib/api', () => ({
  postGameResult: vi.fn().mockResolvedValue(undefined),
  getDailyPuzzle: vi.fn(),
}));

import { useGameStore } from './gameStore';
import { useHintStore } from './hintStore';
import { getDailyPuzzle, postGameResult } from '../lib/api';
import { getQueuedCompletion } from '../lib/completionQueue';

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
  useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
  useGameStore.setState({
    grid: gridFromValues(puzzle.initial, true),
    puzzle,
    mode: puzzle.mode,
    difficulty: puzzle.difficulty,
    status: 'playing',
    generationStatus: 'idle',
    generationError: null,
    pendingGameSettings: null,
    sessionPhase: 'playing',
    sessionKind: 'game',
    selectedCell: null,
    inputMode: 'digit',
    history: [],
    historyIndex: -1,
    elapsedMs: 0,
    pausedByUser: false,
    conflicts: new Map(),
    hintsUsed: 0,
    errorsMade: 0,
    submittedCompletionId: null,
    completionSyncStatus: 'idle',
    completionSyncError: null,
  });
}

describe('game store transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockGeneratePuzzleAsync.mockReset();
    vi.mocked(postGameResult).mockReset().mockResolvedValue({ score: 0 });
    localStorage.clear();
    resetGame();
  });

  afterEach(() => {
    useGameStore.getState().captureSession();
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

  it('queues failed completion sync and retries the same idempotency key', async () => {
    vi.mocked(postGameResult).mockRejectedValueOnce({ correlationId: 'request-123' });
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(solution[0][0]);
    await Promise.resolve();
    await Promise.resolve();

    const completionId = useGameStore.getState().puzzle!.completionId!;
    expect(useGameStore.getState().completionSyncStatus).toBe('pending');
    expect(useGameStore.getState().completionSyncError).toContain('request-123');
    expect(getQueuedCompletion(completionId)?.completionId).toBe(completionId);

    useGameStore.getState().retryCompletion();
    await vi.waitFor(() => expect(useGameStore.getState().completionSyncStatus).toBe('synced'));
    expect(getQueuedCompletion(completionId)).toBeNull();
    expect(vi.mocked(postGameResult).mock.calls[0][0].completionId)
      .toBe(vi.mocked(postGameResult).mock.calls[1][0].completionId);
  });

  it('starts the daily puzzle and tags its completion with the daily id', async () => {
    const daily: Puzzle = { ...makePuzzle(), difficulty: 'expert', daily: { id: 42, date: '2026-09-06' } };
    vi.mocked(getDailyPuzzle).mockResolvedValueOnce(daily);

    useGameStore.getState().startDaily('classic');
    expect(useGameStore.getState().generationStatus).toBe('loading');
    expect(useGameStore.getState().pendingGameSettings).toMatchObject({ mode: 'classic', daily: true });
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('idle'));

    const state = useGameStore.getState();
    expect(state.puzzle?.daily).toEqual({ id: 42, date: '2026-09-06' });
    expect(state.difficulty).toBe('expert');
    expect(state.puzzle?.completionId).toMatch(/^[0-9a-f-]{36}$/);
    expect(getDailyPuzzle).toHaveBeenCalledWith('classic');

    state.selectCell({ row: 0, col: 0 });
    state.placeDigit(solution[0][0]);
    expect(useGameStore.getState().status).toBe('completed');
    expect(vi.mocked(postGameResult).mock.calls[0][0]).toMatchObject({ dailyPuzzleId: 42, difficulty: 'expert' });
  });

  it('omits the daily id from ordinary completions', () => {
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(solution[0][0]);
    expect(vi.mocked(postGameResult).mock.calls[0][0]).not.toHaveProperty('dailyPuzzleId');
  });

  it('reports a missing daily puzzle and can retry the same request', async () => {
    vi.mocked(getDailyPuzzle).mockResolvedValueOnce(null);
    useGameStore.getState().startDaily('killer');
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('error'));
    expect(useGameStore.getState().generationError).toContain("isn't ready yet");
    expect(useGameStore.getState().sessionPhase).toBe('failed');

    vi.mocked(getDailyPuzzle).mockRejectedValueOnce(new Error('network'));
    useGameStore.getState().retryGeneration();
    expect(getDailyPuzzle).toHaveBeenLastCalledWith('killer');
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('error'));
    expect(useGameStore.getState().generationError).toContain('Check your connection');
  });

  it('retries ordinary generation with the same settings', async () => {
    mockGeneratePuzzleAsync.mockRejectedValueOnce(new Error('worker crashed'));
    useGameStore.getState().newGame('hard', 'killer');
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('error'));

    mockGeneratePuzzleAsync.mockResolvedValueOnce({ ...makePuzzle(), difficulty: 'hard', mode: 'killer', cages: undefined });
    useGameStore.getState().retryGeneration();
    expect(mockGeneratePuzzleAsync).toHaveBeenLastCalledWith('hard', 'killer');
  });

  it('paints, toggles, and clears cell colors with undo and redo', () => {
    const game = useGameStore.getState();
    game.selectCell({ row: 0, col: 0 });
    game.paintCell(2);
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(2);
    expect(useGameStore.getState().history).toHaveLength(1);

    useGameStore.getState().paintCell(2); // same color toggles off
    expect(useGameStore.getState().grid[0][0].colorIndex).toBeNull();
    useGameStore.getState().paintCell(5);
    useGameStore.getState().paintCell(9); // out of range: ignored
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(5);

    useGameStore.getState().undo();
    expect(useGameStore.getState().grid[0][0].colorIndex).toBeNull();
    useGameStore.getState().redo();
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(5);
  });

  it('paints givens, and erase clears only the color on a given', () => {
    const game = useGameStore.getState();
    game.selectCell({ row: 0, col: 1 }); // a given cell
    game.paintCell(0);
    expect(useGameStore.getState().grid[0][1].colorIndex).toBe(0);
    useGameStore.getState().eraseCell();
    expect(useGameStore.getState().grid[0][1].colorIndex).toBeNull();
    expect(useGameStore.getState().grid[0][1].digit).toBe(solution[0][1]);
  });

  it('routes digit keys to the palette in color mode and keeps colors through digit placement', () => {
    const game = useGameStore.getState();
    game.selectCell({ row: 0, col: 0 });
    game.setInputMode('color');
    game.placeDigit(3); // key 3 → color index 2
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(2);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();
    useGameStore.getState().placeDigit(9); // last key clears
    expect(useGameStore.getState().grid[0][0].colorIndex).toBeNull();

    useGameStore.getState().paintCell(1);
    useGameStore.getState().setInputMode('digit');
    useGameStore.getState().placeDigit(solution[0][0]);
    expect(useGameStore.getState().grid[0][0].colorIndex).toBe(1);
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

  it('does not complete a conflict-free grid that differs from the stored solution', () => {
    const shifted = solution.map((row) => row.map((digit) => (digit === 9 ? 1 : digit + 1) as Digit));
    const puzzle: Puzzle = { ...makePuzzle(), initial: shifted.map((row) => [...row]), solution };
    puzzle.initial[0][0] = null;
    resetGame(puzzle);
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(shifted[0][0]);

    expect(useGameStore.getState().conflicts.size).toBe(0);
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

  it('uses timestamps so background throttling does not lose elapsed time', () => {
    const game = useGameStore.getState();
    const snapshot = game.captureSession()!;
    game.replaceSession({ ...snapshot, elapsedMs: 2_000 }, 'game');

    vi.setSystemTime(Date.now() + 5_500);
    useGameStore.getState().autoPause();

    expect(useGameStore.getState().elapsedMs).toBe(7_500);
  });

  it('owns only one interval and stops it for pause and completion', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');
    const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');
    const snapshot = useGameStore.getState().captureSession()!;

    useGameStore.getState().replaceSession(snapshot, 'game');
    useGameStore.getState().replaceSession(snapshot, 'game');
    expect(setIntervalSpy).toHaveBeenCalledTimes(2);
    expect(clearIntervalSpy).toHaveBeenCalled();

    useGameStore.getState().pauseGame();
    const pausedAt = useGameStore.getState().elapsedMs;
    vi.advanceTimersByTime(5_000);
    expect(useGameStore.getState().elapsedMs).toBe(pausedAt);

    useGameStore.getState().resumeGame();
    useGameStore.getState().selectCell({ row: 0, col: 0 });
    useGameStore.getState().placeDigit(solution[0][0]);
    const completedAt = useGameStore.getState().elapsedMs;
    vi.advanceTimersByTime(5_000);
    expect(useGameStore.getState().sessionPhase).toBe('completed');
    expect(useGameStore.getState().elapsedMs).toBe(completedAt);
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

  it('keeps the latest game when generation replies out of order', async () => {
    let resolveFirst!: (puzzle: Puzzle) => void;
    let resolveSecond!: (puzzle: Puzzle) => void;
    mockGeneratePuzzleAsync
      .mockReturnValueOnce(new Promise((resolve) => { resolveFirst = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveSecond = resolve; }));

    useGameStore.getState().newGame('easy', 'classic');
    useGameStore.getState().newGame('hard', 'killer');
    expect(useGameStore.getState().generationStatus).toBe('loading');

    const hardPuzzle = makePuzzle();
    resolveSecond({
      ...hardPuzzle,
      difficulty: 'hard',
      mode: 'killer',
      cages: solution.flatMap((row, rowIndex) => row.map((digit, colIndex) => ({
        sum: digit, cells: [{ row: rowIndex, col: colIndex }],
      }))),
    });
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('idle'));
    resolveFirst(makePuzzle());
    await Promise.resolve();

    expect(useGameStore.getState().difficulty).toBe('hard');
    expect(useGameStore.getState().mode).toBe('killer');
  });

  it('surfaces the latest generation failure with retry settings', async () => {
    mockGeneratePuzzleAsync.mockRejectedValueOnce(new Error('worker unavailable'));
    useGameStore.getState().newGame('expert', 'killer');

    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('error'));
    expect(useGameStore.getState().generationError).toBe('worker unavailable');
    expect(useGameStore.getState().pendingGameSettings).toEqual({ difficulty: 'expert', mode: 'killer' });
  });

  it('surfaces the generated difficulty when generation falls back', async () => {
    mockGeneratePuzzleAsync.mockResolvedValueOnce(makePuzzle());
    useGameStore.getState().newGame('expert', 'classic');
    await vi.waitFor(() => expect(useGameStore.getState().generationStatus).toBe('idle'));
    expect(useGameStore.getState().difficulty).toBe('easy');
  });
});
