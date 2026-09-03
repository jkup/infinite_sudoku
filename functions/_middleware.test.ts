import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authenticateRequest, createClerkClient } = vi.hoisted(() => ({
  authenticateRequest: vi.fn(),
  createClerkClient: vi.fn(),
}));

vi.mock('@clerk/backend', () => ({ createClerkClient }));

import { onRequest } from './_middleware';

type MiddlewareContext = Parameters<(typeof onRequest)[number]>[0];

function contextFor(path: string, env: Record<string, string | undefined> = {}): MiddlewareContext {
  return {
    request: new Request(`https://infinitesudoku.com${path}`, {
      headers: { Authorization: 'Bearer header.payload.signature' },
    }),
    env: {
      CLERK_SECRET: 'sk_test_not-a-real-secret',
      CLERK_PUBLIC: 'pk_test_not-a-real-key',
      DB: {},
      ...env,
    },
    params: {},
    data: {},
    functionPath: '_middleware',
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
    next: vi.fn().mockResolvedValue(new Response('next')),
  } as unknown as MiddlewareContext;
}

describe('API authentication middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createClerkClient.mockReturnValue({ authenticateRequest });
  });

  it('does not authenticate non-API routes', async () => {
    const context = contextFor('/');
    const response = await onRequest[0](context);
    expect(await response.text()).toBe('next');
    expect(createClerkClient).not.toHaveBeenCalled();
  });

  it('passes a verified user ID to downstream API handlers', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_verified' }),
    });
    const context = contextFor('/api/stats');
    const response = await onRequest[0](context);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(context.data).toEqual({ clerkUserId: 'user_verified' });
    expect(context.next).toHaveBeenCalledOnce();
    expect(authenticateRequest).toHaveBeenCalledWith(context.request, expect.objectContaining({
      acceptsToken: 'session_token',
      authorizedParties: expect.arrayContaining(['https://infinitesudoku.com']),
    }));
  });

  it.each([
    'a missing token',
    'a malformed token',
    'a forged signature',
    'an expired token',
    'a not-yet-valid token',
    'an unauthorized party',
  ])('fails closed for %s', async () => {
    const requestState = { isAuthenticated: false, toAuth: () => ({ userId: null }) };
    authenticateRequest.mockResolvedValue(requestState);
    const context = contextFor('/api/stats');
    const response = await onRequest[0](context);

    expect(response.status).toBe(401);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(context.next).not.toHaveBeenCalled();
  });

  it('fails closed for an authenticated state without a user', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: null }),
    });
    const context = contextFor('/api/stats');
    const response = await onRequest[0](context);
    expect(response.status).toBe(401);
    expect(context.next).not.toHaveBeenCalled();
  });

  it('fails closed when Clerk verification is unavailable', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    authenticateRequest.mockRejectedValue(new Error('upstream unavailable'));
    const context = contextFor('/api/stats');
    const response = await onRequest[0](context);
    expect(response.status).toBe(401);
    expect(context.next).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledOnce();
    expect(warning.mock.calls[0][0]).not.toContain('header.payload.signature');
    expect(warning.mock.calls[0][0]).not.toContain('sk_test_not-a-real-secret');
  });

  it('fails closed when Clerk configuration is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const context = contextFor('/api/stats', { CLERK_SECRET: '' });
    const response = await onRequest[0](context);
    expect(response.status).toBe(401);
    expect(createClerkClient).not.toHaveBeenCalled();
  });

  it('uses an explicit authorized-party allowlist when configured', async () => {
    authenticateRequest.mockResolvedValue({
      isAuthenticated: true,
      toAuth: () => ({ userId: 'user_verified' }),
    });
    const context = contextFor('/api/stats', {
      CLERK_AUTHORIZED_PARTIES: 'https://preview.example, https://infinitesudoku.com',
    });
    await onRequest[0](context);

    expect(authenticateRequest).toHaveBeenCalledWith(context.request, expect.objectContaining({
      authorizedParties: ['https://preview.example', 'https://infinitesudoku.com'],
    }));
  });
});
