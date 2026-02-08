import { useGameStore } from '../../store/gameStore';

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export default function Timer() {
  const elapsedMs = useGameStore((s) => s.elapsedMs);
  const status = useGameStore((s) => s.status);
  const pauseGame = useGameStore((s) => s.pauseGame);
  const resumeGame = useGameStore((s) => s.resumeGame);

  return (
    <div className="flex items-center gap-2">
      <span className="text-lg font-mono font-semibold text-slate-700 tabular-nums">
        {formatTime(elapsedMs)}
      </span>
      {status === 'playing' && (
        <button
          onClick={pauseGame}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          title="Pause (Space)"
        >
          ⏸
        </button>
      )}
      {status === 'paused' && (
        <button
          onClick={resumeGame}
          className="text-sm text-slate-400 hover:text-slate-600 transition-colors"
          title="Resume (Space)"
        >
          ▶
        </button>
      )}
    </div>
  );
}
