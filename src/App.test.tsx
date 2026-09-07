// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Digit, Puzzle } from './engine/types';

const mocks = vi.hoisted(() => {
  // jsdom has no matchMedia; the reduced-motion hook and theme store query it.
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: (query: string) => ({
      matches: false, media: query, onchange: null,
      addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent: () => false,
    }),
  });
  return { take: vi.fn(), prefetch: vi.fn(), mini: vi.fn(), daily: vi.fn(), post: vi.fn() };
});
vi.mock('./engine/puzzlePrefetch', () => ({ takePuzzle: mocks.take, prefetchPuzzle: mocks.prefetch }));
vi.mock('./engine/generateAsync', () => ({
  generatePuzzleAsync: vi.fn(), generatePuzzleInBackground: vi.fn(), generateMiniPuzzleAsync: mocks.mini,
}));
vi.mock('./lib/api', () => ({
  postGameResult: mocks.post, getDailyPuzzle: mocks.daily, getStats: vi.fn(), getLeaderboard: vi.fn(), setAuthTokenGetter: vi.fn(),
}));

import App from './App';
import { useGameStore } from './store/gameStore';
import { useHintStore } from './store/hintStore';
import { useTutorialStore } from './store/tutorialStore';
import { utcDateString } from './lib/daily';

const solution = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);
function makePuzzle(blanks: [number, number][], extra: Partial<Puzzle> = {}): Puzzle {
  const empty = new Set(blanks.map(([r, c]) => `${r},${c}`));
  return {
    initial: solution.map((row, r) => row.map((d, c) => (empty.has(`${r},${c}`) ? null : d))),
    solution, difficulty: 'easy', mode: 'classic', gridSize: 9, ...extra,
  };
}
const miniSolution = [[1, 2, 3, 4, 5, 6], [4, 5, 6, 1, 2, 3], [2, 3, 4, 5, 6, 1], [5, 6, 1, 2, 3, 4], [3, 4, 5, 6, 1, 2], [6, 1, 2, 3, 4, 5]] as Digit[][];
const miniPuzzle: Puzzle = {
  initial: miniSolution.map((row, r) => row.map((d, c) => (r === 0 && c === 0 ? null : d))),
  solution: miniSolution, difficulty: 'easy', mode: 'classic', gridSize: 6,
};

/** Fill the single blank at (0,0) through the UI, which completes the puzzle. */
async function solveLastCell(user: ReturnType<typeof userEvent.setup>, digit: number) {
  await user.click(screen.getByRole('gridcell', { name: /^Row 1, Column 1,/ }));
  await user.click(screen.getByRole('button', { name: `Place digit ${digit}` }));
}

