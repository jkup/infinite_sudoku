import { generatePuzzle } from './generator';
import type { Difficulty, GameMode } from './types';

self.onmessage = (e: MessageEvent<{ difficulty: Difficulty; mode: GameMode }>) => {
  const { difficulty, mode } = e.data;
  const puzzle = generatePuzzle(difficulty, mode);
  self.postMessage(puzzle);
};
