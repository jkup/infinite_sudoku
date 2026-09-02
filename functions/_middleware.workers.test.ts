import { createPagesEventContext } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';
import { onRequest } from './_middleware';

type Middleware = (typeof onRequest)[number];

function contextFor(path: string, authorization?: string) {
  const headers = new Headers();
  if (authorization) headers.set('Authorization', authorization);
  return createPagesEventContext<Middleware>({
    request: new Request(`https://infinitesudoku.com${path}`, { headers }) as never,
    next: vi.fn().mockResolvedValue(new Response('next')),
  });
}

describe('authentication in the Workers runtime', () => {
  it('passes through static routes without invoking Clerk', async () => {
    const response = await onRequest[0](contextFor('/'));
    expect(await response.text()).toBe('next');
  });

  it.each([
    undefined,
    'Basic credentials',
    'Bearer malformed',
    'Bearer header.payload.signature',
  ])('returns 401 for an unverifiable API credential (%s)', async (authorization) => {
    const response = await onRequest[0](contextFor('/api/stats', authorization));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
  });
});
