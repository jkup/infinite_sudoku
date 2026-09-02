import { env } from 'cloudflare:workers';
import { applyD1Migrations, createPagesEventContext } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getLeaderboard } from './leaderboard';
import { onRequestGet as getStats, onRequestPost as postStats } from './stats';

const userId = 'user_integration_test';
const completionId = 'c0ffee00-0000-4000-8000-000000000001';

type StatsGet = typeof getStats;
type StatsPost = typeof postStats;
type LeaderboardGet = typeof getLeaderboard;

function statsGetContext() {
  return createPagesEventContext<StatsGet>({
    request: new Request('https://infinitesudoku.com/api/stats') as never,
    params: {},
    data: { clerkUserId: userId },
  });
}

function statsPostContext(body: Record<string, unknown>) {
  return createPagesEventContext<StatsPost>({
    request: new Request('https://infinitesudoku.com/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }) as never,
    params: {},
    data: { clerkUserId: userId },
  });
}

function leaderboardContext(query = '?date=2026-09-02&mode=classic') {
  return createPagesEventContext<LeaderboardGet>({
    request: new Request(`https://infinitesudoku.com/api/leaderboard${query}`) as never,
    params: {},
    data: { clerkUserId: userId },
  });
}

async function clearDatabase() {
  await env.DB.batch([
    env.DB.prepare('DELETE FROM game_results'),
    env.DB.prepare('DELETE FROM daily_puzzles'),
    env.DB.prepare('DELETE FROM user_stats'),
  ]);
}

describe('Pages Functions with D1', () => {
  beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
  beforeEach(clearDatabase);

  it('returns zeroed stats for a new authenticated user', async () => {
    const response = await getStats(statsGetContext());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      totalGamesCompleted: 0,
      totalHintsUsed: 0,
      totalScore: 0,
      currentDailyStreak: 0,
      longestDailyStreak: 0,
    });
  });

  it('persists a completion and updates aggregate stats', async () => {
    const result = {
      completionId,
      mode: 'classic', difficulty: 'easy', solveTimeMs: 90_000,
      hintsUsed: 1, maxHintDepth: 0, errorsMade: 2,
    };
    const postResponse = await postStats(statsPostContext(result));
    expect(postResponse.status).toBe(200);
    expect(await postResponse.json()).toEqual({ ok: true, score: 770 });

    const statsResponse = await getStats(statsGetContext());
    expect(await statsResponse.json()).toEqual({
      totalGamesCompleted: 1,
      totalHintsUsed: 1,
      totalScore: 770,
      currentDailyStreak: 1,
      longestDailyStreak: 1,
    });

    const stored = await env.DB.prepare(
      'SELECT mode, difficulty, solve_time_ms, errors_made FROM game_results WHERE clerk_user_id = ?',
    ).bind(userId).first();
    expect(stored).toEqual(expect.objectContaining({
      mode: 'classic', difficulty: 'easy', solve_time_ms: 90_000, errors_made: 2,
    }));
  });

  it.each([
    ['unknown mode', { mode: 'cheat' }],
    ['unknown difficulty', { difficulty: 'impossible' }],
    ['negative time', { solveTimeMs: -1 }],
    ['fractional hints', { hintsUsed: 0.5 }],
    ['excessive hint depth', { maxHintDepth: 4 }],
    ['non-finite-compatible value', { errorsMade: 'NaN' }],
    ['client-authored score', { score: 999_999_999 }],
  ])('rejects %s', async (_case, override) => {
    const response = await postStats(statsPostContext({
      mode: 'classic', difficulty: 'easy', solveTimeMs: 90_000,
      hintsUsed: 0, maxHintDepth: 0, errorsMade: 0, completionId,
      ...override,
    }));
    expect(response.status).toBe(400);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_results').first('count')).toBe(0);
  });

  it('counts a retried completion exactly once', async () => {
    const result = {
      completionId,
      mode: 'classic', difficulty: 'easy', solveTimeMs: 90_000,
      hintsUsed: 1, maxHintDepth: 0, errorsMade: 0,
    };
    expect((await postStats(statsPostContext(result))).status).toBe(200);
    expect((await postStats(statsPostContext(result))).status).toBe(200);

    const stats = await (await getStats(statsGetContext())).json<{ totalGamesCompleted: number; totalHintsUsed: number; totalScore: number }>();
    expect(stats.totalGamesCompleted).toBe(1);
    expect(stats.totalHintsUsed).toBe(1);
    expect(stats.totalScore).toBe(870);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_results').first('count')).toBe(1);
  });

  it('counts concurrent duplicate completions exactly once', async () => {
    const result = {
      completionId,
      mode: 'killer', difficulty: 'medium', solveTimeMs: 120_000,
      hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
    };
    const responses = await Promise.all([
      postStats(statsPostContext(result)),
      postStats(statsPostContext(result)),
    ]);
    expect(responses.map(({ status }) => status)).toEqual([200, 200]);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_results').first('count')).toBe(1);
    expect(await env.DB.prepare('SELECT total_games_completed FROM user_stats WHERE clerk_user_id = ?').bind(userId).first('total_games_completed')).toBe(1);
  });

  it('rolls back all completion writes when a batch statement fails', async () => {
    await env.DB.prepare(`CREATE TRIGGER force_game_insert_failure
      BEFORE INSERT ON game_results BEGIN SELECT RAISE(ABORT, 'forced failure'); END`).run();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const response = await postStats(statsPostContext({
        completionId,
        mode: 'classic', difficulty: 'easy', solveTimeMs: 90_000,
        hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
      }));

      expect(response.status).toBe(500);
      expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM user_stats').first('count')).toBe(0);
      expect(errorSpy).toHaveBeenCalledOnce();
    } finally {
      errorSpy.mockRestore();
      await env.DB.prepare('DROP TRIGGER force_game_insert_failure').run();
    }
  });

  it('rejects unsupported content types', async () => {
    const context = createPagesEventContext<StatsPost>({
      request: new Request('https://infinitesudoku.com/api/stats', {
        method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' },
      }) as never,
      params: {},
      data: { clerkUserId: userId },
    });
    const response = await postStats(context);
    expect(response.status).toBe(415);
  });

  it('rejects malformed JSON', async () => {
    const context = createPagesEventContext<StatsPost>({
      request: new Request('https://infinitesudoku.com/api/stats', {
        method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' },
      }) as never,
      params: {},
      data: { clerkUserId: userId },
    });
    const response = await postStats(context);
    expect(response.status).toBe(400);
  });

  it('rejects request bodies larger than the configured limit', async () => {
    const context = createPagesEventContext<StatsPost>({
      request: new Request('https://infinitesudoku.com/api/stats', {
        method: 'POST',
        body: JSON.stringify({ padding: 'x'.repeat(17_000) }),
        headers: { 'Content-Type': 'application/json' },
      }) as never,
      params: {},
      data: { clerkUserId: userId },
    });
    const response = await postStats(context);
    expect(response.status).toBe(413);
  });

  it('requires a date for leaderboard queries', async () => {
    const response = await getLeaderboard(leaderboardContext(''));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'date parameter required' });
  });

  it('returns ranked daily results for the requested mode only', async () => {
    await env.DB.prepare(
      `INSERT INTO user_stats (clerk_user_id) VALUES (?), (?)`,
    ).bind('user_one', 'user_two').run();
    await env.DB.prepare(
      `INSERT INTO game_results
       (clerk_user_id, mode, difficulty, solve_time_ms, score, is_daily, daily_date)
       VALUES (?, 'classic', 'easy', 60000, 800, 1, '2026-09-02'),
              (?, 'classic', 'hard', 120000, 1200, 1, '2026-09-02'),
              (?, 'killer', 'easy', 70000, 5000, 1, '2026-09-02')`,
    ).bind('user_one', 'user_two', 'user_one').run();

    const response = await getLeaderboard(leaderboardContext());
    const entries = await response.json<Array<{ clerkUserId: string; score: number }>>();
    expect(entries).toHaveLength(2);
    expect(entries.map((entry) => entry.score)).toEqual([1200, 800]);
    expect(entries.map((entry) => entry.clerkUserId)).toEqual(['user_two', 'user_one']);
  });
});
