import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { clerkFrontendApiHost, keyFromWranglerConfig, resolveClerkPublicKey, stripJsonComments } from './clerkPublicKey';

describe('clerkFrontendApiHost', () => {
  it('decodes the host from live and test keys and rejects malformed ones', () => {
    expect(clerkFrontendApiHost(`pk_live_${Buffer.from('clerk.example.com$').toString('base64')}`)).toBe('clerk.example.com');
    expect(clerkFrontendApiHost(`pk_test_${Buffer.from('bright-fox-12.clerk.accounts.dev$').toString('base64')}`)).toBe('bright-fox-12.clerk.accounts.dev');
    expect(clerkFrontendApiHost('sk_live_notapublishablekey')).toBeNull();
    expect(clerkFrontendApiHost(`pk_live_${Buffer.from('not a host').toString('base64')}`)).toBeNull();
  });
});

const wrangler = `{
  // comment with "quotes" and a // nested marker
  "name": "x", /* block */ "vars": { "CLERK_PUBLIC": "pk_live_config" },
  "url": "https://example.com/path" // trailing
}`;

describe('resolveClerkPublicKey', () => {
  it('prefers the environment, then .dev.vars, then wrangler.jsonc', () => {
    expect(resolveClerkPublicKey({ env: 'pk_env', devVars: 'CLERK_PUBLIC=pk_dev', wranglerConfig: wrangler })).toBe('pk_env');
    expect(resolveClerkPublicKey({ env: '', devVars: 'CLERK_SECRET=sk\nCLERK_PUBLIC=pk_dev \n', wranglerConfig: wrangler })).toBe('pk_dev');
    expect(resolveClerkPublicKey({ devVars: null, wranglerConfig: wrangler })).toBe('pk_live_config');
    expect(resolveClerkPublicKey({ devVars: 'CLERK_PUBLIC=\n', wranglerConfig: null })).toBe('');
  });

  it('parses JSONC comments without corrupting strings that contain slashes', () => {
    expect(JSON.parse(stripJsonComments(wrangler))).toEqual({ name: 'x', vars: { CLERK_PUBLIC: 'pk_live_config' }, url: 'https://example.com/path' });
    expect(keyFromWranglerConfig('{ not json')).toBe('');
    expect(keyFromWranglerConfig('{"vars":{"CLERK_PUBLIC":42}}')).toBe('');
  });

  it('reads the committed production key from the real wrangler.jsonc', () => {
    const real = readFileSync(path.resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
    expect(keyFromWranglerConfig(real)).toMatch(/^pk_live_[A-Za-z0-9]+$/);
  });
});
