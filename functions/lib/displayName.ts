import { createClerkClient } from '@clerk/backend';

export const MAX_DISPLAY_NAME_LENGTH = 32;

type ClerkNameFields = {
  username: string | null;
  firstName: string | null;
  lastName: string | null;
};

/**
 * Public name for leaderboards: the Clerk username, else first name plus last
 * initial, else null. Trimmed, whitespace-collapsed, and length-capped.
 */
export function deriveDisplayName(user: ClerkNameFields): string | null {
  const clean = (value: string | null) => (value ?? '').replace(/\s+/g, ' ').trim();
  const username = clean(user.username);
  const first = clean(user.firstName);
  const lastInitial = clean(user.lastName).charAt(0);
  const name = username || (first && lastInitial ? `${first} ${lastInitial}.` : first);
  if (!name) return null;
  return Array.from(name).slice(0, MAX_DISPLAY_NAME_LENGTH).join('');
}

/**
 * Look up a player's display name from Clerk. Returns null when Clerk is not
 * configured, the user has no usable name, or the lookup fails; callers keep
 * whatever name was cached before.
 */
export async function fetchDisplayName(env: Cloudflare.Env, userId: string): Promise<string | null> {
  if (!env.CLERK_SECRET || !env.CLERK_PUBLIC) return null;
  try {
    const clerk = createClerkClient({ secretKey: env.CLERK_SECRET, publishableKey: env.CLERK_PUBLIC });
    return deriveDisplayName(await clerk.users.getUser(userId));
  } catch (error) {
    console.warn(JSON.stringify({
      message: 'Display name lookup failed', errorType: error instanceof Error ? error.name : 'UnknownError',
    }));
    return null;
  }
}
