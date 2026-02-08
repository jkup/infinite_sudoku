import type { Difficulty, GameMode, Puzzle } from './types';
import { generatePuzzle } from './generator';

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
