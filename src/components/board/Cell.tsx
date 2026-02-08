import { memo } from 'react';
import type { Cell as CellType, CellPosition } from '../../engine/types';

type CellProps = {
  cell: CellType;
  isSelected: boolean;
  isHighlighted: boolean;
  isDigitMatch: boolean;
  isConflict: boolean;
  isKillerMode: boolean;
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

function CellComponent({ cell, isSelected, isHighlighted, isDigitMatch, isConflict, isKillerMode, onClick }: CellProps) {
  const { position, digit, isGiven, cornerNotes, centerNotes } = cell;

  let bgClass = 'bg-white';
  if (isSelected) bgClass = 'bg-blue-200';
  else if (isConflict) bgClass = 'bg-red-100';
  else if (isDigitMatch) bgClass = 'bg-blue-100';
  else if (isHighlighted) bgClass = 'bg-slate-100';

  const digitColorClass = isConflict
    ? 'text-red-500'
    : isGiven
    ? 'text-slate-800'
    : 'text-blue-600';

  // In killer mode, use lighter internal borders so cage dashes stand out
  const borderColor = isKillerMode ? 'border-slate-200' : 'border-slate-300';
  const boxBorderColor = isKillerMode ? 'border-slate-400' : 'border-slate-800';

  const borderClasses = [
    borderColor,
    position.col % 3 === 0 ? `${boxBorderColor} border-l-2` : 'border-l',
    position.row % 3 === 0 ? `${boxBorderColor} border-t-2` : 'border-t',
    position.col === 8 ? `border-r-2 ${boxBorderColor}` : '',
    position.row === 8 ? `border-b-2 ${boxBorderColor}` : '',
  ].join(' ');

  const sortedCornerNotes = [...cornerNotes].sort();
  const sortedCenterNotes = [...centerNotes].sort();

  return (
    <div
      className={`
        relative flex items-center justify-center cursor-pointer select-none
        aspect-square ${bgClass} ${borderClasses}
        transition-colors duration-75
        active:bg-blue-300
      `}
      onClick={() => onClick(position)}
      role="gridcell"
      aria-label={`Row ${position.row + 1}, Column ${position.col + 1}${
        digit ? `, value ${digit}` : ', empty'
      }`}
    >
      {digit ? (
        <span
          className={`
            font-semibold ${digitColorClass}
            text-[clamp(1rem,4.5cqi,2.5rem)]
            leading-none
          `}
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
