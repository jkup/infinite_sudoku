import { createClerkClient } from '@clerk/backend';

// Cloudflare Pages Functions middleware.
// Authenticates Clerk session tokens for /api/* and attaches the verified user ID.

const DEFAULT_AUTHORIZED_PARTIES = [
  'https://infinitesudoku.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

function getAuthorizedParties(value: string | undefined): string[] {
  if (!value) return DEFAULT_AUTHORIZED_PARTIES;
  return value.split(',').map((party) => party.trim()).filter(Boolean);
}

function unauthorized(): Response {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}

export const onRequest: PagesFunction<Cloudflare.Env>[] = [
  async (context) => {
    const { request, env, data } = context;
    const url = new URL(request.url);

    // Only protect /api/* routes
    if (!url.pathname.startsWith('/api/')) {
      return context.next();
    }

    if (!env.CLERK_SECRET || !env.CLERK_PUBLIC) {
      console.error(JSON.stringify({
        message: 'Clerk authentication is not configured',
        path: url.pathname,
      }));
      return unauthorized();
    }

    try {
      const clerk = createClerkClient({
        secretKey: env.CLERK_SECRET,
        publishableKey: env.CLERK_PUBLIC,
      });
      const requestState = await clerk.authenticateRequest(request, {
        acceptsToken: 'session_token',
        authorizedParties: getAuthorizedParties(env.CLERK_AUTHORIZED_PARTIES),
      });

      if (!requestState.isAuthenticated) return unauthorized();

      const { userId } = requestState.toAuth();
      if (!userId) return unauthorized();

      (data as Record<string, unknown>).clerkUserId = userId;
      return context.next();
    } catch (error) {
      console.warn(JSON.stringify({
        message: 'Clerk authentication failed',
        path: url.pathname,
        errorType: error instanceof Error ? error.name : 'UnknownError',
      }));
      return unauthorized();
    }
  },
];
