import { useGameStore } from '../../store/gameStore';
import { CELL_COLOR_COUNT, getDigitsForSize } from '../../engine/types';
import type { Digit } from '../../engine/types';

/** Digit pad, or the color palette while the input mode is "color". */
export default function DigitBar() {
  const inputMode = useGameStore((s) => s.inputMode);
  const grid = useGameStore((s) => s.grid);
  const gridSize = grid.length || 9;

  return inputMode === 'color'
    ? <ColorPalette gridSize={gridSize} />
    : <DigitPad grid={grid} gridSize={gridSize} />;
}

function DigitPad({ grid, gridSize }: { grid: ReturnType<typeof useGameStore.getState>['grid']; gridSize: number }) {
  const placeDigit = useGameStore((s) => s.placeDigit);
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
            className="relative py-3 rounded-lg text-2xl font-bold flex items-center justify-center transition-all duration-100"
            style={
              complete
                ? { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text-muted)', cursor: 'default' }
                : { backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-text)', cursor: 'pointer' }
            }
          >
            {d}
            {complete && <span aria-hidden="true" className="absolute top-0.5 right-1 text-xs leading-none">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * One swatch per color plus a clear swatch, laid out on the same columns as the
 * digit pad so the two share the keyboard mapping: key N paints color N, the
 * last key clears. Mini grids get fewer colors so the clear swatch still fits.
 */
function ColorPalette({ gridSize }: { gridSize: number }) {
  const paintCell = useGameStore((s) => s.paintCell);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const grid = useGameStore((s) => s.grid);
  const current = selectedCell ? grid[selectedCell.row]?.[selectedCell.col]?.colorIndex ?? null : null;
  const colorCount = Math.min(CELL_COLOR_COUNT, gridSize - 1);
  const swatchBase = 'relative py-3 rounded-lg text-sm font-bold flex items-center justify-center transition-all duration-100 border-2';

  return (
    <div
      className="grid gap-1 w-full max-w-[min(98vw,500px)] mx-auto mt-1.5"
      style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
      role="group"
      aria-label="Cell color palette"
    >
      {Array.from({ length: colorCount }, (_, index) => (
        <button
          key={index}
          onClick={() => paintCell(index)}
          aria-pressed={current === index}
          aria-label={`Paint color ${index + 1}`}
          className={swatchBase}
          style={{
            backgroundColor: `var(--color-cell-paint-${index})`,
            borderColor: current === index ? 'var(--color-text)' : 'transparent',
            color: 'var(--color-text)',
          }}
        >
          {index + 1}
        </button>
      ))}
      <button
        onClick={() => paintCell(null)}
        aria-label="Clear color"
        className={swatchBase}
        style={{ backgroundColor: 'var(--color-btn-bg)', borderColor: 'transparent', color: 'var(--color-text)' }}
      >
        &times;
      </button>
    </div>
  );
}
