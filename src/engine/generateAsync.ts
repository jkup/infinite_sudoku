import type { Difficulty, GameMode, Puzzle } from './types';
import { generatePuzzle } from './generator';
import { generateMiniPuzzle } from './miniGenerator';

let worker: Worker | null = null;

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    worker = new Worker(new URL('./puzzleWorker.ts', import.meta.url), { type: 'module' });
    return worker;
  } catch {
    return null;
  }
}

/**
 * Generate a puzzle off the main thread when possible.
 * Falls back to synchronous generation if Workers are unavailable.
 */
export function generatePuzzleAsync(difficulty: Difficulty, mode: GameMode): Promise<Puzzle> {
  const w = getWorker();
  if (!w) {
    return Promise.resolve(generatePuzzle(difficulty, mode));
  }

  return new Promise((resolve) => {
    const handler = (e: MessageEvent<Puzzle>) => {
      w.removeEventListener('message', handler);
      resolve(e.data);
    };
    w.addEventListener('message', handler);
    w.postMessage({ difficulty, mode });
  });
}

/**
 * Generate a 6x6 mini puzzle. Fast enough to run on the main thread,
 * wrapped in a Promise for consistency with the async API.
 */
export function generateMiniPuzzleAsync(difficulty: Difficulty): Promise<Puzzle> {
  return Promise.resolve(generateMiniPuzzle(difficulty));
}
