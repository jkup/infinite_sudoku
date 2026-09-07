import type { Difficulty, GameMode } from '../engine/types';
import { formatDailyDate } from './daily';
import { formatTime } from './formatTime';

export const SHARE_URL = 'https://infinitesudoku.com';

export type DailyShareInput = {
  date: string;
  mode: GameMode;
  difficulty: Difficulty;
  solveTimeMs: number;
  score: number;
  hintsUsed: number;
  errorsMade: number;
  /** Leaderboard standing when known (signed in and synced). */
  rank?: number;
  totalEntries?: number;
  locale?: string;
};

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Plain-text summary of a daily solve for pasting into chats and social posts.
 * Emoji carry meaning visually but every line also reads without them.
 */
export function buildDailyShareText(input: DailyShareInput): string {
  const { date, mode, difficulty, solveTimeMs, score, hintsUsed, errorsMade, rank, totalEntries, locale } = input;
  const lines = [
    `Infinite Sudoku Daily · ${formatDailyDate(date, locale)}`,
    `${capitalize(mode)} · ${capitalize(difficulty)} · ⏱ ${formatTime(solveTimeMs)} · 🏆 ${score.toLocaleString(locale)} pts`,
    `${hintsUsed === 0 ? '✨ No hints' : `💡 ${plural(hintsUsed, 'hint')}`} · ${errorsMade === 0 ? '✅ No errors' : `❌ ${plural(errorsMade, 'error')}`}`,
  ];
  if (rank !== undefined) {
    lines.push(totalEntries !== undefined && totalEntries > 0
      ? `🥇 #${rank} of ${totalEntries} on today's leaderboard`
      : `🥇 #${rank} on today's leaderboard`);
  }
  lines.push(SHARE_URL);
  return lines.join('\n');
}
