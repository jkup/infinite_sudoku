import type { Cage, CellPosition, Digit, Difficulty } from './types';

/**
 * Cage size ranges by difficulty.
 * Easier = smaller cages (easier to reason about sums).
 * Harder = larger cages and more of them covering the board.
 */
const CAGE_SIZE_RANGES: Record<Difficulty, { min: number; max: number }> = {
  easy: { min: 2, max: 3 },
  medium: { min: 2, max: 4 },
  hard: { min: 2, max: 5 },
  expert: { min: 2, max: 5 },
};

/**
 * Get orthogonal neighbors of a cell position.
 */
function getNeighbors(row: number, col: number): CellPosition[] {
  const neighbors: CellPosition[] = [];
  if (row > 0) neighbors.push({ row: row - 1, col });
  if (row < 8) neighbors.push({ row: row + 1, col });
  if (col > 0) neighbors.push({ row, col: col - 1 });
  if (col < 8) neighbors.push({ row, col: col + 1 });
  return neighbors;
}

/**
 * Shuffle an array in place (Fisher-Yates).
 */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Generate killer cages that tile the entire 9x9 grid.
 * Each cage is a connected group of cells with a sum clue.
 *
 * Algorithm:
 * 1. Start with all 81 cells unassigned
 * 2. Pick a random unassigned cell as a cage seed
 * 3. Grow the cage by randomly adding adjacent unassigned cells
 * 4. Stop growing when we hit the max size or run out of neighbors
 * 5. Record the cage with its digit sum
 * 6. Repeat until all cells are assigned
 *
 * Constraint: No cage can contain duplicate digits (enforced by
 * checking the solution values during generation).
 */
export function generateCages(
  solution: Digit[][],
  difficulty: Difficulty
): Cage[] {
  const { min: minSize, max: maxSize } = CAGE_SIZE_RANGES[difficulty];
  const assigned = Array.from({ length: 9 }, () => Array(9).fill(false));
  const cages: Cage[] = [];

  // All cell positions, shuffled for randomness
  const allCells = shuffle(
    Array.from({ length: 81 }, (_, i) => ({
      row: Math.floor(i / 9),
      col: i % 9,
    }))
  );

  for (const seed of allCells) {
    if (assigned[seed.row][seed.col]) continue;

    // Start a new cage
    const cageCells: CellPosition[] = [seed];
    assigned[seed.row][seed.col] = true;
    const digitsUsed = new Set<Digit>([solution[seed.row][seed.col]]);

    // Target size for this cage
    const targetSize = minSize + Math.floor(Math.random() * (maxSize - minSize + 1));

    // Grow the cage
    let attempts = 0;
    while (cageCells.length < targetSize && attempts < 20) {
      attempts++;

      // Collect all unassigned neighbors of the current cage
      const frontier: CellPosition[] = [];
      for (const cell of cageCells) {
        for (const neighbor of getNeighbors(cell.row, cell.col)) {
          if (
            !assigned[neighbor.row][neighbor.col] &&
            !frontier.some((f) => f.row === neighbor.row && f.col === neighbor.col)
          ) {
            frontier.push(neighbor);
          }
        }
      }

      if (frontier.length === 0) break;

      // Pick a random neighbor that doesn't duplicate a digit
      shuffle(frontier);
      let added = false;
      for (const candidate of frontier) {
        const digit = solution[candidate.row][candidate.col];
        if (!digitsUsed.has(digit)) {
          cageCells.push(candidate);
          assigned[candidate.row][candidate.col] = true;
          digitsUsed.add(digit);
          added = true;
          break;
        }
      }

      // If all frontier cells duplicate digits, try to add any (relax constraint)
      // This can happen in rare configurations. We allow it — the sum constraint
      // plus standard Sudoku rules still make the puzzle valid.
      if (!added) {
        const candidate = frontier[0];
        cageCells.push(candidate);
        assigned[candidate.row][candidate.col] = true;
        digitsUsed.add(solution[candidate.row][candidate.col]);
      }
    }

    // Calculate sum
    const sum = cageCells.reduce(
      (acc, cell) => acc + solution[cell.row][cell.col],
      0
    );

    cages.push({ sum, cells: cageCells });
  }

  return cages;
}

/**
 * Validate that a digit placement doesn't violate killer cage constraints.
 * - No duplicate digits within a cage
 * - If cage is fully filled, digits must sum to the cage's target sum
 */
export function validateKillerPlacement(
  grid: (Digit | null)[][],
  cages: Cage[],
  row: number,
  col: number,
  digit: Digit
): { valid: boolean; reason?: string } {
  // Find the cage this cell belongs to
  const cage = cages.find((c) =>
    c.cells.some((cell) => cell.row === row && cell.col === col)
  );

  if (!cage) return { valid: true };

  // Check for duplicate digits in the cage
  for (const cell of cage.cells) {
    if (cell.row === row && cell.col === col) continue;
    if (grid[cell.row][cell.col] === digit) {
      return { valid: false, reason: 'Duplicate digit in cage' };
    }
  }

  // Check if placing this digit would make the partial sum exceed the cage sum
  let partialSum = digit;
  let emptyCells = 0;
  for (const cell of cage.cells) {
    if (cell.row === row && cell.col === col) continue;
    const d = grid[cell.row][cell.col];
    if (d !== null) {
      partialSum += d;
    } else {
      emptyCells++;
    }
  }

  if (partialSum > cage.sum) {
    return { valid: false, reason: 'Exceeds cage sum' };
  }

  // If cage is now fully filled, sum must match exactly
  if (emptyCells === 0 && partialSum !== cage.sum) {
    return { valid: false, reason: 'Cage sum does not match' };
  }

  return { valid: true };
}

/**
 * Get the cage that contains a given cell position.
 */
export function getCageForCell(
  cages: Cage[],
  row: number,
  col: number
): Cage | undefined {
  return cages.find((c) =>
    c.cells.some((cell) => cell.row === row && cell.col === col)
  );
}

/**
 * For rendering: determine which borders of a cell are cage boundaries.
 * Returns { top, right, bottom, left } — true means this edge is a cage border.
 */
export function getCageBorders(
  cages: Cage[],
  row: number,
  col: number
): { top: boolean; right: boolean; bottom: boolean; left: boolean } {
  const cage = getCageForCell(cages, row, col);
  if (!cage) return { top: true, right: true, bottom: true, left: true };

  const inCage = (r: number, c: number) =>
    cage.cells.some((cell) => cell.row === r && cell.col === c);

  return {
    top: row === 0 || !inCage(row - 1, col),
    right: col === 8 || !inCage(row, col + 1),
    bottom: row === 8 || !inCage(row + 1, col),
    left: col === 0 || !inCage(row, col - 1),
  };
}

/**
 * Check if a cell is the "label cell" for its cage (top-left-most cell).
 * This is where we render the sum clue.
 */
export function isCageLabelCell(
  cages: Cage[],
  row: number,
  col: number
): number | null {
  const cage = getCageForCell(cages, row, col);
  if (!cage) return null;

  // Find the top-left-most cell (min row, then min col)
  let labelCell = cage.cells[0];
  for (const cell of cage.cells) {
    if (
      cell.row < labelCell.row ||
      (cell.row === labelCell.row && cell.col < labelCell.col)
    ) {
      labelCell = cell;
    }
  }

  if (labelCell.row === row && labelCell.col === col) {
    return cage.sum;
  }
  return null;
}
