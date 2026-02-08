import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_ORDER } from '../../engine/types';
import type { Difficulty, GameMode } from '../../engine/types';

const LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

type Props = {
  onRequestNewGame: (difficulty: Difficulty, mode: GameMode) => void;
};

export default function DifficultyPicker({ onRequestNewGame }: Props) {
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);

  return (
    <div className="flex items-center gap-1.5">
      {DIFFICULTY_ORDER.map((d) => (
        <button
          key={d}
          onClick={() => onRequestNewGame(d, mode)}
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
