import type { Difficulty, GameMode, Puzzle } from './types';
import { generatePuzzleAsync, generatePuzzleInBackground } from './generateAsync';

/**
 * Keeps the next puzzle for a (difficulty, mode) ready before it is asked for,
 * so "New Game" is instant even for hard and expert tiers that take seconds
 * to generate. At most one puzzle is held per key. A failed prefetch is
 * simply dropped; taking then generates in the foreground as before.
 */

const prefetched = new Map<string, Promise<Puzzle>>();

const keyFor = (difficulty: Difficulty, mode: GameMode) => `${difficulty}:${mode}`;

/** Start generating a puzzle for later, unless one is already ready or in flight. */
export function prefetchPuzzle(difficulty: Difficulty, mode: GameMode): void {
  const key = keyFor(difficulty, mode);
  if (prefetched.has(key)) return;
  const promise = generatePuzzleInBackground(difficulty, mode);
  prefetched.set(key, promise);
  // Drop a failed prefetch so the next take falls back to a fresh generation;
  // this also keeps the rejection handled.
  promise.catch(() => { if (prefetched.get(key) === promise) prefetched.delete(key); });
}

/**
 * Hand over the prefetched puzzle for these settings (resolved or still in
 * flight), or generate one in the foreground if none is available.
 */
export function takePuzzle(difficulty: Difficulty, mode: GameMode): Promise<Puzzle> {
  const key = keyFor(difficulty, mode);
  const promise = prefetched.get(key);
  if (!promise) return generatePuzzleAsync(difficulty, mode);
  prefetched.delete(key);
  return promise.catch(() => generatePuzzleAsync(difficulty, mode));
}

/** True when a puzzle for these settings is ready or being prepared. */
export function hasPrefetched(difficulty: Difficulty, mode: GameMode): boolean {
  return prefetched.has(keyFor(difficulty, mode));
}

/** Test hook. */
export function clearPrefetched(): void {
  prefetched.clear();
}
