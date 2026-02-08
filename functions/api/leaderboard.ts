// GET /api/leaderboard?date=YYYY-MM-DD&mode=classic

interface Env {
  DB: D1Database;
}

type RequestData = {
  clerkUserId: string;
};

export const onRequestGet: PagesFunction<Env, string, RequestData> = async (context) => {
  const { DB } = context.env;
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') || 'classic';

  if (!date) {
    return Response.json({ error: 'date parameter required' }, { status: 400 });
  }

  const results = await DB.prepare(
    `SELECT clerk_user_id, score, solve_time_ms, difficulty, completed_at
     FROM game_results
     WHERE is_daily = 1 AND daily_date = ? AND mode = ?
     ORDER BY score DESC
     LIMIT 100`
  )
    .bind(date, mode)
    .all();

  const entries = (results.results ?? []).map((row) => ({
    clerkUserId: row.clerk_user_id,
    score: row.score,
    solveTimeMs: row.solve_time_ms,
    difficulty: row.difficulty,
    completedAt: row.completed_at,
  }));

  return Response.json(entries);
};
