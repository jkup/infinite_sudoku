import type { Difficulty, GameMode, Puzzle } from './types';
import { generatePuzzle } from './generator';
import { generateMiniPuzzle } from './miniGenerator';

type WorkerRequest = { requestId: string; difficulty: Difficulty; mode: GameMode };
type WorkerResponse = { requestId: string; puzzle: Puzzle } | { requestId: string; error: string };
type PendingRequest = {
  resolve: (puzzle: Puzzle) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
};

const GENERATION_TIMEOUT_MS = 20_000;
let worker: Worker | null = null;
const pending = new Map<string, PendingRequest>();

function rejectAll(error: Error) {
  for (const request of pending.values()) {
    clearTimeout(request.timeout);
    request.reject(error);
  }
  pending.clear();
}

function discardWorker(error: Error) {
  worker?.terminate();
  worker = null;
  rejectAll(error);
}

function isWorkerResponse(value: unknown): value is WorkerResponse {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.requestId === 'string'
    && (typeof candidate.error === 'string'
      || (candidate.puzzle !== null && typeof candidate.puzzle === 'object'));
}

function getWorker(): Worker | null {
  if (worker) return worker;
  try {
    const created = new Worker(new URL('./puzzleWorker.ts', import.meta.url), { type: 'module' });
    created.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (!isWorkerResponse(event.data)) {
        discardWorker(new Error('Puzzle worker returned an invalid response'));
        return;
      }
      const request = pending.get(event.data.requestId);
      if (!request) return;
      pending.delete(event.data.requestId);
      clearTimeout(request.timeout);
      if ('error' in event.data) request.reject(new Error(event.data.error));
      else request.resolve(event.data.puzzle);
    });
    created.addEventListener('error', () => discardWorker(new Error('Puzzle worker failed')));
    created.addEventListener('messageerror', () => discardWorker(new Error('Puzzle worker returned unreadable data')));
    worker = created;
    return created;
  } catch {
    return null;
  }
}

/** Generate off the main thread, falling back synchronously only when Workers are unavailable. */
export function generatePuzzleAsync(difficulty: Difficulty, mode: GameMode): Promise<Puzzle> {
  const currentWorker = getWorker();
  if (!currentWorker) return Promise.resolve(generatePuzzle(difficulty, mode));

  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (!pending.delete(requestId)) return;
      reject(new Error('Puzzle generation timed out'));
    }, GENERATION_TIMEOUT_MS);
    pending.set(requestId, { resolve, reject, timeout });
    try {
      const request: WorkerRequest = { requestId, difficulty, mode };
      currentWorker.postMessage(request);
    } catch {
      discardWorker(new Error('Could not start puzzle generation'));
    }
  });
}

/** Generate a 6x6 mini puzzle; this is fast enough for the main thread. */
export function generateMiniPuzzleAsync(difficulty: Difficulty): Promise<Puzzle> {
  return Promise.resolve(generateMiniPuzzle(difficulty));
}
