import { useGameStore } from '../../store/gameStore';
import { getDigitsForSize } from '../../engine/types';
import type { Digit } from '../../engine/types';

export default function DigitBar() {
  const placeDigit = useGameStore((s) => s.placeDigit);
  const grid = useGameStore((s) => s.grid);

  const gridSize = grid.length || 9;
  const digits = getDigitsForSize(gridSize);

  // Count placed digits to show completion
  const digitCounts = new Map<Digit, number>();
  for (const d of digits) digitCounts.set(d, 0);
  for (const row of grid) {
    for (const cell of row) {
      if (cell.digit) digitCounts.set(cell.digit, digitCounts.get(cell.digit)! + 1);
    }
  }

  return (
    <div
      className="grid gap-1 w-full max-w-[min(98vw,500px)] mx-auto mt-1.5"
      style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      role="group"
      aria-label="Digit input pad"
    >
      {digits.map((d) => {
        const complete = digitCounts.get(d)! >= gridSize;
        return (
          <button
            key={d}
            onClick={() => placeDigit(d)}
            disabled={complete}
            aria-label={`Place digit ${d}${complete ? ', all placed' : ''}`}
            className="py-3 rounded-lg text-2xl font-bold flex items-center justify-center transition-all duration-100"
            style={
              complete
                ? { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-cell-border)', cursor: 'default' }
                : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text)', cursor: 'pointer' }
            }
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}
