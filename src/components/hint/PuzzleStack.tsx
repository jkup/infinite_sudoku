import { useHintStore } from '../../store/hintStore';
import { useGameStore } from '../../store/gameStore';

const DIFF_LABELS: Record<string, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

export default function PuzzleStack() {
  const stack = useHintStore((s) => s.stack);
  const abandonToLevel = useHintStore((s) => s.abandonToLevel);
  const abandonHintPuzzle = useHintStore((s) => s.abandonHintPuzzle);
  const currentDifficulty = useGameStore((s) => s.difficulty);

  if (stack.length === 0) return null;

  return (
    <div className="w-full max-w-[min(90vw,500px)] mx-auto mb-3">
      <div
        className="rounded-xl px-4 py-3 border"
        style={{ backgroundColor: 'var(--color-bg-secondary)', borderColor: 'var(--color-cell-border)' }}
      >
        {/* Depth label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
            Hint Puzzle — Depth {stack.length}
          </span>
          <button
            onClick={abandonHintPuzzle}
            className="text-xs font-medium transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Give up &amp; go back
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {stack.map((entry, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <button
                onClick={() => abandonToLevel(i)}
                className="px-2.5 py-1 rounded-md text-xs font-medium transition-colors"
                style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}
                title={`Go back to this ${DIFF_LABELS[entry.difficulty]} puzzle (hint not earned)`}
              >
                {DIFF_LABELS[entry.difficulty]}
              </button>
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>→</span>
            </div>
          ))}
          <span
            className="px-2.5 py-1 rounded-md text-xs font-bold"
            style={{ backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }}
          >
            {DIFF_LABELS[currentDifficulty]}
          </span>
        </div>

        <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
          Solve this puzzle to earn your hint! Or click a level above to go back.
        </p>
      </div>
    </div>
  );
}
