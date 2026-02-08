import { useGameStore } from '../../store/gameStore';
import { DIGITS } from '../../engine/types';
import type { Digit } from '../../engine/types';

export default function DigitBar() {
  const placeDigit = useGameStore((s) => s.placeDigit);
  const grid = useGameStore((s) => s.grid);

  // Count placed digits to show completion
  const digitCounts = new Map<Digit, number>();
  for (const d of DIGITS) digitCounts.set(d, 0);
  for (const row of grid) {
    for (const cell of row) {
      if (cell.digit) digitCounts.set(cell.digit, digitCounts.get(cell.digit)! + 1);
    }
  }

  return (
    <div className="grid grid-cols-9 gap-1 w-full max-w-[min(95vw,500px)] mx-auto mt-1.5">
      {DIGITS.map((d) => {
        const complete = digitCounts.get(d)! >= 9;
        return (
          <button
            key={d}
            onClick={() => placeDigit(d)}
            disabled={complete}
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
