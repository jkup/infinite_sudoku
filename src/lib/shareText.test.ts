import { describe, expect, it } from 'vitest';
import { buildDailyShareText } from './shareText';

const base = {
  date: '2026-09-07', mode: 'classic', difficulty: 'easy', solveTimeMs: 742_000,
  score: 218, hintsUsed: 0, errorsMade: 2, locale: 'en-US',
} as const;

describe('buildDailyShareText', () => {
  it('summarises the solve with a stable, pasteable layout', () => {
    expect(buildDailyShareText({ ...base, rank: 1, totalEntries: 12 })).toBe([
      'Infinite Sudoku Daily · Monday, September 7',
      'Classic · Easy · ⏱ 12:22 · 🏆 218 pts',
      '✨ No hints · ❌ 2 errors',
      "🥇 #1 of 12 on today's leaderboard",
      'https://infinitesudoku.com',
    ].join('\n'));
  });

  it('omits the leaderboard line when standing is unknown and pluralises counts', () => {
    const text = buildDailyShareText({ ...base, mode: 'killer', difficulty: 'expert', score: 15_230, hintsUsed: 1, errorsMade: 0 });
    expect(text).not.toContain('leaderboard');
    expect(text).toContain('Killer · Expert');
    expect(text).toContain('15,230 pts');
    expect(text).toContain('💡 1 hint · ✅ No errors');
  });

  it('shows a rank without a total when the total is unknown', () => {
    expect(buildDailyShareText({ ...base, rank: 3 })).toContain("🥇 #3 on today's leaderboard");
  });
});
