import { useGameStore } from '../../store/gameStore';
import type { InputMode } from '../../engine/types';

const INPUT_MODES: { mode: InputMode; label: string }[] = [
  { mode: 'digit', label: 'Digit' },
  { mode: 'corner', label: 'Corner' },
  { mode: 'center', label: 'Center' },
];

const btnBase = 'flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors';
const btnDefault = `${btnBase} bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300`;
const btnDisabled = `${btnBase} bg-slate-100 text-slate-600 disabled:opacity-30 disabled:cursor-default hover:bg-slate-200 active:bg-slate-300`;

export default function ControlBar() {
  const undo = useGameStore((s) => s.undo);
  const redo = useGameStore((s) => s.redo);
  const eraseCell = useGameStore((s) => s.eraseCell);
  const autoNote = useGameStore((s) => s.autoNote);
  const inputMode = useGameStore((s) => s.inputMode);
  const setInputMode = useGameStore((s) => s.setInputMode);
  const historyIndex = useGameStore((s) => s.historyIndex);
  const historyLength = useGameStore((s) => s.history.length);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 w-full max-w-[min(90vw,500px)] mx-auto mt-3">
      <button onClick={undo} disabled={historyIndex < 0} className={btnDisabled} title="Undo (Ctrl+Z)">
        Undo
      </button>
      <button onClick={redo} disabled={historyIndex >= historyLength - 1} className={btnDisabled} title="Redo (Ctrl+Shift+Z)">
        Redo
      </button>
      <button onClick={eraseCell} className={btnDefault} title="Erase (Backspace)">
        Erase
      </button>
      <button onClick={autoNote} className={btnDefault} title="Auto-fill corner notes for all empty cells">
        Auto Note
      </button>

      {INPUT_MODES.map(({ mode, label }) => (
        <button
          key={mode}
          onClick={() => setInputMode(mode)}
          className={`
            ${btnBase}
            ${inputMode === mode
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
