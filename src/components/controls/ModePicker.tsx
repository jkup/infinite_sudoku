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
          className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={
            mode === m.mode
              ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
              : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }
          }
          title={m.description}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
