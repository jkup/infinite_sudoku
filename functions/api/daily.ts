// GET /api/daily?mode=classic[&date=YYYY-MM-DD] — fetch a canonical daily puzzle.
// Public: the middleware skips authentication for this route. Only results are
// user-scoped; the puzzle itself is the same for everyone.

import type { GameMode } from '../../src/engine/types';
import {
  DAILY_MODES, dailyPayloadFromPuzzle, isDailyDate, puzzleFromDailyRow, utcDateString,
  type DailyPuzzleRow,
} from '../../src/lib/daily';

function validationError(message: string, status = 400): Response {
  return Response.json({ error: message }, { status, headers: { 'X-Error-Category': 'validation' } });
}

export const onRequestGet: PagesFunction<Cloudflare.Env> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const mode = url.searchParams.get('mode') ?? 'classic';
  const today = utcDateString();
  const date = url.searchParams.get('date') ?? today;

  if (!DAILY_MODES.includes(mode as GameMode)) return validationError('Invalid mode');
  if (!isDailyDate(date)) return validationError('Invalid date');
  // Never serve a puzzle before its UTC date, so nobody can pre-solve tomorrow.
  if (date > today) return validationError('No daily puzzle for this date', 404);

  const row = await DB.prepare(
    `SELECT id, date, mode, difficulty, puzzle_data, cage_data, solution
     FROM daily_puzzles WHERE date = ? AND mode = ?`,
  ).bind(date, mode).first<DailyPuzzleRow>();
  if (!row) return validationError('No daily puzzle for this date', 404);

  const puzzle = puzzleFromDailyRow(row);
  if (!puzzle?.daily) {
    console.error(JSON.stringify({ message: 'Stored daily puzzle is invalid', dailyPuzzleId: row.id }));
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: { 'X-Error-Category': 'database' } });
  }

  return Response.json(dailyPayloadFromPuzzle(puzzle, puzzle.daily));
};
