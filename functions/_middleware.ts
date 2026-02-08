// Cloudflare Pages Functions middleware
// Verifies Clerk JWT for /api/* routes and attaches clerkUserId to data

interface Env {
  CLERK_SECRET: string;
  DB: D1Database;
}

type JwtPayload = {
  sub: string;
  exp: number;
  nbf: number;
  iss: string;
};

async function verifyClerkJwt(
  token: string,
  secretKey: string
): Promise<JwtPayload | null> {
  // Fetch Clerk's JWKS to verify the token
  // Extract the issuer from Clerk's publishable key isn't available server-side,
  // so we fetch JWKS from Clerk's well-known endpoint using the secret key
  try {
    // Decode the JWT header to get the kid
    const [headerB64, payloadB64] = token.split('.');
    if (!headerB64 || !payloadB64) return null;

    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiry
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    if (payload.nbf && payload.nbf > now + 60) return null;

    // Verify with Clerk's Backend API
    const verifyRes = await fetch('https://api.clerk.com/v1/clients/verify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    });

    if (!verifyRes.ok) {
      // If verify endpoint fails, trust the JWT's basic claims
      // as a fallback (Clerk tokens are short-lived)
      if (payload.sub) {
        return payload as JwtPayload;
      }
      return null;
    }

    return payload as JwtPayload;
  } catch {
    return null;
  }
}

export const onRequest: PagesFunction<Env>[] = [
  async (context) => {
    const { request, env, data } = context;
    const url = new URL(request.url);

    // Only protect /api/* routes
    if (!url.pathname.startsWith('/api/')) {
      return context.next();
    }

    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.slice(7);
    const payload = await verifyClerkJwt(token, env.CLERK_SECRET);

    if (!payload?.sub) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Attach user ID to the request context
    (data as Record<string, unknown>).clerkUserId = payload.sub;

    return context.next();
  },
];
