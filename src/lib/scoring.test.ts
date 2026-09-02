import { describe, expect, it } from 'vitest';
import { calculateScore } from './scoring';

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
