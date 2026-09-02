import { describe, expect, it } from 'vitest';
import { generateCages, getCageBorders, isCageLabelCell, validateKillerPlacement } from './killer';
import type { Cage, Digit } from './types';

const SOLUTION = Array.from({ length: 9 }, (_, row) =>
  Array.from({ length: 9 }, (_, col) => ((row * 3 + Math.floor(row / 3) + col) % 9 + 1) as Digit),
);

describe('killer Sudoku helpers', () => {
  it('generates connected cages that cover every cell exactly once with correct sums', () => {
    const cages = generateCages(SOLUTION, 'medium');
    const cells = cages.flatMap((cage) => cage.cells);

    expect(cells).toHaveLength(81);
    expect(new Set(cells.map(({ row, col }) => `${row},${col}`)).size).toBe(81);

    for (const cage of cages) {
      expect(cage.sum).toBe(cage.cells.reduce((sum, { row, col }) => sum + SOLUTION[row][col], 0));
      const reached = new Set([`${cage.cells[0].row},${cage.cells[0].col}`]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const cell of cage.cells) {
          const key = `${cell.row},${cell.col}`;
          if (reached.has(key)) continue;
          if ([[-1, 0], [1, 0], [0, -1], [0, 1]].some(([dr, dc]) => reached.has(`${cell.row + dr},${cell.col + dc}`))) {
            reached.add(key);
            changed = true;
          }
        }
      }
      expect(reached.size).toBe(cage.cells.length);
    }
  });

  it('rejects duplicate digits, excessive sums, and incorrect completed sums', () => {
    const cages: Cage[] = [{ sum: 6, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }];
    const grid = Array.from({ length: 9 }, () => Array<Digit | null>(9).fill(null));

    grid[0][1] = 2;
    expect(validateKillerPlacement(grid, cages, 0, 0, 2).valid).toBe(false);
    expect(validateKillerPlacement(grid, cages, 0, 0, 5).reason).toBe('Exceeds cage sum');
    expect(validateKillerPlacement(grid, cages, 0, 0, 3).reason).toBe('Cage sum does not match');
    expect(validateKillerPlacement(grid, cages, 0, 0, 4).valid).toBe(true);
  });

  it('locates label cells and cage boundaries', () => {
    const cages: Cage[] = [{ sum: 3, cells: [{ row: 0, col: 0 }, { row: 0, col: 1 }] }];
    expect(isCageLabelCell(cages, 0, 0)).toBe(3);
    expect(isCageLabelCell(cages, 0, 1)).toBeNull();
    expect(getCageBorders(cages, 0, 0)).toEqual({ top: true, right: false, bottom: true, left: true });
  });
});
