import { env } from 'cloudflare:workers';
import { applyD1Migrations, createPagesEventContext } from 'cloudflare:test';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as getDaily } from './daily';
import { generatePuzzle } from '../../src/engine/generator';
import { addDays, serializeDailyPuzzle, utcDateString } from '../../src/lib/daily';
import type { GameMode } from '../../src/engine/types';

type DailyGet = typeof getDaily;

function dailyContext(query: string) {
  return createPagesEventContext<DailyGet>({
    request: new Request(`https://infinitesudoku.com/api/daily${query}`) as never,
    params: {},
    data: {},
  });
}

async function insertDaily(date: string, mode: GameMode, difficulty: 'easy' | 'medium' = 'easy'): Promise<number> {
  const puzzle = generatePuzzle(difficulty, mode);
  const columns = serializeDailyPuzzle(puzzle);
  const id = await env.DB.prepare(
    `INSERT INTO daily_puzzles (date, mode, difficulty, puzzle_data, cage_data, solution)
     VALUES (?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(date, mode, difficulty, columns.puzzle_data, columns.cage_data, columns.solution).first<number>('id');
  return id!;
}

describe('GET /api/daily', () => {
  beforeAll(() => applyD1Migrations(env.DB, env.TEST_MIGRATIONS));
  beforeEach(() => env.DB.prepare('DELETE FROM daily_puzzles').run());
  afterEach(() => vi.restoreAllMocks());

  it("serves today's puzzle for the requested mode", async () => {
    const today = utcDateString();
    const classicId = await insertDaily(today, 'classic');
    const killerId = await insertDaily(today, 'killer');

    const classic = await (await getDaily(dailyContext(''))).json<Record<string, unknown>>();
    expect(classic).toEqual(expect.objectContaining({ id: classicId, date: today, mode: 'classic', difficulty: 'easy', gridSize: 9 }));
    expect(classic.cages).toBeUndefined();
    expect(classic.initial).toHaveLength(9);
    expect(classic.solution).toHaveLength(9);

    const killer = await (await getDaily(dailyContext('?mode=killer'))).json<Record<string, unknown>>();
    expect(killer).toEqual(expect.objectContaining({ id: killerId, mode: 'killer' }));
    expect(Array.isArray(killer.cages)).toBe(true);
  });

  it('serves an explicit past date', async () => {
    const id = await insertDaily('2026-01-05', 'classic');
    const response = await getDaily(dailyContext('?mode=classic&date=2026-01-05'));
    expect(response.status).toBe(200);
    expect((await response.json<{ id: number }>()).id).toBe(id);
  });

  it('returns 404 when no puzzle exists for the date', async () => {
    const response = await getDaily(dailyContext('?mode=classic&date=2026-01-06'));
    expect(response.status).toBe(404);
    expect(response.headers.get('X-Error-Category')).toBe('validation');
  });

  it('never serves a future date, even when a row exists', async () => {
    const tomorrow = addDays(utcDateString(), 1);
    await insertDaily(tomorrow, 'classic');
    const response = await getDaily(dailyContext(`?mode=classic&date=${tomorrow}`));
    expect(response.status).toBe(404);
  });

  it.each([
    ['an unknown mode', '?mode=cheat'],
    ['a malformed date', '?mode=classic&date=2026-9-6'],
    ['an impossible date', '?mode=classic&date=2026-02-30'],
  ])('rejects %s', async (_case, query) => {
    const response = await getDaily(dailyContext(query));
    expect(response.status).toBe(400);
  });

  it('fails safely when a stored row is corrupt', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await env.DB.prepare(
      `INSERT INTO daily_puzzles (date, mode, difficulty, puzzle_data, solution)
       VALUES ('2026-01-07', 'classic', 'easy', '[]', '[]')`,
    ).run();
    const response = await getDaily(dailyContext('?mode=classic&date=2026-01-07'));
    expect(response.status).toBe(500);
    expect(response.headers.get('X-Error-Category')).toBe('database');
    expect(errorSpy).toHaveBeenCalledOnce();
  });
});
