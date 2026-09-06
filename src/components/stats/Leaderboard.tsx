import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getLeaderboard, type LeaderboardResponse } from '../../lib/api';
import { formatTime } from '../../lib/formatTime';
import type { GameMode } from '../../engine/types';

type Props = {
  date: string;
  mode: GameMode;
  /** Change this value to refetch, e.g. after the player's own result syncs. */
  refreshKey?: string | number;
};

const numberFormat = new Intl.NumberFormat();

/** Ranked results for one daily puzzle. Requires sign-in; the API is user-scoped. */
export default function Leaderboard({ date, mode, refreshKey }: Props) {
  const { isSignedIn, isLoaded } = useAuth();
  // Each distinct request is keyed; a result for another key means we are still loading.
  const requestKey = `${date}|${mode}|${refreshKey ?? ''}`;
  const [result, setResult] = useState<{ key: string; board: LeaderboardResponse | null; error: boolean } | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    getLeaderboard(date, mode)
      .then((board) => { if (!cancelled) setResult({ key: requestKey, board, error: false }); })
      .catch(() => { if (!cancelled) setResult({ key: requestKey, board: null, error: true }); });
    return () => { cancelled = true; };
  }, [date, mode, isLoaded, isSignedIn, requestKey]);

  if (!isLoaded) return null;

  const loading = result?.key !== requestKey;
  const board = result?.board ?? null; // keep the previous board visible while refreshing
  const state = !loading && result?.error ? 'error' : loading ? 'loading' : 'ready';

  const muted = { color: 'var(--color-text-muted)' };
  const heading = (
    <h3 className="text-xs font-semibold uppercase tracking-wide mb-2" style={muted}>
      {mode} daily leaderboard
    </h3>
  );

  if (!isSignedIn) {
    return <section aria-label="Daily leaderboard" className="text-sm">{heading}<p style={muted}>Sign in to see today&apos;s rankings.</p></section>;
  }
  if (state === 'error') {
    return <section aria-label="Daily leaderboard" className="text-sm">{heading}<p style={muted}>Couldn&apos;t load the leaderboard.</p></section>;
  }
  if (state === 'loading' && !board) {
    return <section aria-label="Daily leaderboard" className="text-sm">{heading}<p style={muted}>Loading rankings…</p></section>;
  }
  if (!board || board.entries.length === 0) {
    return <section aria-label="Daily leaderboard" className="text-sm">{heading}<p style={muted}>No one has finished this daily yet. Be the first!</p></section>;
  }

  const listedYou = board.entries.some((entry) => entry.isYou);

  return (
    <section aria-label="Daily leaderboard" className="text-sm text-left">
      {heading}
      <ol className="max-h-56 overflow-y-auto" aria-busy={state === 'loading'}>
        {board.entries.map((entry) => (
          <li
            key={entry.rank}
            className="grid grid-cols-[2rem_1fr_auto_auto] gap-x-2 items-baseline rounded px-1 py-0.5"
            style={entry.isYou
              ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
              : { color: 'var(--color-text)' }}
            aria-current={entry.isYou ? 'true' : undefined}
          >
            <span className="tabular-nums" style={entry.isYou ? undefined : muted}>{entry.rank}.</span>
            <span className="truncate">{entry.displayName ?? 'Anonymous'}{entry.isYou ? ' (you)' : ''}</span>
            <span className="tabular-nums" style={entry.isYou ? undefined : muted}>{formatTime(entry.solveTimeMs)}</span>
            <span className="tabular-nums font-semibold">{numberFormat.format(entry.score)}</span>
          </li>
        ))}
      </ol>
      {board.you && !listedYou && (
        <p className="mt-2" style={muted}>
          You: #{board.you.rank} of {board.totalEntries} with {numberFormat.format(board.you.score)} points.
        </p>
      )}
    </section>
  );
}
