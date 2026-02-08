import { memo, type CSSProperties } from 'react';
import type { Cell as CellType, CellPosition } from '../../engine/types';

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

const CORNER_POSITIONS = [
  'top-0 left-0.5',
  'top-0 left-1/2 -translate-x-1/2',
  'top-0 right-0.5',
  'left-0.5 top-1/2 -translate-y-1/2',
  'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'right-0.5 top-1/2 -translate-y-1/2',
  'bottom-0 left-0.5',
  'bottom-0 left-1/2 -translate-x-1/2',
  'bottom-0 right-0.5',
];

// Border colors
const THIN = '#e2e8f0';      // slate-200
const MEDIUM = '#cbd5e1';    // slate-300
const THICK = '#334155';     // slate-700

function CellComponent({ cell, isSelected, isHighlighted, isDigitMatch, isConflict, isKillerMode, cageSum, onClick }: CellProps) {
  const { position, digit, isGiven, cornerNotes, centerNotes } = cell;
  const { row, col } = position;

  // Background color
  let bgColor: string;
  if (isSelected) bgColor = '#bfdbfe';       // blue-200
  else if (isConflict) bgColor = '#fee2e2';   // red-100
  else if (isDigitMatch) bgColor = '#dbeafe';  // blue-100
  else if (isHighlighted) bgColor = '#f1f5f9'; // slate-100
  else if (isGiven && !isKillerMode) bgColor = '#f8fafc'; // slate-50 for given cells in classic
  else bgColor = '#ffffff';

  // Digit color
  const digitColor = isConflict
    ? '#ef4444'    // red-500
    : isGiven
    ? '#1e293b'    // slate-800
    : '#3b82f6';   // blue-500

  // Border styles — inline to avoid Tailwind specificity issues
  const thinColor = isKillerMode ? THIN : MEDIUM;
  const thickColor = isKillerMode ? MEDIUM : THICK;

  const borderStyle: CSSProperties = {
    borderTop:    `${row % 3 === 0 ? 2 : 1}px solid ${row % 3 === 0 ? thickColor : thinColor}`,
    borderLeft:   `${col % 3 === 0 ? 2 : 1}px solid ${col % 3 === 0 ? thickColor : thinColor}`,
    borderRight:  col === 8 ? `2px solid ${thickColor}` : `1px solid ${thinColor}`,
    borderBottom: row === 8 ? `2px solid ${thickColor}` : `1px solid ${thinColor}`,
    backgroundColor: bgColor,
  };

  const sortedCornerNotes = [...cornerNotes].sort();
  const sortedCenterNotes = [...centerNotes].sort();

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
      {/* Killer cage sum label — rendered in DOM to avoid SVG overlap */}
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
      ) : (
        <>
          {/* Corner notes */}
          {sortedCornerNotes.map((d, i) => (
            <span
              key={`corner-${d}`}
              className={`
                absolute text-[clamp(0.4rem,1.8cqi,0.7rem)] text-slate-500
                leading-none ${CORNER_POSITIONS[i] ?? ''}
              `}
            >
              {d}
            </span>
          ))}

          {/* Center notes */}
          {sortedCenterNotes.length > 0 && (
            <span className="text-[clamp(0.4rem,1.8cqi,0.65rem)] text-blue-400 leading-none">
              {sortedCenterNotes.join('')}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export default memo(CellComponent);
