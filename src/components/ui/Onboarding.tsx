import { useState, useEffect } from 'react';

const STORAGE_KEY = 'infinite-sudoku-onboarded';

const STEPS = [
  {
    title: 'Welcome to Infinite Sudoku!',
    body: 'An endlessly replayable Sudoku game with classic, killer, and auto-note modes.',
  },
  {
    title: 'Select & Place',
    body: 'Tap a cell to select it, then tap a digit on the number bar below the board. On desktop you can type 1\u20139 directly.',
  },
  {
    title: 'Notes & Modes',
    body: 'Switch between digit, corner, and center note modes with the mode toggle (or press N). Shift+digit adds a corner note without switching modes.',
  },
  {
    title: 'Hints',
    body: 'Stuck? Tap the hint button \u2014 you\u2019ll solve a mini-puzzle to earn the answer for one cell.',
  },
  {
    title: 'Keyboard Shortcuts',
    body: 'Arrow keys to navigate, Backspace to erase, Ctrl+Z to undo, Space to pause. Press ? anytime for the full list.',
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  if (!visible) return null;

  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      // ignore
    }
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay-bg)' }}
    >
      <div
        className="rounded-2xl p-6 shadow-xl max-w-sm mx-4 w-full"
        style={{ backgroundColor: 'var(--color-card-bg, var(--color-bg))' }}
      >
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-text)' }}>
          {current.title}
        </h2>
        <p className="text-sm mb-5 leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
          {current.body}
        </p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-colors"
              style={{
                backgroundColor: i === step ? 'var(--color-btn-active-bg)' : 'var(--color-cell-border)',
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{
                color: 'var(--color-btn-text)',
                borderColor: 'var(--color-cell-border)',
                backgroundColor: 'var(--color-btn-bg)',
              }}
            >
              Back
            </button>
          )}
          {!isLast && (
            <button
              onClick={dismiss}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors"
              style={{
                color: 'var(--color-text-muted)',
                borderColor: 'var(--color-cell-border)',
                backgroundColor: 'transparent',
              }}
            >
              Skip
            </button>
          )}
          <button
            onClick={isLast ? dismiss : () => setStep(step + 1)}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
            style={{
              backgroundColor: 'var(--color-btn-active-bg)',
              color: 'var(--color-btn-active-text)',
            }}
          >
            {isLast ? "Let's Play!" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
