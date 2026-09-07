import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clerkFrontendApiHost, keyFromWranglerConfig } from '../scripts/lib/clerkPublicKey';

/**
 * The Content Security Policy in public/_headers must allow whichever Clerk
 * Frontend API host the committed publishable key points at, or sign-in
 * silently breaks in production while working against a dev instance.
 */
function cspDirectives(): Map<string, string[]> {
  const headers = readFileSync(path.resolve(process.cwd(), 'public/_headers'), 'utf8');
  const csp = headers.match(/^\s*Content-Security-Policy:\s*(.+)$/m)?.[1];
  if (!csp) throw new Error('No Content-Security-Policy in public/_headers');
  return new Map(csp.split(';').map((part) => {
    const [name, ...sources] = part.trim().split(/\s+/);
    return [name, sources];
  }));
}

describe('Content Security Policy', () => {
  const directives = cspDirectives();
  const key = keyFromWranglerConfig(readFileSync(path.resolve(process.cwd(), 'wrangler.jsonc'), 'utf8'));
  const host = clerkFrontendApiHost(key);

  it('allows the Clerk Frontend API host from the committed publishable key', () => {
    expect(host).toBeTruthy();
    expect(directives.get('script-src')).toContain(`https://${host}`);
    expect(directives.get('connect-src')).toContain(`https://${host}`);
  });

  it('keeps the bot-protection and Clerk asset hosts Clerk documents', () => {
    expect(directives.get('script-src')).toEqual(expect.arrayContaining(['https://challenges.cloudflare.com', 'https://*.protect.clerk.com']));
    expect(directives.get('frame-src')).toEqual(expect.arrayContaining(['https://challenges.cloudflare.com', 'https://*.protect.clerk.com']));
    expect(directives.get('img-src')).toContain('https://img.clerk.com');
    expect(directives.get('worker-src')).toEqual(expect.arrayContaining(["'self'", 'blob:']));
    expect(directives.get('style-src')).toContain("'unsafe-inline'");
  });

  it('never loosens script execution beyond allowlisted hosts', () => {
    expect(directives.get('script-src')).not.toContain("'unsafe-eval'");
    expect(directives.get('script-src')).not.toContain("'unsafe-inline'");
    expect(directives.get('object-src')).toEqual(["'none'"]);
  });
});
