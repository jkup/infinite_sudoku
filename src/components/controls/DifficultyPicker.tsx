import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_ORDER } from '../../engine/types';
import type { Difficulty } from '../../engine/types';

const LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

export default function DifficultyPicker() {
  const difficulty = useGameStore((s) => s.difficulty);
  const newGame = useGameStore((s) => s.newGame);
  const mode = useGameStore((s) => s.mode);

  return (
    <div className="flex items-center gap-1.5">
      {DIFFICULTY_ORDER.map((d) => (
        <button
          key={d}
          onClick={() => newGame(d, mode)}
          className={`
            px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${
              difficulty === d
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          `}
        >
          {LABELS[d]}
        </button>
      ))}
    </div>
  );
}
