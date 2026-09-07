import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { usePopup } from '../../hooks/usePopup';
import { useGameStore } from '../../store/gameStore';
import { getStats } from '../../lib/api';
import { dailyDifficultyFor, formatDailyDate, recentDailyDates, utcDateString } from '../../lib/daily';
import type { GameMode } from '../../engine/types';

const DAYS_SHOWN = 14;

const DIFFICULTY_LABELS = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' } as const;

type Props = {
  onRequestDaily: (mode: GameMode, date: string) => void;
  /** UTC dates the player has completed, for check marks; null when unknown or signed out. */
  completedDates?: string[] | null;
};

/**
 * "Daily" control: opens a list of today and the previous two weeks so a player
 * can start any day's puzzle in the current mode. Past days are replays: they
 * count for score but never change streaks (see docs/DAILY_RULES.md).
 */
export default function DailyPicker({ onRequestDaily, completedDates = null }: Props) {
  const mode = useGameStore((s) => s.mode);
  const current = useGameStore((s) => s.puzzle?.daily?.date ?? null);
  const [open, setOpen] = useState(false);
  const { ref, triggerRef, id } = usePopup(open, () => setOpen(false));
  const today = utcDateString();
  const dates = recentDailyDates(today, DAYS_SHOWN);
  const completed = new Set(completedDates ?? []);
  const isPlayingDaily = current !== null;

  return (
    <div className="relative" ref={ref}>
      <button
        ref={triggerRef}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-haspopup="dialog"
        aria-pressed={isPlayingDaily}
        onClick={() => setOpen(!open)}
        title={isPlayingDaily ? `Playing the daily for ${formatDailyDate(current)}` : 'Play a daily puzzle'}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap"
        style={isPlayingDaily
          ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)', borderColor: 'var(--color-btn-active-bg)' }
          : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)', borderColor: 'var(--color-cell-border)' }}
      >
        Daily &#9662;
      </button>

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="Daily puzzles"
          data-game-popup
          tabIndex={-1}
          className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg p-2 w-[min(90vw,17rem)] max-h-[60vh] overflow-y-auto"
          style={{ backgroundColor: 'var(--color-card-bg, var(--color-bg))', borderColor: 'var(--color-cell-border)' }}
        >
          <div className="px-1 pb-2 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            {mode} dailies
          </div>
          <ul className="flex flex-col gap-1">
            {dates.map((date) => {
              const isToday = date === today;
              const isCurrent = date === current;
              const done = completed.has(date);
              return (
                <li key={date}>
                  <button
                    onClick={() => { setOpen(false); if (!isCurrent) onRequestDaily(mode, date); }}
                    aria-current={isCurrent ? 'true' : undefined}
                    aria-label={`${isToday ? 'Today, ' : ''}${formatDailyDate(date)}, ${DIFFICULTY_LABELS[dailyDifficultyFor(date)]}${done ? ', completed' : ''}${isCurrent ? ', playing now' : ''}`}
                    className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors"
                    style={isCurrent
                      ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
                      : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}
                  >
                    <span className="truncate">
                      <span className="font-semibold">{isToday ? 'Today' : formatDailyDate(date).replace(/,.*$/, '')}</span>
                      <span className="ml-1.5 opacity-80">{formatDailyDate(date).replace(/^[^,]*,\s*/, '')}</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5 text-xs">
                      {done && <span aria-hidden="true" title="Completed">&#10003;</span>}
                      <span className="opacity-80">{DIFFICULTY_LABELS[dailyDifficultyFor(date)]}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="px-1 pt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Past days count for score but don&apos;t change your streak.
          </p>
        </div>
      )}
    </div>
  );
}

/** Wraps DailyPicker with the signed-in player's completed dates. Render only inside ClerkProvider. */
export function DailyPickerWithProgress({ onRequestDaily }: Pick<Props, 'onRequestDaily'>) {
  const { isLoaded, isSignedIn } = useAuth();
  const completionSyncStatus = useGameStore((s) => s.completionSyncStatus);
  const [completedDates, setCompletedDates] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    getStats()
      .then((stats) => { if (!cancelled) setCompletedDates(stats?.dailyDates ?? []); })
      .catch(() => { /* marks are a nicety; the list still works */ });
    return () => { cancelled = true; };
  }, [isLoaded, isSignedIn, completionSyncStatus]); // refetch after a completion syncs

  return <DailyPicker onRequestDaily={onRequestDaily} completedDates={isSignedIn ? completedDates : null} />;
}
