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
          className={`
            flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors
            ${canHint
              ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 active:bg-amber-300'
              : 'bg-slate-100 text-slate-400 cursor-default'
            }
          `}
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
          className="w-9 h-9 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-colors text-sm font-bold flex-shrink-0 flex items-center justify-center"
        >
          ?
        </button>
      </div>

      {/* Help tooltip */}
      {showHelp && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowHelp(false)} />
          <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50">
            <h3 className="font-bold text-slate-800 text-sm mb-2">How Hints Work</h3>
            <div className="text-xs text-slate-600 space-y-2">
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
              className="mt-3 text-xs font-medium text-blue-500 hover:text-blue-700"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </div>
  );
}
