import { useGameStore } from '../../store/gameStore';
import type { Difficulty, GameMode } from '../../engine/types';

const MODES: { mode: GameMode; label: string; description: string }[] = [
  { mode: 'classic', label: 'Classic', description: 'Standard Sudoku' },
  { mode: 'killer', label: 'Killer', description: 'Cages with sum clues' },
];

type Props = {
  onRequestNewGame: (difficulty: Difficulty, mode: GameMode) => void;
};

export default function ModePicker({ onRequestNewGame }: Props) {
  const mode = useGameStore((s) => s.mode);
  const difficulty = useGameStore((s) => s.difficulty);

  return (
    <div className="flex items-center gap-1.5">
      {MODES.map((m) => (
        <button
          key={m.mode}
          onClick={() => onRequestNewGame(difficulty, m.mode)}
          className={`
            px-4 py-1.5 rounded-lg text-sm font-medium transition-colors
            ${
              mode === m.mode
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }
          `}
          title={m.description}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
