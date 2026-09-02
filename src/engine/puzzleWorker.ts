import { generatePuzzle } from './generator';
import type { Difficulty, GameMode } from './types';

self.onmessage = (e: MessageEvent<{ requestId: string; difficulty: Difficulty; mode: GameMode }>) => {
  const { requestId, difficulty, mode } = e.data;
  try {
    self.postMessage({ requestId, puzzle: generatePuzzle(difficulty, mode) });
  } catch (error) {
    self.postMessage({ requestId, error: error instanceof Error ? error.message : 'Puzzle generation failed' });
  }
};
