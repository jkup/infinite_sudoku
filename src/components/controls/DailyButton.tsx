import { useGameStore } from '../../store/gameStore';
import { utcDateString } from '../../lib/daily';
import type { GameMode } from '../../engine/types';

type Props = {
  onRequestDaily: (mode: GameMode) => void;
};

/** Starts today's canonical daily puzzle in the currently selected mode. */
export default function DailyButton({ onRequestDaily }: Props) {
  const mode = useGameStore((s) => s.mode);
  const daily = useGameStore((s) => s.puzzle?.daily);
  const isTodays = daily?.date === utcDateString();

  return (
    <button
      aria-pressed={isTodays}
      onClick={() => { if (!isTodays) onRequestDaily(mode); }}
      title={isTodays ? "You're playing today's daily puzzle" : `Play today's ${mode} daily puzzle`}
      className="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors whitespace-nowrap"
      style={isTodays
        ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)', borderColor: 'var(--color-btn-active-bg)' }
        : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)', borderColor: 'var(--color-cell-border)' }}
    >
      Daily
    </button>
  );
}