describe('App game screen', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    localStorage.clear();
    localStorage.setItem('infinite-sudoku-onboarded', '1'); // skip the first-run tour
    Object.values(mocks).forEach((m) => m.mockReset());
    mocks.post.mockResolvedValue({ score: 1 });
    mocks.mini.mockResolvedValue(miniPuzzle);
    useHintStore.setState({ stack: [], transition: null, hintRevealCell: null });
    useTutorialStore.setState({ phase: 'idle', activeTutorialId: null });
    useGameStore.setState({
      grid: [], puzzle: null, status: 'playing', generationStatus: 'idle', generationError: null, pendingGameSettings: null,
      sessionPhase: 'playing', sessionKind: 'game', recoveryNotice: null, selectedCell: null, inputMode: 'digit',
      history: [], historyIndex: -1, elapsedMs: 0, pausedByUser: false, conflicts: new Map(), hintsUsed: 0, errorsMade: 0,
      submittedCompletionId: null, completionSyncStatus: 'idle', completionSyncError: null,
    });
  });

  afterEach(async () => {
    // Let the store's debounced auto-save settle so it cannot leak into the next test.
    await new Promise((resolve) => setTimeout(resolve, 600));
    localStorage.clear();
  });

  it('starts an easy game on first load and prefetches the next one', async () => {
    mocks.take.mockResolvedValueOnce(makePuzzle([[0, 0]]));
    render(<App />);
    expect(screen.getByText('Generating your puzzle…')).toBeInTheDocument();
    expect(await screen.findAllByRole('gridcell')).toHaveLength(81);
    expect(mocks.take).toHaveBeenCalledWith('easy', 'classic');
    expect(mocks.prefetch).toHaveBeenCalledWith('easy', 'classic');
    expect(screen.queryByText('Generating your puzzle…')).not.toBeInTheDocument();
  });

  it('shows a retryable error when generation fails', async () => {
    mocks.take.mockRejectedValueOnce(new Error('Worker crashed')).mockResolvedValueOnce(makePuzzle([[0, 0]]));
    render(<App />);
    expect(await screen.findByText("Couldn't create a puzzle")).toBeInTheDocument();
    expect(screen.getByText('Worker crashed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try Again' }));
    expect(await screen.findAllByRole('gridcell')).toHaveLength(81);
    expect(mocks.take).toHaveBeenCalledTimes(2);
  });

  it('celebrates completion with a score, syncs the result, and starts a new game on request', async () => {
    mocks.take.mockResolvedValue(makePuzzle([[0, 0]]));
    render(<App />);
    await screen.findAllByRole('gridcell');
    await solveLastCell(user, solution[0][0]);

    const dialog = await screen.findByRole('dialog', { name: 'Puzzle Complete!' });
    expect(within(dialog).getByText('Puzzle Complete!')).toBeInTheDocument();
    expect(within(dialog).getByTestId('score-total')).toHaveTextContent(/\d/);
    expect(await within(dialog).findByText('Stats synced.')).toBeInTheDocument();
    expect(mocks.post).toHaveBeenCalledOnce();

    await user.click(within(dialog).getByRole('button', { name: 'New Game' }));
    expect(mocks.take).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog', { name: 'Puzzle Complete!' })).not.toBeInTheDocument();
  });

  it('asks before discarding progress and honours both answers', async () => {
    mocks.take.mockResolvedValue(makePuzzle([[0, 0], [0, 1]]));
    render(<App />);
    await screen.findAllByRole('gridcell');
    await solveLastCell(user, solution[0][0]); // progress, but not complete

    await user.click(screen.getByRole('button', { name: /New Game/ }));
    const confirm = await screen.findByRole('dialog', { name: 'Start new game?' });
    await user.click(within(confirm).getByRole('button', { name: 'Keep Playing' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mocks.take).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /New Game/ }));
    await user.click(within(await screen.findByRole('dialog', { name: 'Start new game?' })).getByRole('button', { name: 'New Game' }));
    expect(mocks.take).toHaveBeenCalledTimes(2);
  });

  it('plays the daily from the picker with its banner and completion copy', async () => {
    mocks.take.mockResolvedValue(makePuzzle([[0, 0]]));
    mocks.daily.mockResolvedValue(makePuzzle([[0, 0]], { daily: { id: 5, date: utcDateString() } }));
    render(<App />);
    await screen.findAllByRole('gridcell');

    await user.click(screen.getByRole('button', { name: /Daily/ }));
    const picker = screen.getByRole('dialog', { name: 'Daily puzzles' });
    await user.click(within(picker).getAllByRole('button')[0]);
    expect(await screen.findByText(/^Daily puzzle ·/)).toBeInTheDocument();
    expect(mocks.daily).toHaveBeenCalledWith('classic');

    await solveLastCell(user, solution[0][0]);
    const dialog = await screen.findByRole('dialog', { name: 'Daily Complete!' });
    expect(within(dialog).getByRole('button', { name: 'Share result' })).toBeInTheDocument();
    expect(mocks.post.mock.calls[0][0]).toMatchObject({ dailyPuzzleId: 5 });
  });

  it('auto-pauses when the tab is hidden and shows keyboard help on ?', async () => {
    mocks.take.mockResolvedValue(makePuzzle([[0, 0]]));
    render(<App />);
    await screen.findAllByRole('gridcell');

    let hidden = true;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    fireEvent(document, new Event('visibilitychange'));
    const paused = await screen.findByRole('dialog', { name: 'Paused' });
    hidden = false;
    fireEvent(document, new Event('visibilitychange'));
    expect(paused).not.toBeInTheDocument();

    await user.keyboard('?');
    const help = await screen.findByRole('dialog', { name: 'Keyboard Shortcuts' });
    fireEvent(help, new Event('cancel', { cancelable: true }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard Shortcuts' })).not.toBeInTheDocument();
  });

  it('reports a corrupt saved game and starts fresh', async () => {
    localStorage.setItem('infinite-sudoku-save', '{not json');
    mocks.take.mockResolvedValue(makePuzzle([[0, 0]]));
    render(<App />);
    const notice = await screen.findByText(/could not be restored/);
    await screen.findAllByRole('gridcell');
    await user.click(screen.getByRole('button', { name: 'Dismiss recovery notice' }));
    expect(notice).not.toBeInTheDocument();
  });

  it('runs a hint puzzle: give up returns to the parent, claiming reveals the answer', async () => {
    mocks.take.mockResolvedValue(makePuzzle([[0, 0]], { difficulty: 'medium' }));
    render(<App />);
    await screen.findAllByRole('gridcell');
    await user.click(screen.getByRole('gridcell', { name: /^Row 1, Column 1,/ }));

    await user.keyboard('h');
    expect(await screen.findByText(/Hint Puzzle — Depth 1/)).toBeInTheDocument();
    expect(await screen.findAllByRole('gridcell')).toHaveLength(36); // the easier 6×6 puzzle
    await user.click(screen.getByRole('button', { name: 'Give up & go back' }));
    expect(await screen.findAllByRole('gridcell')).toHaveLength(81);
    expect(useGameStore.getState().grid[0][0].digit).toBeNull();

    await user.click(screen.getByRole('gridcell', { name: /^Row 1, Column 1,/ }));
    await user.keyboard('h');
    expect(await screen.findAllByRole('gridcell')).toHaveLength(36);
    await solveLastCell(user, miniSolution[0][0]);
    await user.click(within(await screen.findByRole('dialog', { name: 'Hint Earned!' })).getByRole('button', { name: 'Claim Hint' }));
    expect(await screen.findByRole('dialog', { name: 'Puzzle Complete!' })).toBeInTheDocument(); // parent finished by the reveal
    expect(useGameStore.getState().grid[0][0].digit).toBe(solution[0][0]);
    expect(useGameStore.getState().hintsUsed).toBe(1); // the abandoned attempt was not charged, the earned one was
  });
});
