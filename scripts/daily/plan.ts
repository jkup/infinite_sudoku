import type { Difficulty, GameMode, Puzzle } from '../../src/engine/types';
import { DifficultyUnreachableError, generateMatching } from '../../src/engine/difficultyRetry';
import { DAILY_MODES, addDays, dailyDifficultyFor, isDailyDate, serializeDailyPuzzle } from '../../src/lib/daily';

/** One canonical puzzle that should exist. */
export type DailyPlanEntry = {
  date: string;
  mode: GameMode;
  difficulty: Difficulty;
};

/** Every (date, mode) pair for `days` consecutive UTC dates starting at `from`. */
export function planDailies(from: string, days: number): DailyPlanEntry[] {
  if (!isDailyDate(from)) throw new Error(`Invalid start date: ${from}`);
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error(`Invalid day count: ${days}`);
  const entries: DailyPlanEntry[] = [];
  for (let offset = 0; offset < days; offset++) {
    const date = addDays(from, offset);
    const difficulty = dailyDifficultyFor(date);
    for (const mode of DAILY_MODES) entries.push({ date, mode, difficulty });
  }
  return entries;
}

/** Plan entries that have no stored row yet. */
export function missingDailies(plan: DailyPlanEntry[], existing: Array<{ date: string; mode: string }>): DailyPlanEntry[] {
  const present = new Set(existing.map((row) => `${row.date}|${row.mode}`));
  return plan.filter((entry) => !present.has(`${entry.date}|${entry.mode}`));
}

/**
 * Generate a puzzle whose classified difficulty matches the plan exactly, using
 * the engine's shared retry policy, and name the date if it never matches so a
 * failed pipeline run says which daily is missing.
 */
export function generateForPlan(
  entry: DailyPlanEntry,
  generate: (difficulty: Difficulty, mode: GameMode) => Puzzle,
  attempts = 5,
  onRetry?: (attempt: number, got: Difficulty) => void,
): Puzzle {
  try {
    return generateMatching(entry.difficulty, entry.mode, generate, { attempts, onMiss: onRetry });
  } catch (error) {
    if (error instanceof DifficultyUnreachableError) {
      throw new Error(`Could not generate a ${entry.difficulty} ${entry.mode} puzzle for ${entry.date} after ${attempts} attempts`, { cause: error });
    }
    throw error;
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** SQL that lists stored dailies in an inclusive date range. */
export function existingDailiesSql(from: string, to: string): string {
  if (!isDailyDate(from) || !isDailyDate(to)) throw new Error('Invalid date range');
  return `SELECT date, mode FROM daily_puzzles WHERE date BETWEEN ${sqlString(from)} AND ${sqlString(to)};`;
}

/** Idempotent insert for one canonical puzzle; a concurrent run loses harmlessly. */
export function dailyInsertSql(entry: DailyPlanEntry, puzzle: Puzzle): string {
  if (puzzle.mode !== entry.mode || puzzle.difficulty !== entry.difficulty) {
    throw new Error(`Puzzle ${puzzle.mode}/${puzzle.difficulty} does not match plan ${entry.mode}/${entry.difficulty}`);
  }
  const columns = serializeDailyPuzzle(puzzle);
  const cageData = columns.cage_data === null ? 'NULL' : sqlString(columns.cage_data);
  return [
    'INSERT INTO daily_puzzles (date, mode, difficulty, puzzle_data, cage_data, solution)',
    `VALUES (${sqlString(entry.date)}, ${sqlString(entry.mode)}, ${sqlString(entry.difficulty)}, ${sqlString(columns.puzzle_data)}, ${cageData}, ${sqlString(columns.solution)})`,
    'ON CONFLICT(date, mode) DO NOTHING;',
  ].join('\n');
}

/**
 * Extract result rows from `wrangler d1 execute --json` output. Wrangler prints
 * an array with one entry per statement; each carries a `results` array.
 */
export function parseD1Rows<T = Record<string, unknown>>(output: string): T[] {
  const start = output.indexOf('[');
  if (start < 0) throw new Error('Unexpected wrangler output: no JSON found');
  const parsed: unknown = JSON.parse(output.slice(start));
  if (!Array.isArray(parsed)) throw new Error('Unexpected wrangler output: not an array');
  return parsed.flatMap((statement) => {
    if (!statement || typeof statement !== 'object') return [];
    const results = (statement as { results?: unknown }).results;
    return Array.isArray(results) ? (results as T[]) : [];
  });
}
