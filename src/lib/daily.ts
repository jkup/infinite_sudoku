import type { Cage, DailyPuzzleRef, Difficulty, Digit, GameMode, Puzzle } from '../engine/types';
import { isPuzzleDefinitionValid } from '../engine/validator';

/**
 * Daily puzzle model shared by the client, the Pages Function, and the
 * generation script. Pure TypeScript with no runtime dependencies.
 * Rules live in docs/DAILY_RULES.md.
 */

export const DAILY_MODES: readonly GameMode[] = ['classic', 'killer'];

/** Weekday difficulty rotation, indexed by UTC day (0 = Sunday). */
const DIFFICULTY_BY_UTC_DAY: readonly Difficulty[] = [
  'expert', // Sunday
  'easy',   // Monday
  'easy',   // Tuesday
  'medium', // Wednesday
  'medium', // Thursday
  'hard',   // Friday
  'hard',   // Saturday
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True for a real calendar date in canonical YYYY-MM-DD form. */
export function isDailyDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** True for a well-formed daily identity (positive integer id, canonical date). */
export function isDailyPuzzleRef(value: unknown): value is DailyPuzzleRef {
  if (!value || typeof value !== 'object') return false;
  const ref = value as Partial<DailyPuzzleRef>;
  return Number.isInteger(ref.id) && ref.id! >= 1 && isDailyDate(ref.date);
}

/** The canonical UTC date string for an instant. */
export function utcDateString(instant: Date = new Date()): string {
  return instant.toISOString().slice(0, 10);
}

/** Add whole days to a canonical date string. */
export function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return utcDateString(parsed);
}

/** Human-readable canonical date, e.g. "Monday, September 7", interpreted in UTC. */
export function formatDailyDate(date: string, locale?: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(locale, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
}

/** Difficulty for a date under the weekday rotation. */
export function dailyDifficultyFor(date: string): Difficulty {
  if (!isDailyDate(date)) throw new Error(`Invalid daily date: ${date}`);
  return DIFFICULTY_BY_UTC_DAY[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** Column shape of a `daily_puzzles` row as read from D1. */
export type DailyPuzzleRow = {
  id: number;
  date: string;
  mode: string;
  difficulty: string;
  puzzle_data: string;
  cage_data: string | null;
  solution: string;
};

/** JSON payload served by GET /api/daily. */
export type DailyPuzzlePayload = {
  id: number;
  date: string;
  mode: GameMode;
  difficulty: Difficulty;
  gridSize: number;
  initial: (Digit | null)[][];
  solution: Digit[][];
  cages?: Cage[];
};

/** Serialize a generated puzzle into the `daily_puzzles` text columns. */
export function serializeDailyPuzzle(puzzle: Puzzle): Pick<DailyPuzzleRow, 'puzzle_data' | 'cage_data' | 'solution'> {
  return {
    puzzle_data: JSON.stringify(puzzle.initial),
    cage_data: puzzle.cages?.length ? JSON.stringify(puzzle.cages) : null,
    solution: JSON.stringify(puzzle.solution),
  };
}

function parseJson(text: string): unknown {
  try { return JSON.parse(text); } catch { return undefined; }
}

/**
 * Rebuild a playable puzzle from a stored row, or null when the row is
 * malformed. Validation uses the same engine contract as saved games.
 */
export function puzzleFromDailyRow(row: DailyPuzzleRow): Puzzle | null {
  if (!isDailyPuzzleRef({ id: row.id, date: row.date })) return null;
  const initial = parseJson(row.puzzle_data);
  const solution = parseJson(row.solution);
  const cages = row.cage_data === null ? undefined : parseJson(row.cage_data);
  if (!Array.isArray(initial) || !Array.isArray(solution)) return null;
  if (cages !== undefined && !Array.isArray(cages)) return null;

  const puzzle: Puzzle = {
    initial: initial as (Digit | null)[][],
    solution: solution as Digit[][],
    difficulty: row.difficulty as Difficulty,
    mode: row.mode as GameMode,
    gridSize: solution.length,
    ...(cages === undefined ? {} : { cages: cages as Cage[] }),
    daily: { id: row.id, date: row.date },
  };
  return isPuzzleDefinitionValid(puzzle) ? puzzle : null;
}

/** Shape a validated puzzle for the API response. */
export function dailyPayloadFromPuzzle(puzzle: Puzzle, daily: DailyPuzzleRef): DailyPuzzlePayload {
  return {
    id: daily.id,
    date: daily.date,
    mode: puzzle.mode,
    difficulty: puzzle.difficulty,
    gridSize: puzzle.gridSize,
    initial: puzzle.initial,
    solution: puzzle.solution,
    ...(puzzle.cages?.length ? { cages: puzzle.cages } : {}),
  };
}

/** Rebuild a playable puzzle from the API response, or null when malformed. */
export function puzzleFromDailyPayload(payload: unknown): Puzzle | null {
  if (!payload || typeof payload !== 'object') return null;
  const data = payload as Partial<DailyPuzzlePayload>;
  const daily = { id: data.id, date: data.date };
  if (!isDailyPuzzleRef(daily)) return null;
  if (!Array.isArray(data.initial) || !Array.isArray(data.solution)) return null;
  if (data.cages !== undefined && !Array.isArray(data.cages)) return null;
  const puzzle: Puzzle = {
    initial: data.initial,
    solution: data.solution,
    difficulty: data.difficulty as Difficulty,
    mode: data.mode as GameMode,
    gridSize: data.solution.length,
    ...(data.cages ? { cages: data.cages } : {}),
    daily,
  };
  return isPuzzleDefinitionValid(puzzle) ? puzzle : null;
}
