import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { getBox } from '../../engine/types';
import type { CellPosition } from '../../engine/types';
import { isCageLabelCell } from '../../engine/killer';
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

  // Pre-compute cage labels: Map<"row,col", sum>
  const cageLabels = useMemo(() => {
    const labels = new Map<string, number>();
    if (!isKiller || !puzzle?.cages) return labels;
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const sum = isCageLabelCell(puzzle.cages, r, c);
        if (sum !== null) {
          labels.set(`${r},${c}`, sum);
        }
      }
    }
    return labels;
  }, [isKiller, puzzle?.cages]);

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
      className="relative w-full max-w-[min(95vw,500px)] mx-auto"
      style={{ containerType: 'inline-size' }}
    >
      <div
        className="grid grid-cols-9"
        role="grid"
        aria-label="Sudoku board"
        style={{ border: '2px solid var(--color-board-border)' }}
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
              cageSum={cageLabels.get(`${row},${col}`) ?? null}
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
