// GET /api/stats — fetch user stats
// POST /api/stats — save game result and update user stats

import { parseGameResult, RequestValidationError } from '../lib/gameResult';

type RequestData = {
  clerkUserId: string;
};

export const onRequestGet: PagesFunction<Cloudflare.Env, string, RequestData> = async (context) => {
  const userId = context.data.clerkUserId;
  const { DB } = context.env;

  const row = await DB.prepare(
    'SELECT * FROM user_stats WHERE clerk_user_id = ?'
  ).bind(userId).first();

  if (!row) {
    return Response.json({
      totalGamesCompleted: 0,
      totalHintsUsed: 0,
      totalScore: 0,
      currentDailyStreak: 0,
      longestDailyStreak: 0,
    });
  }

  return Response.json({
    totalGamesCompleted: row.total_games_completed,
    totalHintsUsed: row.total_hints_used,
    totalScore: row.total_score,
    currentDailyStreak: row.current_daily_streak,
    longestDailyStreak: row.longest_daily_streak,
  });
};

export const onRequestPost: PagesFunction<Cloudflare.Env, string, RequestData> = async (context) => {
  const userId = context.data.clerkUserId;
  const { DB } = context.env;

  let body;
  try {
    body = await parseGameResult(context.request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return Response.json({ error: error.message }, { status: error.status, headers: { 'X-Error-Category': 'validation' } });
    }
    console.error(JSON.stringify({ message: 'Unexpected game result parsing error', errorType: error instanceof Error ? error.name : 'UnknownError' }));
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: { 'X-Error-Category': 'unexpected' } });
  }

  try {
    let daily: { id: number; date: string; mode: string; difficulty: string } | null = null;
    if (body.dailyPuzzleId !== undefined) {
      daily = await DB.prepare(
        'SELECT id, date, mode, difficulty FROM daily_puzzles WHERE id = ?',
      ).bind(body.dailyPuzzleId).first<{ id: number; date: string; mode: string; difficulty: string }>();
      if (!daily || daily.mode !== body.mode || daily.difficulty !== body.difficulty) {
        return Response.json({ error: 'Invalid daily puzzle' }, { status: 400, headers: { 'X-Error-Category': 'validation' } });
      }
    }

    const dailyDate = daily?.date ?? null;

    await DB.batch([
      DB.prepare(
        `INSERT INTO user_stats
         (clerk_user_id, total_games_completed, total_hints_used, total_score, current_daily_streak, longest_daily_streak)
         VALUES (?, 0, 0, 0, 0, 0)
         ON CONFLICT(clerk_user_id) DO NOTHING`,
      ).bind(userId),
      DB.prepare(
        `INSERT INTO game_results
         (clerk_user_id, mode, difficulty, solve_time_ms, hints_used, max_hint_depth,
          errors_made, score, completion_id, stats_counted, is_daily, daily_date, daily_puzzle_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
         ON CONFLICT DO NOTHING`,
      ).bind(
        userId, body.mode, body.difficulty, body.solveTimeMs, body.hintsUsed,
        body.maxHintDepth, body.errorsMade, body.score, body.completionId,
        daily ? 1 : 0, daily?.date ?? null, daily?.id ?? null,
      ),
      DB.prepare(
        `UPDATE user_stats SET
           total_games_completed = total_games_completed + 1,
           total_hints_used = total_hints_used + ?,
           total_score = total_score + ?,
           current_daily_streak = CASE
             WHEN ? IS NULL THEN current_daily_streak
             WHEN last_daily_date IS NULL THEN 1
             WHEN ? <= last_daily_date THEN current_daily_streak
             WHEN last_daily_date = date(?, '-1 day') THEN current_daily_streak + 1
             ELSE 1
           END,
           longest_daily_streak = MAX(longest_daily_streak, CASE
             WHEN ? IS NULL THEN current_daily_streak
             WHEN last_daily_date IS NULL THEN 1
             WHEN ? <= last_daily_date THEN current_daily_streak
             WHEN last_daily_date = date(?, '-1 day') THEN current_daily_streak + 1
             ELSE 1
           END),
           last_daily_date = CASE
             WHEN ? IS NOT NULL AND (last_daily_date IS NULL OR ? > last_daily_date) THEN ?
             ELSE last_daily_date
           END,
           updated_at = CURRENT_TIMESTAMP
         WHERE clerk_user_id = ?
           AND EXISTS (
             SELECT 1 FROM game_results
             WHERE clerk_user_id = ? AND completion_id = ? AND stats_counted = 0
           )`,
      ).bind(
        body.hintsUsed, body.score,
        dailyDate, dailyDate, dailyDate,
        dailyDate, dailyDate, dailyDate,
        dailyDate, dailyDate, dailyDate,
        userId, userId, body.completionId,
      ),
      DB.prepare(
        `UPDATE game_results SET stats_counted = 1
         WHERE clerk_user_id = ? AND completion_id = ? AND stats_counted = 0`,
      ).bind(userId, body.completionId),
    ]);
  } catch (error) {
    console.error(JSON.stringify({ message: 'Failed to persist game result', errorType: error instanceof Error ? error.name : 'UnknownError' }));
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: { 'X-Error-Category': 'database' } });
  }

  return Response.json({ ok: true, score: body.score });
};
