import { useGameStore } from '../../store/gameStore';
import type { InputMode } from '../../engine/types';

const INPUT_MODES: { mode: InputMode; label: string; icon: string }[] = [
  { mode: 'digit', label: 'Digit', icon: '✎' },
  { mode: 'corner', label: 'Corner', icon: '¹₂' },
  { mode: 'center', label: 'Center', icon: 'ab' },
];

export default function ControlBar() {
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const eraseCell = useGameStore((s) => s.eraseCell);
  const inputMode = useGameStore((s) => s.inputMode);
  const setInputMode = useGameStore((s) => s.setInputMode);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const historyLength = useGameStore((s) => s.history.length);

  return (
    <div className="flex items-center justify-center gap-2 w-full max-w-[min(90vw,500px)] mx-auto mt-3">
      {/* Undo */}
      <button
        onClick={undo}
        disabled={historyIndex < 0}
        className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:cursor-default transition-colors text-sm font-medium"
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>

      {/* Redo */}
      <button
        onClick={redo}
        disabled={historyIndex >= historyLength - 1}
        className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 disabled:opacity-30 disabled:cursor-default transition-colors text-sm font-medium"
        title="Redo (Ctrl+Shift+Z)"
      >
        Redo
      </button>

      {/* Erase */}
      <button
        onClick={eraseCell}
        className="flex-1 py-2.5 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm font-medium"
        title="Erase (Backspace)"
      >
        Erase
      </button>

      {/* Input mode toggle */}
      {INPUT_MODES.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setInputMode(mode)}
          className={`
            flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors
            ${
              inputMode === mode
                ? 'bg-blue-500 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
            }
          `}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
