import type { Digit, Grid, CellPosition } from './types';
import { getBoxDimensions } from './types';

export type Conflict = {
  position: CellPosition;
  conflictsWith: CellPosition[];
};

/**
 * Find all conflicting cells in the grid.
 * A conflict is when two cells in the same row, column, or box
 * have the same digit (and at least one is not a given — both can be player-placed).
 */
export function findConflicts(grid: Grid): Map<string, CellPosition[]> {
  const conflicts = new Map<string, CellPosition[]>();
  const size = grid.length;
  const key = (r: number, c: number) => `${r},${c}`;

  function checkPair(r1: number, c1: number, r2: number, c2: number) {
    const d1 = grid[r1][c1].digit;
    const d2 = grid[r2][c2].digit;
    if (d1 === null || d2 === null || d1 !== d2) return;

    const k1 = key(r1, c1);
    const k2 = key(r2, c2);
    if (!conflicts.has(k1)) conflicts.set(k1, []);
    if (!conflicts.has(k2)) conflicts.set(k2, []);
    conflicts.get(k1)!.push({ row: r2, col: c2 });
    conflicts.get(k2)!.push({ row: r1, col: c1 });
  }

  // Check rows
  for (let r = 0; r < size; r++) {
    for (let c1 = 0; c1 < size; c1++) {
      for (let c2 = c1 + 1; c2 < size; c2++) {
        checkPair(r, c1, r, c2);
      }
    }
  }

  // Check columns
  for (let c = 0; c < size; c++) {
    for (let r1 = 0; r1 < size; r1++) {
      for (let r2 = r1 + 1; r2 < size; r2++) {
        checkPair(r1, c, r2, c);
      }
    }
  }

  // Check boxes
  const { boxRows, boxCols } = getBoxDimensions(size);
  const boxesPerRow = size / boxCols;
  const numBoxes = size * size / (boxRows * boxCols);
  for (let box = 0; box < numBoxes; box++) {
    const br = Math.floor(box / boxesPerRow) * boxRows;
    const bc = (box % boxesPerRow) * boxCols;
    const cells: [number, number][] = [];
    for (let r = br; r < br + boxRows; r++) {
      for (let c = bc; c < bc + boxCols; c++) {
        cells.push([r, c]);
      }
    }
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const [r1, c1] = cells[i];
        const [r2, c2] = cells[j];
        // Skip if already checked via row/col
        if (r1 === r2 || c1 === c2) continue;
        checkPair(r1, c1, r2, c2);
      }
    }
  }

  return conflicts;
}

/**
 * Get all cells that "see" a given position (same row, column, or box).
 */
export function getPeers(row: number, col: number, gridSize: number = 9): CellPosition[] {
  const peers: CellPosition[] = [];
  const seen = new Set<string>();
  const key = (r: number, c: number) => `${r},${c}`;

  seen.add(key(row, col));

  // Same row
  for (let c = 0; c < gridSize; c++) {
    const k = key(row, c);
    if (!seen.has(k)) {
      seen.add(k);
      peers.push({ row, col: c });
    }
  }

  // Same column
  for (let r = 0; r < gridSize; r++) {
    const k = key(r, col);
    if (!seen.has(k)) {
      seen.add(k);
      peers.push({ row: r, col });
    }
  }

  // Same box
  const { boxRows, boxCols } = getBoxDimensions(gridSize);
  const boxR = Math.floor(row / boxRows) * boxRows;
  const boxC = Math.floor(col / boxCols) * boxCols;
  for (let r = boxR; r < boxR + boxRows; r++) {
    for (let c = boxC; c < boxC + boxCols; c++) {
      const k = key(r, c);
      if (!seen.has(k)) {
        seen.add(k);
        peers.push({ row: r, col: c });
      }
    }
  }

  return peers;
}

/**
 * Check if the grid is completely and correctly solved.
 */
export function isGridComplete(grid: Grid): boolean {
  const size = grid.length;
  // All cells filled
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c].digit === null) return false;
    }
  }

  // No conflicts
  return findConflicts(grid).size === 0;
}

/**
 * Count how many of each digit have been placed.
 * Returns a map from digit to count (0-9).
 */
export function getDigitCounts(grid: Grid): Map<Digit, number> {
  const size = grid.length;
  const counts = new Map<Digit, number>();
  for (let d = 1; d <= size; d++) {
    counts.set(d as Digit, 0);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const d = grid[r][c].digit;
      if (d !== null) {
        counts.set(d, counts.get(d)! + 1);
      }
    }
  }
  return counts;
}
