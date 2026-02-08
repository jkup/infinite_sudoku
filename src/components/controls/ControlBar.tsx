import { useGameStore } from '../../store/gameStore';
import type { Difficulty, GameMode, InputMode } from '../../engine/types';
import HintButton from '../hint/HintButton';

const INPUT_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'digit', label: 'Digit' },
  { mode: 'corner', label: 'Corner' },
  { mode: 'center', label: 'Center' },
];

type Props = {
  onRequestNewGame: (difficulty: Difficulty, mode: GameMode) => void;
};

export default function ControlBar({ onRequestNewGame }: Props) {
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const eraseCell = useGameStore((s) => s.eraseCell);
  const autoNote = useGameStore((s) => s.autoNote);
  const inputMode = useGameStore((s) => s.inputMode);
  const setInputMode = useGameStore((s) => s.setInputMode);
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const historyLength = useGameStore((s) => s.history.length);

  const btnBase = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors';

  return (
    <div className="w-full max-w-[min(90vw,500px)] mx-auto mt-3 flex flex-col gap-2">
      {/* Row 1: Actions */}
      <div className="flex items-center gap-2">
        <button onClick={undo} disabled={historyIndex < 0}
          className={`${btnBase} disabled:opacity-30 disabled:cursor-default`}
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}>
          Undo
        </button>
        <button onClick={redo} disabled={historyIndex >= historyLength - 1}
          className={`${btnBase} disabled:opacity-30 disabled:cursor-default`}
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}>
          Redo
        </button>
        <button onClick={eraseCell}
          className={btnBase}
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}>
          Erase
        </button>
        <button onClick={autoNote}
          className={btnBase}
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}>
          Auto Note
        </button>
        <button onClick={() => onRequestNewGame(difficulty, mode)}
          className={btnBase}
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }}>
          New Game
        </button>
      </div>

      {/* Row 2: Input mode + Hint */}
      <div className="flex items-center gap-2">
        {INPUT_MODES.map(({ mode: m, label }) => (
          <button
            key={m}
            onClick={() => setInputMode(m)}
            className={btnBase}
            style={
              inputMode === m
                ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
                : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }
            }
          >
            {label}
          </button>
        ))}
        <HintButton />
      </div>
    </div>
  );
}
