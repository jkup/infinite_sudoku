// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Difficulty, GameMode, Puzzle } from './types';

class FakeWorker extends EventTarget {
  static instances: FakeWorker[] = [];
  messages: Array<{ requestId: string; difficulty: Difficulty; mode: GameMode }> = [];
  terminated = false;

  constructor() {
    super();
    FakeWorker.instances.push(this);
  }

  postMessage(message: { requestId: string; difficulty: Difficulty; mode: GameMode }) {
    this.messages.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  respond(requestId: string, puzzle: Puzzle) {
    this.dispatchEvent(new MessageEvent('message', { data: { requestId, puzzle } }));
  }
}

function puzzle(difficulty: Difficulty, mode: GameMode): Puzzle {
  const solution = Array.from({ length: 9 }, () => Array(9).fill(1));
  return { initial: solution, solution, difficulty, mode, gridSize: 9 } as Puzzle;
}

describe('asynchronous puzzle generation', () => {
  beforeEach(() => {
    vi.resetModules();
    FakeWorker.instances = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.stubGlobal('crypto', { randomUUID: vi.fn()
      .mockReturnValueOnce('request-one')
      .mockReturnValueOnce('request-two') });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('correlates concurrent out-of-order replies with their requests', async () => {
    const { generatePuzzleAsync } = await import('./generateAsync');
    const first = generatePuzzleAsync('easy', 'classic');
    const second = generatePuzzleAsync('hard', 'killer');
    const worker = FakeWorker.instances[0];

    worker.respond('request-two', puzzle('hard', 'killer'));
    worker.respond('request-one', puzzle('easy', 'classic'));

    await expect(first).resolves.toEqual(expect.objectContaining({ difficulty: 'easy', mode: 'classic' }));
    await expect(second).resolves.toEqual(expect.objectContaining({ difficulty: 'hard', mode: 'killer' }));
  });

  it('rejects every pending request and replaces a failed worker', async () => {
    const { generatePuzzleAsync } = await import('./generateAsync');
    const first = generatePuzzleAsync('easy', 'classic');
    const second = generatePuzzleAsync('hard', 'killer');
    const failedWorker = FakeWorker.instances[0];
    failedWorker.dispatchEvent(new Event('error'));

    await expect(first).rejects.toThrow('Puzzle worker failed');
    await expect(second).rejects.toThrow('Puzzle worker failed');
    expect(failedWorker.terminated).toBe(true);

    void generatePuzzleAsync('medium', 'classic');
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it('re-requests when the worker falls back to a different difficulty', async () => {
    const { generatePuzzleAsync } = await import('./generateAsync');
    const result = generatePuzzleAsync('hard', 'classic');
    const worker = FakeWorker.instances[0];

    worker.respond('request-one', puzzle('easy', 'classic'));
    await vi.waitFor(() => expect(worker.messages).toHaveLength(2));
    expect(worker.messages[1]).toMatchObject({ requestId: 'request-two', difficulty: 'hard', mode: 'classic' });

    worker.respond('request-two', puzzle('hard', 'classic'));
    await expect(result).resolves.toEqual(expect.objectContaining({ difficulty: 'hard' }));
  });

  it('rejects once the difficulty retry budget is exhausted', async () => {
    let counter = 0;
    vi.stubGlobal('crypto', { randomUUID: () => `request-${++counter}` });
    const { generatePuzzleAsync } = await import('./generateAsync');
    const { DEFAULT_DIFFICULTY_ATTEMPTS } = await import('./difficultyRetry');
    const result = generatePuzzleAsync('expert', 'killer');
    const assertion = expect(result).rejects.toThrow("Couldn't generate a expert killer puzzle");
    const worker = FakeWorker.instances[0];

    for (let attempt = 1; attempt <= DEFAULT_DIFFICULTY_ATTEMPTS; attempt++) {
      await vi.waitFor(() => expect(worker.messages).toHaveLength(attempt));
      worker.respond(`request-${attempt}`, puzzle('medium', 'killer'));
    }
    await assertion;
    expect(worker.messages).toHaveLength(DEFAULT_DIFFICULTY_ATTEMPTS);
  });

  it('applies the same retry policy to the synchronous fallback', async () => {
    vi.stubGlobal('Worker', undefined);
    vi.doMock('./generator', () => ({
      generatePuzzle: vi.fn()
        .mockReturnValueOnce(puzzle('easy', 'classic'))
        .mockReturnValueOnce(puzzle('hard', 'classic')),
    }));
    const { generatePuzzleAsync } = await import('./generateAsync');
    const { generatePuzzle } = await import('./generator');

    await expect(generatePuzzleAsync('hard', 'classic')).resolves.toEqual(expect.objectContaining({ difficulty: 'hard' }));
    expect(generatePuzzle).toHaveBeenCalledTimes(2);
    vi.doUnmock('./generator');
  });

  it('rejects a request that exceeds the generation timeout', async () => {
    vi.useFakeTimers();
    const { generatePuzzleAsync } = await import('./generateAsync');
    const result = generatePuzzleAsync('easy', 'classic');
    const assertion = expect(result).rejects.toThrow('Puzzle generation timed out');
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
