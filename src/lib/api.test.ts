// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postGameResult, setAuthTokenGetter } from './api';

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
