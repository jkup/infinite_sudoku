import { useMemo } from 'react';
import { useGameStore } from '../../store/gameStore';
import { useHintStore } from '../../store/hintStore';
import { useTutorialStore, getTutorialById } from '../../store/tutorialStore';
import { usePreferencesStore } from '../../store/preferencesStore';
import { getBoxForSize } from '../../engine/types';
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
  const checkAnswers = usePreferencesStore((s) => s.checkAnswers);
  const hintRevealCell = useHintStore((s) => s.hintRevealCell);
  const tutorialPhase = useTutorialStore((s) => s.phase);
  const activeTutorialId = useTutorialStore((s) => s.activeTutorialId);
  const isInTutorialPractice = tutorialPhase === 'practice';

  // Build a set of focus cell keys for fast lookup during tutorial practice
  const tutorialFocusSet = useMemo(() => {
    if (!isInTutorialPractice || !activeTutorialId) return null;
    const tutorial = getTutorialById(activeTutorialId);
    if (!tutorial) return null;
    const set = new Set<string>();
    for (const fc of tutorial.focusCells) {
      set.add(`${fc.row},${fc.col}`);
    }
    return set;
  }, [isInTutorialPractice, activeTutorialId]);

  if (grid.length === 0) return null;

  const gridSize = grid.length;
  const isKiller = puzzle?.mode === 'killer' && puzzle.cages;

  // Pre-compute cage labels: Map<"row,col", sum>
  const cageLabels = useMemo(() => {
    const labels = new Map<string, number>();
    if (!isKiller || !puzzle?.cages) return labels;
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        const sum = isCageLabelCell(puzzle.cages, r, c);
        if (sum !== null) {
          labels.set(`${r},${c}`, sum);
        }
      }
    }
    return labels;
  }, [isKiller, puzzle?.cages, gridSize]);

  const selectedDigit = selectedCell
    ? grid[selectedCell.row][selectedCell.col].digit
    : null;

  const isHighlighted = (row: number, col: number): boolean => {
    if (!selectedCell) return false;
    if (row === selectedCell.row && col === selectedCell.col) return false;
    return (
      row === selectedCell.row ||
      col === selectedCell.col ||
      getBoxForSize(row, col, gridSize) === getBoxForSize(selectedCell.row, selectedCell.col, gridSize)
    );
  };

  const isDigitMatch = (row: number, col: number): boolean => {
    if (!selectedDigit) return false;
    const cell = grid[row][col];
    if (row === selectedCell!.row && col === selectedCell!.col) return false;
    return cell.digit === selectedDigit;
  };

  const handlePointerDown = (pos: CellPosition) => {
    selectCell(pos);
  };

  return (
    <div
      className="relative w-full max-w-[min(98vw,500px)] mx-auto"
      style={{ containerType: 'inline-size', border: '2px solid var(--color-board-border)', overflow: 'hidden' }}
    >
      <div
        className="grid"
        style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
        role="grid"
        aria-label="Sudoku board"
      >
        {grid.flat().map((cell) => {
          const { row, col } = cell.position;
          const key = `${row}-${col}`;
          const hasConflict = conflicts.has(`${row},${col}`);
          const wrongAnswer = checkAnswers && cell.digit !== null && puzzle?.solution[row][col] !== cell.digit;
          const isConflict = hasConflict || !!wrongAnswer;
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
              isConflict={isConflict}
              isHintReveal={hintRevealCell !== null && hintRevealCell.row === row && hintRevealCell.col === col}
              isTutorialTarget={tutorialFocusSet !== null && cell.digit === null && tutorialFocusSet.has(`${row},${col}`)}
              isKillerMode={!!isKiller}
              cageSum={cageLabels.get(`${row},${col}`) ?? null}
              gridSize={gridSize}
              onPointerDown={handlePointerDown}
            />
          );
        })}
      </div>
      {isKiller && puzzle.cages && (
        <CageOverlay cages={puzzle.cages} gridSize={gridSize} />
      )}
    </div>
  );
}
