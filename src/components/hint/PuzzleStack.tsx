import { useHintStore } from '../../store/hintStore';
import { useGameStore } from '../../store/gameStore';

const DIFF_LABELS: Record<string, string> = {
  beginner: 'Beginner',
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
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        {/* Depth label */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-amber-700 uppercase tracking-wide">
            Hint Puzzle — Depth {stack.length}
          </span>
          <button
            onClick={abandonHintPuzzle}
            className="text-xs font-medium text-amber-600 hover:text-amber-800 transition-colors"
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
                className="px-2.5 py-1 rounded-md bg-amber-100 text-amber-700 text-xs font-medium hover:bg-amber-200 transition-colors"
                title={`Go back to this ${DIFF_LABELS[entry.difficulty]} puzzle (hint not earned)`}
              >
                {DIFF_LABELS[entry.difficulty]}
              </button>
              <span className="text-amber-400 text-xs">→</span>
            </div>
          ))}
          <span className="px-2.5 py-1 rounded-md bg-amber-200 text-amber-800 text-xs font-bold">
            {DIFF_LABELS[currentDifficulty]}
          </span>
        </div>

        <p className="text-xs text-amber-600 mt-2">
          Solve this puzzle to earn your hint! Or click a level above to go back.
        </p>
      </div>
    </div>
  );
}
