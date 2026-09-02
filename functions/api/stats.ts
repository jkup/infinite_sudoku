// GET /api/stats — fetch user stats
// POST /api/stats — save game result and update user stats

import { parseGameResult, RequestValidationError } from '../lib/gameResult';

interface Env {
  DB: D1Database;
}

type RequestData = {
  clerkUserId: string;
};

export const onRequestGet: PagesFunction<Env, string, RequestData> = async (context) => {
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

export const onRequestPost: PagesFunction<Env, string, RequestData> = async (context) => {
  const userId = context.data.clerkUserId;
  const { DB } = context.env;

  let body;
  try {
    body = await parseGameResult(context.request);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    console.error(JSON.stringify({ message: 'Unexpected game result parsing error', errorType: error instanceof Error ? error.name : 'UnknownError' }));
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const existing = await DB.prepare(
      'SELECT current_daily_streak, longest_daily_streak, updated_at FROM user_stats WHERE clerk_user_id = ?'
    ).bind(userId).first<{ current_daily_streak: number; longest_daily_streak: number; updated_at: string }>();

    let newStreak = 1;
    let newLongest = 1;
    if (existing) {
      const lastDate = existing.updated_at.slice(0, 10);
      if (lastDate === today) newStreak = Math.max(1, existing.current_daily_streak);
      else if (lastDate === yesterday) newStreak = existing.current_daily_streak + 1;
      newLongest = Math.max(existing.longest_daily_streak, newStreak);
    }

    await DB.batch([
      DB.prepare(
        `INSERT INTO user_stats
         (clerk_user_id, total_games_completed, total_hints_used, total_score, current_daily_streak, longest_daily_streak)
         VALUES (?, 0, 0, 0, 0, 0)
         ON CONFLICT(clerk_user_id) DO NOTHING`,
      ).bind(userId),
      DB.prepare(
        `INSERT INTO game_results
         (clerk_user_id, mode, difficulty, solve_time_ms, hints_used, max_hint_depth, errors_made, score, completion_id, stats_counted)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
         ON CONFLICT(clerk_user_id, completion_id) DO NOTHING`,
      ).bind(userId, body.mode, body.difficulty, body.solveTimeMs, body.hintsUsed, body.maxHintDepth, body.errorsMade, body.score, body.completionId),
      DB.prepare(
        `UPDATE user_stats SET
           total_games_completed = total_games_completed + 1,
           total_hints_used = total_hints_used + ?,
           total_score = total_score + ?,
           current_daily_streak = ?,
           longest_daily_streak = ?,
           updated_at = CURRENT_TIMESTAMP
         WHERE clerk_user_id = ?
           AND EXISTS (
             SELECT 1 FROM game_results
             WHERE clerk_user_id = ? AND completion_id = ? AND stats_counted = 0
           )`,
      ).bind(body.hintsUsed, body.score, newStreak, newLongest, userId, userId, body.completionId),
      DB.prepare(
        `UPDATE game_results SET stats_counted = 1
         WHERE clerk_user_id = ? AND completion_id = ? AND stats_counted = 0`,
      ).bind(userId, body.completionId),
    ]);
  } catch (error) {
    console.error(JSON.stringify({ message: 'Failed to persist game result', errorType: error instanceof Error ? error.name : 'UnknownError' }));
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }

  return Response.json({ ok: true, score: body.score });
};
