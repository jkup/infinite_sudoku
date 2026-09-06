import { describe, expect, it, vi } from 'vitest';

const { getUser, createClerkClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createClerkClient: vi.fn(),
}));
vi.mock('@clerk/backend', () => ({ createClerkClient }));

import { deriveDisplayName, fetchDisplayName } from './displayName';

const env = { CLERK_SECRET: 'sk_test_x', CLERK_PUBLIC: 'pk_test_x' } as unknown as Cloudflare.Env;

describe('deriveDisplayName', () => {
  it('prefers the username, then first name with last initial, then first name', () => {
    expect(deriveDisplayName({ username: 'sudoku_fan', firstName: 'Ada', lastName: 'Lovelace' })).toBe('sudoku_fan');
    expect(deriveDisplayName({ username: null, firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada L.');
    expect(deriveDisplayName({ username: '', firstName: 'Ada', lastName: null })).toBe('Ada');
    expect(deriveDisplayName({ username: null, firstName: null, lastName: 'Lovelace' })).toBeNull();
  });

  it('normalises whitespace and caps the length', () => {
    expect(deriveDisplayName({ username: '  spaced   out  ', firstName: null, lastName: null })).toBe('spaced out');
    expect(deriveDisplayName({ username: 'x'.repeat(50), firstName: null, lastName: null })).toHaveLength(32);
  });
});

describe('fetchDisplayName', () => {
  it('derives the name from the Clerk user', async () => {
    createClerkClient.mockReturnValue({ users: { getUser } });
    getUser.mockResolvedValue({ username: null, firstName: 'Grace', lastName: 'Hopper' });
    await expect(fetchDisplayName(env, 'user_1')).resolves.toBe('Grace H.');
    expect(getUser).toHaveBeenCalledWith('user_1');
  });

  it('returns null without Clerk configuration or when the lookup fails', async () => {
    await expect(fetchDisplayName({ ...env, CLERK_SECRET: '' }, 'user_1')).resolves.toBeNull();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createClerkClient.mockReturnValue({ users: { getUser } });
    getUser.mockRejectedValue(new Error('rate limited'));
    await expect(fetchDisplayName(env, 'user_1')).resolves.toBeNull();
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0][0]).not.toContain('user_1');
  });
});
