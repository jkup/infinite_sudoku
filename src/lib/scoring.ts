import type { Difficulty, GameMode } from '../engine/types';

const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 8,
  expert: 16,
};

const MODE_MULTIPLIER: Record<GameMode, number> = {
  classic: 1,
  killer: 1.5,
};

export type ScoreInput = {
  difficulty: Difficulty;
  mode: GameMode;
  solveTimeMs: number;
  hintsUsed: number;
  errorsMade: number;
};

export type ScoreBreakdown = {
  /** 1000 × difficulty × mode multipliers */
  base: number;
  /** Solve time at or below this earns no time penalty */
  parTimeMs: number;
  timePenalty: number;
  hintPenalty: number;
  errorPenalty: number;
  /** Score floor (10% of base) */
  minimum: number;
  /** True when penalties pushed the raw score below the floor */
  floored: boolean;
  score: number;
};

/**
 * Break down the score for a completed puzzle.
 *
 * Base = 1000 × difficulty × mode
 * Time penalty: lose 1 point per second after a par time (par = 60s × difficulty multiplier)
 * Hint penalty: −100 per hint used
 * Error penalty: −50 per error
 *
 * Minimum score is 10% of the base.
 */
export function scoreBreakdown(params: ScoreInput): ScoreBreakdown {
  const { difficulty, mode, solveTimeMs, hintsUsed, errorsMade } = params;

  const diffMult = DIFFICULTY_MULTIPLIER[difficulty];
  const modeMult = MODE_MULTIPLIER[mode];
  const base = 1000 * diffMult * modeMult;

  // Par time scales with difficulty
  const parTimeMs = 60_000 * diffMult;
  const overTimeMs = Math.max(0, solveTimeMs - parTimeMs);
  const timePenalty = Math.floor(overTimeMs / 1000);

  const hintPenalty = hintsUsed * 100;
  const errorPenalty = errorsMade * 50;

  const raw = Math.round(base - timePenalty - hintPenalty - errorPenalty);
  const minimum = Math.floor(base * 0.1);
  const floored = raw < minimum;

  return {
    base, parTimeMs, timePenalty, hintPenalty, errorPenalty, minimum, floored,
    score: floored ? minimum : raw,
  };
}

/** Calculate the final score for a completed puzzle. See {@link scoreBreakdown}. */
export function calculateScore(params: ScoreInput): number {
  return scoreBreakdown(params).score;
}
