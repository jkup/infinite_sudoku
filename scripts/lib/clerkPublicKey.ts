/**
 * Resolve the Clerk publishable key for the Vite build, in priority order:
 *
 *   1. process.env.CLERK_PUBLIC  — explicit override (CI, one-off builds)
 *   2. .dev.vars                 — a developer's local instance, never committed
 *   3. wrangler.jsonc `vars`     — the committed production value, also what
 *                                  the Functions runtime receives on Pages
 *
 * The key is public by design, so committing it in wrangler.jsonc is safe and
 * keeps the bundle and the runtime on the same instance.
 */

export type KeySources = {
  env?: string | undefined;
  devVars?: string | null;
  wranglerConfig?: string | null;
};

/** Strip // and /* *\/ comments outside strings so JSONC can be JSON.parsed. */
export function stripJsonComments(text: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inString) {
      out += ch;
      if (ch === '\\') { out += next ?? ''; i++; } else if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true; out += ch;
    } else if (ch === '/' && next === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (ch === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else {
      out += ch;
    }
  }
  return out;
}

export function keyFromDevVars(devVars: string | null | undefined): string {
  return devVars?.match(/^CLERK_PUBLIC=(.+)$/m)?.[1]?.trim() ?? '';
}

export function keyFromWranglerConfig(jsonc: string | null | undefined): string {
  if (!jsonc) return '';
  try {
    const config = JSON.parse(stripJsonComments(jsonc)) as { vars?: Record<string, unknown> };
    const value = config.vars?.CLERK_PUBLIC;
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

export function resolveClerkPublicKey({ env, devVars, wranglerConfig }: KeySources): string {
  return env?.trim() || keyFromDevVars(devVars) || keyFromWranglerConfig(wranglerConfig);
}

/**
 * The Frontend API host encoded in a Clerk publishable key (`pk_live_<base64 host$>`).
 * Clerk's script and API calls load from this host, so the Content Security
 * Policy must allow it. Returns null for a malformed key.
 */
export function clerkFrontendApiHost(publishableKey: string): string | null {
  const encoded = publishableKey.match(/^pk_(?:live|test)_([A-Za-z0-9+/=]+)$/)?.[1];
  if (!encoded) return null;
  const decoded = Buffer.from(encoded, 'base64').toString('utf8');
  const host = decoded.endsWith('$') ? decoded.slice(0, -1) : decoded;
  return /^[a-z0-9.-]+$/i.test(host) ? host : null;
}
