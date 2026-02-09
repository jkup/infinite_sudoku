// GET /api/stats — fetch user stats
// POST /api/stats — save game result and update user stats

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

  const body = await context.request.json<{
    mode: string;
    difficulty: string;
    solveTimeMs: number;
    hintsUsed: number;
    maxHintDepth: number;
    errorsMade: number;
    score: number;
  }>();

  // Upsert user_stats first (game_results has a FK referencing this table)
  await DB.prepare(
    `INSERT INTO user_stats (clerk_user_id, total_games_completed, total_hints_used, total_score)
     VALUES (?, 1, ?, ?)
     ON CONFLICT(clerk_user_id) DO UPDATE SET
       total_games_completed = total_games_completed + 1,
       total_hints_used = total_hints_used + excluded.total_hints_used,
       total_score = total_score + excluded.total_score,
       updated_at = CURRENT_TIMESTAMP`
  )
    .bind(userId, body.hintsUsed, body.score)
    .run();

  // Insert game result (user_stats row now guaranteed to exist)
  await DB.prepare(
    `INSERT INTO game_results (clerk_user_id, mode, difficulty, solve_time_ms, hints_used, max_hint_depth, errors_made, score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      body.mode,
      body.difficulty,
      body.solveTimeMs,
      body.hintsUsed,
      body.maxHintDepth,
      body.errorsMade,
      body.score
    )
    .run();

  return Response.json({ ok: true });
};
