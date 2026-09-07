import type { Difficulty, GameMode, Puzzle } from './types';

/**
 * generatePuzzle() is honest but not strict: when it cannot hit the requested
 * difficulty within its own attempt budget it returns an easier puzzle labeled
 * with its real difficulty. Callers that promised the player a difficulty must
 * check the label and try again. This module is that single policy, shared by
 * the app's worker wrapper and the daily-puzzle pipeline.
 */

/** Outer attempts per request; each may cost the generator's full inner budget. */
export const DEFAULT_DIFFICULTY_ATTEMPTS = 4;

export class DifficultyUnreachableError extends Error {
  readonly difficulty: Difficulty;
  readonly mode: GameMode;
  readonly attempts: number;

  constructor(difficulty: Difficulty, mode: GameMode, attempts: number) {
    super(`Couldn't generate a ${difficulty} ${mode} puzzle after ${attempts} attempts`);
    this.name = 'DifficultyUnreachableError';
    this.difficulty = difficulty;
    this.mode = mode;
    this.attempts = attempts;
  }
}

export type MissHandler = (attempt: number, produced: Difficulty) => void;

type Options = { attempts?: number; onMiss?: MissHandler };

function matches(puzzle: Puzzle, difficulty: Difficulty, mode: GameMode): boolean {
  return puzzle.difficulty === difficulty && puzzle.mode === mode;
}

function validAttempts(attempts: number): number {
  if (!Number.isInteger(attempts) || attempts < 1) throw new Error(`Invalid attempt count: ${attempts}`);
  return attempts;
}

/** Synchronous variant for Node scripts and tests. */
export function generateMatching(
  difficulty: Difficulty,
  mode: GameMode,
  generate: (difficulty: Difficulty, mode: GameMode) => Puzzle,
  { attempts = DEFAULT_DIFFICULTY_ATTEMPTS, onMiss }: Options = {},
): Puzzle {
  const total = validAttempts(attempts);
  for (let attempt = 1; attempt <= total; attempt++) {
    const puzzle = generate(difficulty, mode);
    if (matches(puzzle, difficulty, mode)) return puzzle;
    onMiss?.(attempt, puzzle.difficulty);
  }
  throw new DifficultyUnreachableError(difficulty, mode, total);
}

/** Asynchronous variant for the Web Worker wrapper. Generator failures propagate immediately. */
export async function generateMatchingAsync(
  difficulty: Difficulty,
  mode: GameMode,
  generate: (difficulty: Difficulty, mode: GameMode) => Promise<Puzzle>,
  { attempts = DEFAULT_DIFFICULTY_ATTEMPTS, onMiss }: Options = {},
): Promise<Puzzle> {
  const total = validAttempts(attempts);
  for (let attempt = 1; attempt <= total; attempt++) {
    const puzzle = await generate(difficulty, mode);
    if (matches(puzzle, difficulty, mode)) return puzzle;
    onMiss?.(attempt, puzzle.difficulty);
  }
  throw new DifficultyUnreachableError(difficulty, mode, total);
}
