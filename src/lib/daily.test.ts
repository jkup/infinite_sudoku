import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../engine/generator';
import {
  addDays, dailyDifficultyFor, dailyPayloadFromPuzzle, isDailyDate, puzzleFromDailyPayload,
  puzzleFromDailyRow, serializeDailyPuzzle, utcDateString, type DailyPuzzleRow,
} from './daily';

describe('daily dates', () => {
  it('accepts only real canonical YYYY-MM-DD dates', () => {
    expect(isDailyDate('2026-09-06')).toBe(true);
    expect(isDailyDate('2026-02-29')).toBe(false);
    expect(isDailyDate('2026-9-6')).toBe(false);
    expect(isDailyDate('2026-09-06T00:00:00Z')).toBe(false);
    expect(isDailyDate(20260906)).toBe(false);
  });

  it('uses the UTC calendar date, not local time', () => {
    expect(utcDateString(new Date('2026-09-06T23:59:59Z'))).toBe('2026-09-06');
    expect(utcDateString(new Date('2026-09-07T00:00:00Z'))).toBe('2026-09-07');
  });

  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('rotates difficulty by UTC weekday', () => {
    // 2026-09-06 is a Sunday.
    expect(dailyDifficultyFor('2026-09-06')).toBe('expert');
    expect(dailyDifficultyFor('2026-09-07')).toBe('easy');
    expect(dailyDifficultyFor('2026-09-08')).toBe('easy');
    expect(dailyDifficultyFor('2026-09-09')).toBe('medium');
    expect(dailyDifficultyFor('2026-09-10')).toBe('medium');
    expect(dailyDifficultyFor('2026-09-11')).toBe('hard');
    expect(dailyDifficultyFor('2026-09-12')).toBe('hard');
    expect(() => dailyDifficultyFor('not-a-date')).toThrow('Invalid daily date');
  });
});

describe('daily puzzle serialization', () => {
  function rowFor(puzzle: ReturnType<typeof generatePuzzle>, overrides: Partial<DailyPuzzleRow> = {}): DailyPuzzleRow {
    return {
      id: 7, date: '2026-09-06', mode: puzzle.mode, difficulty: puzzle.difficulty,
      ...serializeDailyPuzzle(puzzle), ...overrides,
    };
  }

  it('round-trips a classic puzzle through the database columns', () => {
    const puzzle = generatePuzzle('easy', 'classic');
    const row = rowFor(puzzle);
    expect(row.cage_data).toBeNull();
    const restored = puzzleFromDailyRow(row);
    expect(restored).toEqual({ ...puzzle, daily: { id: 7, date: '2026-09-06' } });
  });

  it('round-trips a killer puzzle including cages', () => {
    const puzzle = generatePuzzle('easy', 'killer');
    const restored = puzzleFromDailyRow(rowFor(puzzle));
    expect(restored?.cages).toEqual(puzzle.cages);
    expect(restored?.daily).toEqual({ id: 7, date: '2026-09-06' });
  });

  it('rejects malformed or inconsistent rows', () => {
    const puzzle = generatePuzzle('easy', 'classic');
    expect(puzzleFromDailyRow(rowFor(puzzle, { puzzle_data: '[]' }))).toBeNull();
    expect(puzzleFromDailyRow(rowFor(puzzle, { solution: 'not json' }))).toBeNull();
    expect(puzzleFromDailyRow(rowFor(puzzle, { mode: 'killer' }))).toBeNull();
    expect(puzzleFromDailyRow(rowFor(puzzle, { difficulty: 'impossible' }))).toBeNull();
    expect(puzzleFromDailyRow(rowFor(puzzle, { id: 0 }))).toBeNull();
    expect(puzzleFromDailyRow(rowFor(puzzle, { date: '2026-13-01' }))).toBeNull();
  });

  it('round-trips through the API payload', () => {
    const puzzle = generatePuzzle('easy', 'killer');
    const payload = JSON.parse(JSON.stringify(dailyPayloadFromPuzzle(puzzle, { id: 3, date: '2026-09-06' })));
    expect(puzzleFromDailyPayload(payload)).toEqual({ ...puzzle, daily: { id: 3, date: '2026-09-06' } });
    expect(puzzleFromDailyPayload({ ...payload, solution: [] })).toBeNull();
    expect(puzzleFromDailyPayload({ ...payload, id: 'x' })).toBeNull();
    expect(puzzleFromDailyPayload(null)).toBeNull();
  });
});
