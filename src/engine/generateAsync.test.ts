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

  it('rejects a request that exceeds the generation timeout', async () => {
    vi.useFakeTimers();
    const { generatePuzzleAsync } = await import('./generateAsync');
    const result = generatePuzzleAsync('easy', 'classic');
    const assertion = expect(result).rejects.toThrow('Puzzle generation timed out');
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
  });
});
