import { describe, expect, it, vi } from 'vitest';
import { generatePuzzle } from '../../src/engine/generator';
import { dailyInsertSql, existingDailiesSql, generateForPlan, missingDailies, parseD1Rows, planDailies } from './plan';

describe('generateForPlan', () => {
  const entry = { date: '2026-09-11', mode: 'classic', difficulty: 'hard' } as const;
  const puzzleOf = (difficulty: 'easy' | 'hard') => ({ ...generatePuzzle('easy', 'classic'), difficulty });

  it('retries when the engine falls back to a different difficulty', () => {
    const generate = vi.fn().mockReturnValueOnce(puzzleOf('easy')).mockReturnValueOnce(puzzleOf('hard'));
    const onRetry = vi.fn();
    expect(generateForPlan(entry, generate, 3, onRetry).difficulty).toBe('hard');
    expect(generate).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 'easy');
  });

  it('fails loudly instead of storing a mislabeled puzzle', () => {
    const generate = vi.fn().mockReturnValue(puzzleOf('easy'));
    expect(() => generateForPlan(entry, generate, 2)).toThrow('Could not generate a hard classic puzzle for 2026-09-11 after 2 attempts');
  });
});

describe('planDailies', () => {
  it('lists both modes for each date with the rotation difficulty', () => {
    // 2026-09-06 is a Sunday.
    expect(planDailies('2026-09-06', 2)).toEqual([
      { date: '2026-09-06', mode: 'classic', difficulty: 'expert' },
      { date: '2026-09-06', mode: 'killer', difficulty: 'expert' },
      { date: '2026-09-07', mode: 'classic', difficulty: 'easy' },
      { date: '2026-09-07', mode: 'killer', difficulty: 'easy' },
    ]);
  });

  it('rejects bad input', () => {
    expect(() => planDailies('yesterday', 1)).toThrow('Invalid start date');
    expect(() => planDailies('2026-09-06', 0)).toThrow('Invalid day count');
  });
});

describe('missingDailies', () => {
  it('drops entries that already exist', () => {
    const plan = planDailies('2026-09-06', 1);
    const missing = missingDailies(plan, [{ date: '2026-09-06', mode: 'classic' }]);
    expect(missing).toEqual([{ date: '2026-09-06', mode: 'killer', difficulty: 'expert' }]);
  });
});

describe('SQL generation', () => {
  it('builds a bounded range query', () => {
    expect(existingDailiesSql('2026-09-06', '2026-09-12'))
      .toBe("SELECT date, mode FROM daily_puzzles WHERE date BETWEEN '2026-09-06' AND '2026-09-12';");
    expect(() => existingDailiesSql("2026-09-06'; DROP TABLE daily_puzzles; --", '2026-09-12')).toThrow();
  });

  it('builds an idempotent insert with cages only for killer', () => {
    const classic = generatePuzzle('easy', 'classic');
    const classicSql = dailyInsertSql({ date: '2026-09-07', mode: 'classic', difficulty: 'easy' }, classic);
    expect(classicSql).toContain("VALUES ('2026-09-07', 'classic', 'easy', '[[");
    expect(classicSql).toContain(', NULL, ');
    expect(classicSql).toContain('ON CONFLICT(date, mode) DO NOTHING;');

    const killer = generatePuzzle('easy', 'killer');
    const killerSql = dailyInsertSql({ date: '2026-09-07', mode: 'killer', difficulty: 'easy' }, killer);
    expect(killerSql).toContain('[{"sum":');
  });

  it('refuses a puzzle that does not match its plan entry', () => {
    const puzzle = generatePuzzle('easy', 'classic');
    expect(() => dailyInsertSql({ date: '2026-09-07', mode: 'killer', difficulty: 'easy' }, puzzle)).toThrow('does not match');
  });
});

describe('parseD1Rows', () => {
  it('flattens results across statements and tolerates a leading banner', () => {
    const output = `🌀 Executing on remote database DB\n[{"results":[{"date":"2026-09-06","mode":"classic"}],"success":true},{"results":[],"success":true}]`;
    expect(parseD1Rows(output)).toEqual([{ date: '2026-09-06', mode: 'classic' }]);
  });

  it('fails loudly on unexpected output', () => {
    expect(() => parseD1Rows('nothing here')).toThrow('no JSON');
    expect(() => parseD1Rows('{"results":[]}')).toThrow();
  });
});
