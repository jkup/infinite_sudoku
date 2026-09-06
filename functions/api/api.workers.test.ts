import { env } from 'cloudflare:workers';
import { applyD1Migrations, createPagesEventContext } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchDisplayName } = vi.hoisted(() => ({ fetchDisplayName: vi.fn() }));
vi.mock('../lib/displayName', () => ({ fetchDisplayName }));

import { onRequestGet as getLeaderboard, type LeaderboardResponse } from './leaderboard';
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
  beforeEach(async () => {
    fetchDisplayName.mockReset().mockResolvedValue(null);
    await clearDatabase();
  });

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

  it('applies database constraints from the ordered migration history', async () => {
    await expect(env.DB.prepare(
      `INSERT INTO game_results
       (clerk_user_id, mode, difficulty, solve_time_ms, score, completion_id)
       VALUES (?, 'invalid', 'easy', 1000, 10, ?)`,
    ).bind(userId, crypto.randomUUID()).run()).rejects.toThrow('invalid game result');

    const index = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_game_results_daily_ranking'",
    ).first('name');
    expect(index).toBe('idx_game_results_daily_ranking');
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
      currentDailyStreak: 0,
      longestDailyStreak: 0,
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
    ['invalid daily puzzle ID', { dailyPuzzleId: 0 }],
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

  it('uses canonical UTC puzzle dates for daily streaks without same-day inflation', async () => {
    const dailyIds: number[] = [];
    for (const [date, mode] of [
      ['2026-12-31', 'classic'],
      ['2026-12-31', 'killer'],
      ['2027-01-01', 'classic'],
      ['2027-01-03', 'classic'],
    ] as const) {
      const result = await env.DB.prepare(
        `INSERT INTO daily_puzzles (date, mode, difficulty, puzzle_data, solution)
         VALUES (?, ?, 'easy', '[]', '[]') RETURNING id`,
      ).bind(date, mode).first<number>('id');
      dailyIds.push(result!);
    }

    const submitDaily = (dailyPuzzleId: number, mode: 'classic' | 'killer', suffix: string) =>
      postStats(statsPostContext({
        completionId: `c0ffee00-0000-4000-8000-0000000000${suffix}`,
        mode, difficulty: 'easy', solveTimeMs: 60_000,
        hintsUsed: 0, maxHintDepth: 0, errorsMade: 0, dailyPuzzleId,
      }));

    const sameDayResponses = await Promise.all([
      submitDaily(dailyIds[0], 'classic', '10'),
      submitDaily(dailyIds[1], 'killer', '11'),
    ]);
    expect(sameDayResponses.map(({ status }) => status)).toEqual([200, 200]);
    let stats = await (await getStats(statsGetContext())).json<{ currentDailyStreak: number; longestDailyStreak: number }>();
    expect(stats).toEqual(expect.objectContaining({ currentDailyStreak: 1, longestDailyStreak: 1 }));

    expect((await submitDaily(dailyIds[2], 'classic', '12')).status).toBe(200);
    stats = await (await getStats(statsGetContext())).json();
    expect(stats).toEqual(expect.objectContaining({ currentDailyStreak: 2, longestDailyStreak: 2 }));

    // A different completion ID for the same canonical puzzle is a successful no-op.
    expect((await submitDaily(dailyIds[2], 'classic', '13')).status).toBe(200);
    expect((await submitDaily(dailyIds[3], 'classic', '14')).status).toBe(200);
    stats = await (await getStats(statsGetContext())).json();
    expect(stats).toEqual(expect.objectContaining({ currentDailyStreak: 1, longestDailyStreak: 2 }));
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_results WHERE is_daily = 1').first('count')).toBe(4);
  });

  it('rejects a daily identity whose canonical puzzle does not match the result', async () => {
    const dailyPuzzleId = await env.DB.prepare(
      `INSERT INTO daily_puzzles (date, mode, difficulty, puzzle_data, solution)
       VALUES ('2026-09-03', 'classic', 'hard', '[]', '[]') RETURNING id`,
    ).first<number>('id');
    const response = await postStats(statsPostContext({
      completionId, dailyPuzzleId, mode: 'killer', difficulty: 'hard', solveTimeMs: 60_000,
      hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
    }));
    expect(response.status).toBe(400);
    expect(await env.DB.prepare('SELECT COUNT(*) AS count FROM game_results').first('count')).toBe(0);
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

  it('caches the Clerk display name on completion and keeps it when a lookup fails', async () => {
    const result = {
      completionId, mode: 'classic', difficulty: 'easy', solveTimeMs: 90_000,
      hintsUsed: 0, maxHintDepth: 0, errorsMade: 0,
    };
    fetchDisplayName.mockResolvedValueOnce('Ada L.');
    expect((await postStats(statsPostContext(result))).status).toBe(200);
    expect(fetchDisplayName).toHaveBeenCalledWith(expect.anything(), userId);
    const name = () => env.DB.prepare('SELECT display_name FROM user_stats WHERE clerk_user_id = ?').bind(userId).first('display_name');
    expect(await name()).toBe('Ada L.');

    fetchDisplayName.mockResolvedValueOnce(null);
    expect((await postStats(statsPostContext({ ...result, completionId: 'c0ffee00-0000-4000-8000-000000000002' }))).status).toBe(200);
    expect(await name()).toBe('Ada L.');
  });

  it.each([
    ['a missing date', '', 'date parameter required'],
    ['a malformed date', '?date=2026-9-2&mode=classic', 'Invalid date'],
    ['an unknown mode', '?date=2026-09-02&mode=cheat', 'Invalid mode'],
  ])('rejects leaderboard queries with %s', async (_case, query, error) => {
    const response = await getLeaderboard(leaderboardContext(query));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error });
  });

  it('returns ranked, named daily results for the requested mode without exposing user IDs', async () => {
    await env.DB.prepare(
      `INSERT INTO user_stats (clerk_user_id, display_name) VALUES (?, 'One'), (?, NULL), (?, 'Me')`,
    ).bind('user_one', 'user_two', userId).run();
    await env.DB.prepare(
      `INSERT INTO game_results
       (clerk_user_id, mode, difficulty, solve_time_ms, score, is_daily, daily_date, completion_id, daily_puzzle_id, completed_at)
       VALUES (?, 'classic', 'easy', 60000, 800, 1, '2026-09-02', ?, 101, '2026-09-02 10:00:00'),
              (?, 'classic', 'hard', 120000, 1200, 1, '2026-09-02', ?, 102, '2026-09-02 11:00:00'),
              (?, 'classic', 'easy', 50000, 800, 1, '2026-09-02', ?, 103, '2026-09-02 12:00:00'),
              (?, 'killer', 'easy', 70000, 5000, 1, '2026-09-02', ?, 104, '2026-09-02 09:00:00')`,
    ).bind(
      'user_one', crypto.randomUUID(), 'user_two', crypto.randomUUID(),
      userId, crypto.randomUUID(), 'user_one', crypto.randomUUID(),
    ).run();

    const body = await (await getLeaderboard(leaderboardContext())).json<LeaderboardResponse>();
    expect(body.date).toBe('2026-09-02');
    expect(body.mode).toBe('classic');
    expect(body.totalEntries).toBe(3);
    expect(body.entries.map((entry) => [entry.rank, entry.displayName, entry.score, entry.isYou])).toEqual([
      [1, null, 1200, false],
      [2, 'One', 800, false], // ties break on earliest completion
      [3, 'Me', 800, true],
    ]);
    expect(body.you).toEqual({ rank: 3, score: 800, solveTimeMs: 50_000 });
    expect(JSON.stringify(body)).not.toContain('user_');
  });

  it('reports the caller as absent when they have no result for that daily', async () => {
    const body = await (await getLeaderboard(leaderboardContext())).json<LeaderboardResponse>();
    expect(body).toEqual({ date: '2026-09-02', mode: 'classic', entries: [], you: null, totalEntries: 0 });
  });
});
