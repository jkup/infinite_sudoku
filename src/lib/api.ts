import type { Difficulty, GameMode, Puzzle } from '../engine/types';
import { puzzleFromDailyPayload } from './daily';

export type GameResultPayload = {
  completionId: string;
  mode: GameMode;
  difficulty: Difficulty;
  solveTimeMs: number;
  hintsUsed: number;
  maxHintDepth: number;
  errorsMade: number;
  dailyPuzzleId?: number;
};

export class ApiError extends Error {
  status: number;
  correlationId: string | null;

  constructor(status: number, correlationId: string | null) {
    super(`API request failed (${status})`);
    this.name = 'ApiError';
    this.status = status;
    this.correlationId = correlationId;
  }
}

export type UserStats = {
  totalGamesCompleted: number;
  totalHintsUsed: number;
  totalScore: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
};

export type LeaderboardEntry = {
  rank: number;
  displayName: string | null;
  score: number;
  solveTimeMs: number;
  difficulty: string;
  completedAt: string;
  isYou: boolean;
};

export type LeaderboardResponse = {
  date: string;
  mode: GameMode;
  entries: LeaderboardEntry[];
  /** The caller's own standing, present even when outside the listed entries. */
  you: { rank: number; score: number; solveTimeMs: number } | null;
  totalEntries: number;
};

/** Token getter injected by the React layer (see AuthTokenProvider) */
let _getToken: (() => Promise<string | null>) | null = null;

/** Called from React to provide the Clerk getToken function */
export function setAuthTokenGetter(fn: () => Promise<string | null>): void {
  _getToken = fn;
}

async function getAuthToken(): Promise<string | null> {
  if (!_getToken) return null;
  try {
    return await _getToken();
  } catch {
    return null;
  }
}

async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

export async function postGameResult(data: GameResultPayload): Promise<{ score: number }> {
  const res = await authFetch('/api/stats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    throw new ApiError(res.status, res.headers.get('X-Request-ID'));
  }
  const result = await res.json() as { score: number };
  return { score: result.score };
}

/**
 * Fetch the canonical daily puzzle for a mode (today by default). Public route,
 * so no token is sent. Resolves null when no puzzle exists for that date yet.
 */
export async function getDailyPuzzle(mode: GameMode, date?: string): Promise<Puzzle | null> {
  const params = new URLSearchParams({ mode });
  if (date) params.set('date', date);
  const res = await fetch(`/api/daily?${params}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError(res.status, res.headers.get('X-Request-ID'));
  const puzzle = puzzleFromDailyPayload(await res.json());
  if (!puzzle) throw new Error('Daily puzzle response was invalid');
  return puzzle;
}

export async function getStats(): Promise<UserStats | null> {
  const res = await authFetch('/api/stats');
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[stats] GET /api/stats failed (${res.status}):`, body);
    return null;
  }
  return res.json();
}

/** Ranked results for one daily puzzle; throws ApiError on failure. */
export async function getLeaderboard(date: string, mode: GameMode): Promise<LeaderboardResponse> {
  const params = new URLSearchParams({ date, mode });
  const res = await authFetch(`/api/leaderboard?${params}`);
  if (!res.ok) throw new ApiError(res.status, res.headers.get('X-Request-ID'));
  return res.json();
}
