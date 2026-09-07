// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const { shareText } = vi.hoisted(() => ({ shareText: vi.fn() }));
vi.mock('../../lib/share', () => ({ shareText }));

import ShareResultButton from './ShareResultButton';
import { useGameStore } from '../../store/gameStore';

describe('ShareResultButton', () => {
  beforeEach(() => {
    shareText.mockReset();
    useGameStore.setState({ difficulty: 'easy', mode: 'classic', elapsedMs: 742_000, hintsUsed: 0, errorsMade: 2 });
  });
  afterEach(() => vi.useRealTimers());

  it('shares the current result with the leaderboard standing and confirms', async () => {
    shareText.mockResolvedValue('copied');
    const user = userEvent.setup();
    render(<ShareResultButton date="2026-09-07" standing={{ rank: 1, totalEntries: 12 }} />);

    await user.click(screen.getByRole('button', { name: 'Share result' }));

    expect(shareText).toHaveBeenCalledOnce();
    const [text, title] = shareText.mock.calls[0];
    expect(title).toBe('Infinite Sudoku Daily');
    expect(text).toContain('Classic · Easy · ⏱ 12:22 · 🏆 218 pts');
    expect(text).toContain("#1 of 12 on today's leaderboard");
    expect(await screen.findByRole('status')).toHaveTextContent('Copied to clipboard');
  });

  it('omits the standing when unknown and reports failures', async () => {
    shareText.mockResolvedValue('failed');
    const user = userEvent.setup();
    render(<ShareResultButton date="2026-09-07" standing={null} />);

    await user.click(screen.getByRole('button', { name: 'Share result' }));
    expect(shareText.mock.calls[0][0]).not.toContain('leaderboard');
    expect(await screen.findByRole('status')).toHaveTextContent("Couldn't share");
  });
});
