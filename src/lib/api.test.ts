// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getDailyPuzzle, getLeaderboard, getStats, postGameResult, setAuthTokenGetter } from './api';
import { generatePuzzle } from '../engine/generator';
import { dailyPayloadFromPuzzle } from './daily';

describe('API client diagnostics', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reports a safe server correlation ID without logging the response body', async () => {
    setAuthTokenGetter(() => Promise.resolve('secret-session-token'));
    const fetchMock = vi.fn().mockResolvedValue(new Response('sensitive body', {
      status: 503,
      headers: { 'X-Request-ID': 'request-safe-123' },
    }));
    vi.stubGlobal('fetch', fetchMock);

    const request = postGameResult({
      completionId: 'c0ffee00-0000-4000-8000-000000000020', mode: 'classic',
      difficulty: 'easy', solveTimeMs: 1000, hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
    });
    await expect(request).rejects.toMatchObject({
      status: 503, correlationId: 'request-safe-123', message: 'API request failed (503)',
    });
  });
});

describe('getDailyPuzzle', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('requests the public route without a token and rebuilds the puzzle', async () => {
    setAuthTokenGetter(() => Promise.resolve('secret-session-token'));
    const puzzle = generatePuzzle('easy', 'killer');
    const fetchMock = vi.fn().mockResolvedValue(Response.json(dailyPayloadFromPuzzle(puzzle, { id: 12, date: '2026-09-06' })));
    vi.stubGlobal('fetch', fetchMock);

    const result = await getDailyPuzzle('killer', '2026-09-06');
    expect(result).toEqual({ ...puzzle, daily: { id: 12, date: '2026-09-06' } });
    expect(fetchMock).toHaveBeenCalledWith('/api/daily?mode=killer&date=2026-09-06');
  });

  it('resolves null when no puzzle exists for the date', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'none' }, { status: 404 })));
    await expect(getDailyPuzzle('classic')).resolves.toBeNull();
  });

  it('throws on server errors and malformed payloads', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500, headers: { 'X-Request-ID': 'req-9' } })));
    await expect(getDailyPuzzle('classic')).rejects.toMatchObject({ status: 500, correlationId: 'req-9' });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ id: 1, date: '2026-09-06', initial: [], solution: [] })));
    await expect(getDailyPuzzle('classic')).rejects.toThrow('invalid');
  });
});

describe('getStats and auth token handling', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the bearer token when available and returns parsed stats', async () => {
    setAuthTokenGetter(() => Promise.resolve('session-token'));
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ totalGamesCompleted: 3 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getStats()).resolves.toEqual({ totalGamesCompleted: 3 });
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer session-token' });
  });

  it('omits the header when the token getter fails, and returns null on a server error', async () => {
    setAuthTokenGetter(() => Promise.reject(new Error('clerk not ready')));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const fetchMock = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    await expect(getStats()).resolves.toBeNull();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });

  it('getLeaderboard throws an ApiError carrying the request reference', async () => {
    setAuthTokenGetter(() => Promise.resolve(null));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 502, headers: { 'X-Request-ID': 'ref-1' } })));
    await expect(getLeaderboard('2026-09-07', 'classic')).rejects.toMatchObject({ status: 502, correlationId: 'ref-1' });
  });
});
