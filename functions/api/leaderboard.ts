// GET /api/leaderboard?date=YYYY-MM-DD&mode=classic — ranked results for one daily puzzle.
// Entries carry cached display names only; Clerk user IDs never leave the server.

import type { GameMode } from '../../src/engine/types';
import { DAILY_MODES, isDailyDate } from '../../src/lib/daily';

const LIMIT = 50;

type RequestData = {
  clerkUserId: string;
};

type RankedRow = {
  clerk_user_id: string;
  display_name: string | null;
  score: number;
  solve_time_ms: number;
  difficulty: string;
  completed_at: string;
};

export type LeaderboardEntry = {
  rank: number;
  displayName: string | null;
  score: number;
  solveTimeMs: number;
  difficulty: string;
  completedAt: string;
  isYou: boolean;
};

export type LeaderboardResponse = {
  date: string;
  mode: GameMode;
  entries: LeaderboardEntry[];
  /** The caller's own standing, present even when outside the listed entries. */
  you: { rank: number; score: number; solveTimeMs: number } | null;
  totalEntries: number;
};

function validationError(message: string): Response {
  return Response.json({ error: message }, { status: 400, headers: { 'X-Error-Category': 'validation' } });
}

export const onRequestGet: PagesFunction<Cloudflare.Env, string, RequestData> = async (context) => {
  const { DB } = context.env;
  const userId = context.data.clerkUserId;
  const url = new URL(context.request.url);
  const date = url.searchParams.get('date');
  const mode = url.searchParams.get('mode') ?? 'classic';

  if (!date) return validationError('date parameter required');
  if (!isDailyDate(date)) return validationError('Invalid date');
  if (!DAILY_MODES.includes(mode as GameMode)) return validationError('Invalid mode');

  // Rank by score, then earliest finish; matches idx_game_results_daily_ranking.
  const ranking = `FROM game_results r
     LEFT JOIN user_stats u ON u.clerk_user_id = r.clerk_user_id
     WHERE r.is_daily = 1 AND r.daily_date = ?1 AND r.mode = ?2
     ORDER BY r.score DESC, r.completed_at ASC, r.id ASC`;

  const [top, total, ownRank] = await DB.batch([
    DB.prepare(
      `SELECT r.clerk_user_id, u.display_name, r.score, r.solve_time_ms, r.difficulty, r.completed_at
       ${ranking} LIMIT ${LIMIT}`,
    ).bind(date, mode),
    DB.prepare('SELECT COUNT(*) AS count FROM game_results r WHERE r.is_daily = 1 AND r.daily_date = ?1 AND r.mode = ?2')
      .bind(date, mode),
    DB.prepare(
      `WITH ranked AS (SELECT r.clerk_user_id, r.score, r.solve_time_ms,
         ROW_NUMBER() OVER (ORDER BY r.score DESC, r.completed_at ASC, r.id ASC) AS rank
       FROM game_results r WHERE r.is_daily = 1 AND r.daily_date = ?1 AND r.mode = ?2)
       SELECT rank, score, solve_time_ms FROM ranked WHERE clerk_user_id = ?3`,
    ).bind(date, mode, userId),
  ]);

  const rows = (top.results ?? []) as RankedRow[];
  const entries: LeaderboardEntry[] = rows.map((row, index) => ({
    rank: index + 1,
    displayName: row.display_name,
    score: row.score,
    solveTimeMs: row.solve_time_ms,
    difficulty: row.difficulty,
    completedAt: row.completed_at,
    isYou: row.clerk_user_id === userId,
  }));

  const own = (ownRank.results?.[0] ?? null) as { rank: number; score: number; solve_time_ms: number } | null;
  const body: LeaderboardResponse = {
    date,
    mode: mode as GameMode,
    entries,
    you: own ? { rank: own.rank, score: own.score, solveTimeMs: own.solve_time_ms } : null,
    totalEntries: Number((total.results?.[0] as { count?: number } | undefined)?.count ?? 0),
  };
  return Response.json(body);
};
