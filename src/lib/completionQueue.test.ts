// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { getQueuedCompletion, queueCompletion, removeQueuedCompletion } from './completionQueue';

const completion = {
  completionId: 'c0ffee00-0000-4000-8000-000000000010', mode: 'classic' as const,
  difficulty: 'easy' as const, solveTimeMs: 10_000, hintsUsed: 0,
  maxHintDepth: 0, errorsMade: 0,
};

describe('completion retry queue', () => {
  beforeEach(() => localStorage.clear());

  it('deduplicates by completion ID and removes only after acknowledgement', () => {
    queueCompletion(completion);
    queueCompletion({ ...completion, solveTimeMs: 11_000 });
    expect(getQueuedCompletion(completion.completionId)?.solveTimeMs).toBe(11_000);
    expect(JSON.parse(localStorage.getItem('infinite-sudoku-completion-queue-v1')!)).toHaveLength(1);
    removeQueuedCompletion(completion.completionId);
    expect(getQueuedCompletion(completion.completionId)).toBeNull();
  });

  it('fails safely when stored queue data is corrupt', () => {
    localStorage.setItem('infinite-sudoku-completion-queue-v1', '{bad');
    expect(getQueuedCompletion(completion.completionId)).toBeNull();
  });
});
