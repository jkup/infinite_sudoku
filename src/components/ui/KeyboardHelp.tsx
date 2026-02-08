const SHORTCUTS = [
  { keys: ['1', '–', '9'], desc: 'Place digit' },
  { keys: ['Shift', '+', '1–9'], desc: 'Corner note' },
  { keys: ['N'], desc: 'Cycle input mode' },
  { keys: ['\u2190', '\u2191', '\u2192', '\u2193'], desc: 'Navigate cells' },
  { keys: ['Backspace'], desc: 'Erase cell' },
  { keys: ['\u2318/Ctrl', '+', 'Z'], desc: 'Undo' },
  { keys: ['\u2318/Ctrl', '+', '\u21e7', '+', 'Z'], desc: 'Redo' },
  { keys: ['H'], desc: 'Hint' },
  { keys: ['Space'], desc: 'Pause / Resume' },
  { keys: ['Esc'], desc: 'Deselect cell' },
  { keys: ['?'], desc: 'This help screen' },
];

interface KeyboardHelpProps {
  onClose: () => void;
}

export default function KeyboardHelp({ onClose }: KeyboardHelpProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: 'var(--color-overlay-bg)' }}
      onClick={onClose}
      role="dialog" aria-modal="true" aria-label="Keyboard shortcuts"
    >
      <div
        className="rounded-2xl p-6 shadow-xl max-w-sm mx-4 w-full"
        style={{ backgroundColor: 'var(--color-card-bg, var(--color-bg))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--color-text)' }}>
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-lg leading-none"
            style={{ color: 'var(--color-text-muted)' }}
            aria-label="Close"
          >
            &times;
          </button>
        </div>
        <ul className="space-y-2">
          {SHORTCUTS.map((s) => (
            <li key={s.desc} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-1 shrink-0">
                {s.keys.map((k, i) =>
                  k === '+' || k === '–' ? (
                    <span key={i} className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {k}
                    </span>
                  ) : (
                    <kbd
                      key={i}
                      className="px-1.5 py-0.5 rounded text-xs font-mono border"
                      style={{
                        backgroundColor: 'var(--color-btn-bg)',
                        borderColor: 'var(--color-cell-border)',
                        color: 'var(--color-text)',
                      }}
                    >
                      {k}
                    </kbd>
                  )
                )}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>{s.desc}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
