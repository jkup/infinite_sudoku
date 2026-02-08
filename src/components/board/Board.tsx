import { useGameStore } from '../../store/gameStore';
import { getBox } from '../../engine/types';
import type { CellPosition } from '../../engine/types';
import Cell from './Cell';
import CageOverlay from './CageOverlay';

export default function Board() {
  const grid = useGameStore((s) => s.grid);
  const selectedCell = useGameStore((s) => s.selectedCell);
  const conflicts = useGameStore((s) => s.conflicts);
  const selectCell = useGameStore((s) => s.selectCell);
  const puzzle = useGameStore((s) => s.puzzle);

  if (grid.length === 0) return null;

  const isKiller = puzzle?.mode === 'killer' && puzzle.cages;

  const selectedDigit = selectedCell
    ? grid[selectedCell.row][selectedCell.col].digit
    : null;

  const isHighlighted = (row: number, col: number): boolean => {
    if (!selectedCell) return false;
    if (row === selectedCell.row && col === selectedCell.col) return false;
    return (
      row === selectedCell.row ||
      col === selectedCell.col ||
      getBox(row, col) === getBox(selectedCell.row, selectedCell.col)
    );
  };

  const isDigitMatch = (row: number, col: number): boolean => {
    if (!selectedDigit) return false;
    const cell = grid[row][col];
    if (row === selectedCell!.row && col === selectedCell!.col) return false;
    return cell.digit === selectedDigit;
  };

  const handleClick = (pos: CellPosition) => {
    selectCell(pos);
  };

  return (
    <div
      className="relative w-full max-w-[min(90vw,500px)] mx-auto"
      style={{ containerType: 'inline-size' }}
    >
      <div
        className="grid grid-cols-9"
        role="grid"
        aria-label="Sudoku board"
      >
        {grid.flat().map((cell) => {
          const { row, col } = cell.position;
          const key = `${row}-${col}`;
          const isConflict = conflicts.has(`${row},${col}`);
          const isSelected =
            selectedCell !== null &&
            selectedCell.row === row &&
            selectedCell.col === col;

          return (
            <Cell
              key={key}
              cell={cell}
              isSelected={isSelected}
              isHighlighted={isHighlighted(row, col)}
              isDigitMatch={isDigitMatch(row, col)}
              isConflict={isConflict && !isSelected}
              isKillerMode={!!isKiller}
              onClick={handleClick}
            />
          );
        })}
      </div>
      {isKiller && puzzle.cages && (
        <CageOverlay cages={puzzle.cages} />
      )}
    </div>
  );
}
