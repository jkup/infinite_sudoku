import { memo, type CSSProperties } from 'react';
import type { Cell as CellType, CellPosition, Digit } from '../../engine/types';

type CellProps = {
  cell: CellType;
  isSelected: boolean;
  isHighlighted: boolean;
  isDigitMatch: boolean;
  isConflict: boolean;
  isKillerMode: boolean;
  cageSum: number | null;
  onClick: (pos: CellPosition) => void;
};

/**
 * Fixed 3x3 grid positions for corner notes.
 * Digit 1 is always top-left, 5 always center, 9 always bottom-right.
 * This makes notes scannable by position rather than by order.
 */
const NOTE_GRID: Record<Digit, { gridRow: number; gridCol: number }> = {
  1: { gridRow: 1, gridCol: 1 },
  2: { gridRow: 1, gridCol: 2 },
  3: { gridRow: 1, gridCol: 3 },
  4: { gridRow: 2, gridCol: 1 },
  5: { gridRow: 2, gridCol: 2 },
  6: { gridRow: 2, gridCol: 3 },
  7: { gridRow: 3, gridCol: 1 },
  8: { gridRow: 3, gridCol: 2 },
  9: { gridRow: 3, gridCol: 3 },
};

function CellComponent({ cell, isSelected, isHighlighted, isDigitMatch, isConflict, isKillerMode, cageSum, onClick }: CellProps) {
  const { position, digit, isGiven, cornerNotes, centerNotes } = cell;
  const { row, col } = position;

  // Background color
  let bgColor: string;
  if (isSelected) bgColor = 'var(--color-cell-selected)';
  else if (isConflict) bgColor = 'var(--color-cell-conflict)';
  else if (isDigitMatch) bgColor = 'var(--color-cell-digit-match)';
  else if (isHighlighted) bgColor = 'var(--color-cell-highlighted)';
  else if (isGiven && !isKillerMode) bgColor = 'var(--color-cell-given)';
  else bgColor = 'var(--color-cell-bg)';

  // Digit color
  const digitColor = isConflict
    ? 'var(--color-digit-error)'
    : isGiven
    ? 'var(--color-digit-given)'
    : 'var(--color-digit-placed)';

  // Border styles
  // In killer mode, all cells get a uniform thin border — the SVG cage overlay shows cage structure
  const borderStyle: CSSProperties = isKillerMode
    ? {
        borderTop:    '1px solid var(--color-cell-border)',
        borderLeft:   '1px solid var(--color-cell-border)',
        borderRight:  col === 8 ? '1px solid var(--color-cell-border)' : 'none',
        borderBottom: row === 8 ? '1px solid var(--color-cell-border)' : 'none',
        backgroundColor: bgColor,
      }
    : {
        borderTop:    `${row % 3 === 0 ? 2 : 1}px solid ${row % 3 === 0 ? 'var(--color-board-border)' : 'var(--color-cell-border)'}`,
        borderLeft:   `${col % 3 === 0 ? 2 : 1}px solid ${col % 3 === 0 ? 'var(--color-board-border)' : 'var(--color-cell-border)'}`,
        borderRight:  col === 8 ? '2px solid var(--color-board-border)' : '1px solid var(--color-cell-border)',
        borderBottom: row === 8 ? '2px solid var(--color-board-border)' : '1px solid var(--color-cell-border)',
        backgroundColor: bgColor,
      };

  const hasNotes = cornerNotes.size > 0 || centerNotes.size > 0;

  const notesLabel = cornerNotes.size > 0
    ? `, notes ${[...cornerNotes].sort().join(' ')}`
    : centerNotes.size > 0
    ? `, center notes ${[...centerNotes].sort().join(' ')}`
    : '';

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer select-none aspect-square transition-colors duration-75 active:brightness-95"
      style={borderStyle}
      onClick={() => onClick(position)}
      tabIndex={isSelected ? 0 : -1}
      role="gridcell"
      aria-selected={isSelected}
      aria-invalid={isConflict || undefined}
      aria-label={`Row ${row + 1}, Column ${col + 1}${
        digit ? `, value ${digit}` : ', empty'
      }${notesLabel}${cageSum !== null ? `, cage sum ${cageSum}` : ''}`}
    >
      {/* Killer cage sum label */}
      {cageSum !== null && (
        <span
          className="absolute top-0 left-0.5 z-20 leading-none font-bold"
          style={{ fontSize: 'clamp(0.5rem, 2.4cqi, 0.8rem)', color: 'var(--color-text)' }}
        >
          {cageSum}
        </span>
      )}

      {digit ? (
        <span
          className="font-semibold leading-none"
          style={{
            color: digitColor,
            fontSize: 'clamp(0.9rem, 4.5cqi, 2.2rem)',
            marginTop: cageSum !== null ? 'clamp(0.15rem, 0.8cqi, 0.3rem)' : undefined,
          }}
        >
          {digit}
        </span>
      ) : hasNotes ? (
        <>
          {/* Corner notes — fixed 3x3 grid so each digit is always in the same position */}
          {cornerNotes.size > 0 && (
            <div
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 items-center justify-items-center"
              style={{ padding: 'clamp(1px, 0.3cqi, 3px)' }}
            >
              {([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).map((d) => (
                <span
                  key={d}
                  className="leading-none"
                  style={{
                    fontSize: 'clamp(0.35rem, 1.6cqi, 0.6rem)',
                    gridRow: NOTE_GRID[d].gridRow,
                    gridColumn: NOTE_GRID[d].gridCol,
                    visibility: cornerNotes.has(d) ? 'visible' : 'hidden',
                    color: 'var(--color-note)',
                  }}
                >
                  {d}
                </span>
              ))}
            </div>
          )}

          {/* Center notes */}
          {centerNotes.size > 0 && cornerNotes.size === 0 && (
            <span
              className="leading-none"
              style={{ fontSize: 'clamp(0.4rem, 1.8cqi, 0.65rem)', color: 'var(--color-digit-placed)' }}
            >
              {[...centerNotes].sort().join('')}
            </span>
          )}
        </>
      ) : null}
    </div>
  );
}

export default memo(CellComponent);
