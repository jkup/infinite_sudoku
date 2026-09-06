import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react';
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
  const boardRef = useRef<HTMLDivElement>(null);
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
  }, [isKiller, puzzle, gridSize]);

  const selectedDigit = gridSize > 0 && selectedCell
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

  const handleFocus = (pos: CellPosition) => {
    selectCell(pos);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, pos: CellPosition) => {
    const max = gridSize - 1;
    let next: CellPosition | null = null;

    switch (event.key) {
      case 'ArrowUp': next = { row: Math.max(0, pos.row - 1), col: pos.col }; break;
      case 'ArrowDown': next = { row: Math.min(max, pos.row + 1), col: pos.col }; break;
      case 'ArrowLeft': next = { row: pos.row, col: Math.max(0, pos.col - 1) }; break;
      case 'ArrowRight': next = { row: pos.row, col: Math.min(max, pos.col + 1) }; break;
      case 'Home': next = event.ctrlKey ? { row: 0, col: 0 } : { row: pos.row, col: 0 }; break;
      case 'End': next = event.ctrlKey ? { row: max, col: max } : { row: pos.row, col: max }; break;
    }

    if (next) {
      event.preventDefault();
      event.stopPropagation();
      selectCell(next);
    }
  };

  useEffect(() => {
    if (!selectedCell || !boardRef.current?.contains(document.activeElement)) return;
    boardRef.current
      .querySelector<HTMLElement>(`[data-cell="${selectedCell.row},${selectedCell.col}"]`)
      ?.focus();
  }, [selectedCell]);

  if (grid.length === 0) return null;

  return (
    <div
      className="relative w-full max-w-[min(98vw,500px)] mx-auto"
      style={{ containerType: 'inline-size', border: '2px solid var(--color-board-border)', overflow: 'hidden' }}
    >
      <div
        ref={boardRef}
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
              isTabStop={isSelected || (selectedCell === null && row === 0 && col === 0)}
              isHighlighted={isHighlighted(row, col)}
              isDigitMatch={isDigitMatch(row, col)}
              isConflict={isConflict}
              isHintReveal={hintRevealCell !== null && hintRevealCell.row === row && hintRevealCell.col === col}
              isTutorialTarget={tutorialFocusSet !== null && cell.digit !== puzzle?.solution[row][col] && tutorialFocusSet.has(`${row},${col}`)}
              isKillerMode={!!isKiller}
              cageSum={cageLabels.get(`${row},${col}`) ?? null}
              gridSize={gridSize}
              onPointerDown={handlePointerDown}
              onFocus={handleFocus}
              onKeyDown={handleKeyDown}
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
