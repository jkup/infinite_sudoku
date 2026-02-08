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

async function getAuthToken(): Promise<string | null> {
  // Access Clerk from the window — avoids importing Clerk into non-React modules
  const clerk = (window as unknown as { Clerk?: { session?: { getToken: () => Promise<string> } } }).Clerk;
  if (!clerk?.session) return null;
  try {
    return await clerk.session.getToken();
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
  await authFetch('/api/stats', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getStats(): Promise<UserStats | null> {
  const res = await authFetch('/api/stats');
  if (!res.ok) return null;
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
