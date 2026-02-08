import { useState, useRef, useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { DIFFICULTY_ORDER } from '../../engine/types';
import type { Difficulty, GameMode } from '../../engine/types';

const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  beginner: 'Beginner',
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
  expert: 'Expert',
};

const MODES: { mode: GameMode; label: string }[] = [
  { mode: 'classic', label: 'Classic' },
  { mode: 'killer', label: 'Killer' },
];

type Props = {
  onRequestNewGame: (difficulty: Difficulty, mode: GameMode) => void;
};

export default function GameModePicker({ onRequestNewGame }: Props) {
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const modeLabel = MODES.find((m) => m.mode === mode)?.label ?? 'Classic';
  const diffLabel = DIFFICULTY_LABELS[difficulty];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors flex items-center gap-1 whitespace-nowrap"
        style={{
          backgroundColor: 'var(--color-btn-bg)',
          color: 'var(--color-btn-text)',
          borderColor: 'var(--color-cell-border)',
        }}
      >
        {modeLabel} &middot; {diffLabel} &#9662;
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1 z-50 rounded-lg border shadow-lg p-3 min-w-[200px]"
          style={{
            backgroundColor: 'var(--color-card-bg, var(--color-bg))',
            borderColor: 'var(--color-cell-border)',
          }}
        >
          {/* Mode section */}
          <div className="mb-2">
            <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Mode
            </div>
            <div className="flex gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.mode}
                  onClick={() => {
                    onRequestNewGame(difficulty, m.mode);
                    setOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={
                    mode === m.mode
                      ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
                      : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }
                  }
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty section */}
          <div>
            <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
              Difficulty
            </div>
            <div className="flex flex-wrap gap-1.5">
              {DIFFICULTY_ORDER.map((d) => (
                <button
                  key={d}
                  onClick={() => {
                    onRequestNewGame(d, mode);
                    setOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={
                    difficulty === d
                      ? { backgroundColor: 'var(--color-btn-active-bg)', color: 'var(--color-btn-active-text)' }
                      : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }
                  }
                >
                  {DIFFICULTY_LABELS[d]}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
