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

// Border colors
const MEDIUM = '#cbd5e1';    // slate-300
const THICK = '#334155';     // slate-700

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
  if (isSelected) bgColor = '#bfdbfe';       // blue-200
  else if (isConflict) bgColor = '#fee2e2';   // red-100
  else if (isDigitMatch) bgColor = '#dbeafe';  // blue-100
  else if (isHighlighted) bgColor = '#f1f5f9'; // slate-100
  else if (isGiven && !isKillerMode) bgColor = '#f1f5f9'; // slate-100 for given cells in classic
  else bgColor = '#ffffff';

  // Digit color
  const digitColor = isConflict
    ? '#ef4444'    // red-500
    : isGiven
    ? '#1e293b'    // slate-800
    : '#3b82f6';   // blue-500

  // Border styles
  // In killer mode, cell borders are invisible — the SVG cage overlay provides all structure
  const borderStyle: CSSProperties = isKillerMode
    ? {
        borderTop:    `${row % 3 === 0 ? 2 : 1}px solid ${row % 3 === 0 ? '#94a3b8' : 'transparent'}`,
        borderLeft:   `${col % 3 === 0 ? 2 : 1}px solid ${col % 3 === 0 ? '#94a3b8' : 'transparent'}`,
        borderRight:  col === 8 ? '2px solid #94a3b8' : '1px solid transparent',
        borderBottom: row === 8 ? '2px solid #94a3b8' : '1px solid transparent',
        backgroundColor: bgColor,
      }
    : {
        borderTop:    `${row % 3 === 0 ? 2 : 1}px solid ${row % 3 === 0 ? THICK : MEDIUM}`,
        borderLeft:   `${col % 3 === 0 ? 2 : 1}px solid ${col % 3 === 0 ? THICK : MEDIUM}`,
        borderRight:  col === 8 ? `2px solid ${THICK}` : `1px solid ${MEDIUM}`,
        borderBottom: row === 8 ? `2px solid ${THICK}` : `1px solid ${MEDIUM}`,
        backgroundColor: bgColor,
      };

  const hasNotes = cornerNotes.size > 0 || centerNotes.size > 0;

  return (
    <div
      className="relative flex items-center justify-center cursor-pointer select-none aspect-square transition-colors duration-75 active:brightness-95"
      style={borderStyle}
      onClick={() => onClick(position)}
      role="gridcell"
      aria-label={`Row ${row + 1}, Column ${col + 1}${
        digit ? `, value ${digit}` : ', empty'
      }${cageSum !== null ? `, cage sum ${cageSum}` : ''}`}
    >
      {/* Killer cage sum label */}
      {cageSum !== null && (
        <span
          className="absolute top-0 left-0.5 z-20 leading-none font-bold text-slate-700"
          style={{ fontSize: 'clamp(0.5rem, 2.4cqi, 0.8rem)' }}
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
                  className="text-slate-500 leading-none"
                  style={{
                    fontSize: 'clamp(0.35rem, 1.6cqi, 0.6rem)',
                    gridRow: NOTE_GRID[d].gridRow,
                    gridColumn: NOTE_GRID[d].gridCol,
                    visibility: cornerNotes.has(d) ? 'visible' : 'hidden',
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
              className="text-blue-400 leading-none"
              style={{ fontSize: 'clamp(0.4rem, 1.8cqi, 0.65rem)' }}
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
