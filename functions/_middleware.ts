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

function secureApiResponse(response: Response): Response {
  const secured = new Response(response.body, response);
  secured.headers.set('Cache-Control', 'private, no-store');
  secured.headers.set('Pragma', 'no-cache');
  secured.headers.set('Referrer-Policy', 'no-referrer');
  secured.headers.set('X-Content-Type-Options', 'nosniff');
  secured.headers.set('X-Frame-Options', 'DENY');
  return secured;
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

    const startedAt = Date.now();
    const requestId = crypto.randomUUID();
    const finish = (response: Response, category?: string): Response => {
      const secured = secureApiResponse(response);
      const failureCategory = category ?? secured.headers.get('X-Error-Category') ?? (
        secured.status >= 500 ? 'unexpected' : secured.status >= 400 ? 'validation' : null
      );
      secured.headers.delete('X-Error-Category');
      secured.headers.set('X-Request-ID', requestId);
      const entry = JSON.stringify({
        message: 'API request completed', requestId, endpoint: url.pathname,
        status: secured.status, durationMs: Date.now() - startedAt,
        ...(failureCategory ? { failureCategory } : {}),
      });
      if (secured.status >= 500) console.error(entry);
      else if (secured.status >= 400) console.warn(entry);
      else console.info(entry);
      return secured;
    };

    if (!env.CLERK_SECRET || !env.CLERK_PUBLIC) {
      return finish(unauthorized(), 'authentication');
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

      if (!requestState.isAuthenticated) return finish(unauthorized(), 'authentication');

      const { userId } = requestState.toAuth();
      if (!userId) return finish(unauthorized(), 'authentication');

      (data as Record<string, unknown>).clerkUserId = userId;
      try {
        return finish(await context.next());
      } catch (error) {
        console.error(JSON.stringify({
          message: 'API handler threw', requestId, endpoint: url.pathname,
          failureCategory: 'unexpected', errorType: error instanceof Error ? error.name : 'UnknownError',
        }));
        return finish(Response.json({ error: 'Internal server error' }, { status: 500 }), 'unexpected');
      }
    } catch (error) {
      void error;
      return finish(unauthorized(), 'upstream');
    }
  },
];
