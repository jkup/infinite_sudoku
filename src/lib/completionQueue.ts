import type { Difficulty, GameMode } from '../engine/types';

const QUEUE_KEY = 'infinite-sudoku-completion-queue-v1';

export type QueuedCompletion = {
  completionId: string;
  mode: GameMode;
  difficulty: Difficulty;
  solveTimeMs: number;
  hintsUsed: number;
  maxHintDepth: number;
  errorsMade: number;
  dailyPuzzleId?: number;
};

function readQueue(): QueuedCompletion[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is QueuedCompletion => Boolean(item)
      && typeof item === 'object' && typeof (item as QueuedCompletion).completionId === 'string');
  } catch { return []; }
}

function writeQueue(queue: QueuedCompletion[]): void {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch { /* unavailable */ }
}

export function queueCompletion(completion: QueuedCompletion): void {
  const queue = readQueue().filter((item) => item.completionId !== completion.completionId);
  writeQueue([...queue, completion]);
}

export function getQueuedCompletion(completionId: string): QueuedCompletion | null {
  return readQueue().find((item) => item.completionId === completionId) ?? null;
}

export function removeQueuedCompletion(completionId: string): void {
  writeQueue(readQueue().filter((item) => item.completionId !== completionId));
}
