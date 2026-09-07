// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareText } from './share';

function stubNavigator(overrides: Partial<Navigator>) {
  vi.stubGlobal('navigator', { ...overrides });
}

describe('shareText', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('prefers the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    const writeText = vi.fn();
    stubNavigator({ share, canShare: () => true, clipboard: { writeText } as unknown as Clipboard });
    await expect(shareText('hello', 'Infinite Sudoku')).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'hello', title: 'Infinite Sudoku' });
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when the share sheet is cancelled or missing', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubNavigator({ share: vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError')), clipboard: { writeText } as unknown as Clipboard });
    await expect(shareText('hello')).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('hello');

    stubNavigator({ clipboard: { writeText } as unknown as Clipboard });
    await expect(shareText('again')).resolves.toBe('copied');
  });

  it('reports failure when neither mechanism works', async () => {
    stubNavigator({ clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } as unknown as Clipboard });
    await expect(shareText('x')).resolves.toBe('failed');
    stubNavigator({});
    await expect(shareText('x')).resolves.toBe('failed');
  });
});
