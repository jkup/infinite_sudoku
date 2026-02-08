import { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useHintStore } from '../../store/hintStore';
import { DIFFICULTY_ORDER } from '../../engine/types';

export default function HintButton() {
  const [showHelp, setShowHelp] = useState(false);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const grid = useGameStore((s) => s.grid);
  const difficulty = useGameStore((s) => s.difficulty);
  const status = useGameStore((s) => s.status);
  const requestHint = useHintStore((s) => s.requestHint);

  const canHint = (() => {
    if (status !== 'playing' || !selectedCell) return false;
    const cell = grid[selectedCell.row]?.[selectedCell.col];
    if (!cell) return false;
    return !cell.isGiven && cell.digit === null;
  })();

  const diffIndex = DIFFICULTY_ORDER.indexOf(difficulty);
  const isFreeHint = diffIndex <= 0;

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        <button
          onClick={requestHint}
          disabled={!canHint}
          className="flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors"
          style={
            canHint
              ? { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)' }
              : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text-muted)', cursor: 'default', opacity: 0.5 }
          }
          title={
            !selectedCell
              ? 'Select an empty cell first'
              : isFreeHint
              ? 'Reveal answer (free at Beginner)'
              : `Solve a ${DIFFICULTY_ORDER[diffIndex - 1]} puzzle to earn this hint`
          }
        >
          {isFreeHint ? 'Reveal' : 'Hint'}
        </button>
        <button
          onClick={() => setShowHelp(!showHelp)}
          className="w-9 h-9 rounded-lg text-sm font-bold flex-shrink-0 flex items-center justify-center transition-colors"
          style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text-muted)' }}
        >
          ?
        </button>
      </div>

      {/* Help tooltip */}
      {showHelp && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
          <div
            className="absolute bottom-full right-0 mb-2 w-72 rounded-xl shadow-lg border p-4 z-50"
            style={{ backgroundColor: 'var(--color-card-bg)', borderColor: 'var(--color-cell-border)' }}
          >
            <h3 className="font-bold text-sm mb-2" style={{ color: 'var(--color-text)' }}>How Hints Work</h3>
            <div className="text-xs space-y-2" style={{ color: 'var(--color-text-muted)' }}>
              <p>
                Select an empty cell and tap <strong>Hint</strong>. Instead of
                just giving you the answer, you'll be challenged to solve a
                <strong> slightly easier puzzle</strong> first!
              </p>
              <p>
                Solve that puzzle and you earn your hint. Need a hint on the
                hint puzzle? It nests again — puzzles within puzzles, all the
                way down to Beginner.
              </p>
              <p>
                At <strong>Beginner</strong> difficulty, hints are free since
                there's nowhere easier to go.
              </p>
              <p>
                You can always <strong>give up</strong> on a hint puzzle and
                return to your original game without earning the hint.
              </p>
            </div>
            <button
              onClick={() => setShowHelp(false)}
              className="mt-3 text-xs font-medium"
              style={{ color: 'var(--color-digit-placed)' }}
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
