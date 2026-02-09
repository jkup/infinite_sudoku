import type { Difficulty, GameMode } from '../engine/types';

type GameResultPayload = {
  mode: GameMode;
  difficulty: Difficulty;
  solveTimeMs: number;
  hintsUsed: number;
  maxHintDepth: number;
  errorsMade: number;
  score: number;
};

export type UserStats = {
  totalGamesCompleted: number;
  totalHintsUsed: number;
  totalScore: number;
  currentDailyStreak: number;
  longestDailyStreak: number;
};

export type LeaderboardEntry = {
  clerkUserId: string;
  score: number;
  solveTimeMs: number;
  difficulty: string;
  completedAt: string;
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

export async function postGameResult(data: GameResultPayload): Promise<void> {
  const res = await authFetch('/api/stats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    console.error(`[stats] POST /api/stats failed (${res.status}):`, body);
  }
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

export async function getLeaderboard(
  date: string,
  mode: GameMode
): Promise<LeaderboardEntry[]> {
  const res = await authFetch(`/api/leaderboard?date=${date}&mode=${mode}`);
  if (!res.ok) return [];
  return res.json();
}
