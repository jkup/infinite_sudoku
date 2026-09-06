import { useGameStore } from '../../store/gameStore';
import { formatTime } from '../../lib/formatTime';

export default function Timer() {
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const status = useGameStore((s) => s.status);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);

  return (
    <div className="flex items-center gap-2" role="status" aria-label="Game timer">
      <span
        className="text-lg font-mono font-semibold tabular-nums"
        style={{ color: 'var(--color-text)' }}
        aria-label={`Elapsed time: ${formatTime(elapsedMs)}`}
      >
        {formatTime(elapsedMs)}
      </span>
      {(status === 'playing' || status === 'paused') && (
        <button
          onClick={status === 'playing' ? pauseGame : resumeGame}
          className="text-sm transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
          title={status === 'playing' ? 'Pause (Space)' : 'Resume (Space)'}
          aria-label={status === 'playing' ? 'Pause game' : 'Resume game'}
        >
          {status === 'playing' ? '⏸' : '▶'}
        </button>
      )}
    </div>
  );
}
