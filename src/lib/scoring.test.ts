import { describe, expect, it } from 'vitest';
import { calculateScore, scoreBreakdown } from './scoring';

describe('calculateScore', () => {
  it('awards the base score at or below par', () => {
    expect(calculateScore({ difficulty: 'medium', mode: 'classic', solveTimeMs: 180_000, hintsUsed: 0, errorsMade: 0 })).toBe(3000);
  });

  it('applies time, hint, error, difficulty, and mode adjustments', () => {
    expect(calculateScore({ difficulty: 'hard', mode: 'killer', solveTimeMs: 500_000, hintsUsed: 2, errorsMade: 3 })).toBe(11_630);
  });

  it('never drops below ten percent of base score', () => {
    expect(calculateScore({ difficulty: 'easy', mode: 'classic', solveTimeMs: 99_000_000, hintsUsed: 999, errorsMade: 999 })).toBe(100);
  });
});

describe('scoreBreakdown', () => {
  it('itemises each penalty and matches calculateScore', () => {
    const input = { difficulty: 'hard', mode: 'killer', solveTimeMs: 500_000, hintsUsed: 2, errorsMade: 3 } as const;
    expect(scoreBreakdown(input)).toEqual({
      base: 12_000,
      parTimeMs: 480_000,
      timePenalty: 20,
      hintPenalty: 200,
      errorPenalty: 150,
      minimum: 1200,
      floored: false,
      score: calculateScore(input),
    });
  });

  it('reports zero penalties for a clean solve under par', () => {
    const breakdown = scoreBreakdown({ difficulty: 'easy', mode: 'classic', solveTimeMs: 30_000, hintsUsed: 0, errorsMade: 0 });
    expect(breakdown.timePenalty).toBe(0);
    expect(breakdown.hintPenalty).toBe(0);
    expect(breakdown.errorPenalty).toBe(0);
    expect(breakdown.score).toBe(breakdown.base);
  });

  it('flags when the minimum floor is applied', () => {
    const breakdown = scoreBreakdown({ difficulty: 'easy', mode: 'classic', solveTimeMs: 99_000_000, hintsUsed: 999, errorsMade: 999 });
    expect(breakdown.floored).toBe(true);
    expect(breakdown.score).toBe(breakdown.minimum);
  });
});
