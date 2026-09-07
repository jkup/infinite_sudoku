import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Difficulty, GameMode, Puzzle } from './types';

const { generatePuzzleAsync, generatePuzzleInBackground } = vi.hoisted(() => ({
  generatePuzzleAsync: vi.fn(),
  generatePuzzleInBackground: vi.fn(),
}));
vi.mock('./generateAsync', () => ({ generatePuzzleAsync, generatePuzzleInBackground }));

import { clearPrefetched, hasPrefetched, prefetchPuzzle, takePuzzle } from './puzzlePrefetch';

function puzzle(difficulty: Difficulty, mode: GameMode = 'classic', tag = ''): Puzzle {
  return { initial: [], solution: [], difficulty, mode, gridSize: 9, completionId: tag };
}

describe('puzzle prefetch', () => {
  beforeEach(() => {
    clearPrefetched();
    generatePuzzleAsync.mockReset();
    generatePuzzleInBackground.mockReset();
  });

  it('serves a prefetched puzzle on take and only prefetches once per settings', async () => {
    generatePuzzleInBackground.mockResolvedValue(puzzle('hard', 'classic', 'ready'));
    prefetchPuzzle('hard', 'classic');
    prefetchPuzzle('hard', 'classic');
    expect(generatePuzzleInBackground).toHaveBeenCalledTimes(1);
    expect(hasPrefetched('hard', 'classic')).toBe(true);

    await expect(takePuzzle('hard', 'classic')).resolves.toMatchObject({ completionId: 'ready' });
    expect(generatePuzzleAsync).not.toHaveBeenCalled();
    expect(hasPrefetched('hard', 'classic')).toBe(false);
  });

  it('hands over an in-flight prefetch rather than starting a second generation', async () => {
    let finish!: (p: Puzzle) => void;
    generatePuzzleInBackground.mockReturnValue(new Promise<Puzzle>((resolve) => { finish = resolve; }));
    prefetchPuzzle('expert', 'killer');
    const taken = takePuzzle('expert', 'killer');
    expect(generatePuzzleAsync).not.toHaveBeenCalled();
    finish(puzzle('expert', 'killer', 'late'));
    await expect(taken).resolves.toMatchObject({ completionId: 'late' });
  });

  it('generates in the foreground when nothing matches or the prefetch failed', async () => {
    generatePuzzleAsync.mockResolvedValue(puzzle('easy', 'classic', 'fresh'));
    await expect(takePuzzle('easy', 'classic')).resolves.toMatchObject({ completionId: 'fresh' });
    expect(generatePuzzleInBackground).not.toHaveBeenCalled();

    generatePuzzleInBackground.mockRejectedValue(new Error('worker died'));
    prefetchPuzzle('medium', 'classic');
    await vi.waitFor(() => expect(hasPrefetched('medium', 'classic')).toBe(false));
    generatePuzzleAsync.mockResolvedValue(puzzle('medium', 'classic', 'fallback'));
    await expect(takePuzzle('medium', 'classic')).resolves.toMatchObject({ completionId: 'fallback' });
  });

  it('falls back when taking a prefetch that later rejects', async () => {
    generatePuzzleInBackground.mockRejectedValue(new Error('timed out'));
    generatePuzzleAsync.mockResolvedValue(puzzle('hard', 'killer', 'fallback'));
    prefetchPuzzle('hard', 'killer');
    await expect(takePuzzle('hard', 'killer')).resolves.toMatchObject({ completionId: 'fallback' });
  });
});
