import { type Digit, DIGITS, getBox } from './types';

/**
 * Technique levels used for difficulty classification.
 * A puzzle's difficulty = the hardest technique required to solve it.
 */
export const Technique = {
  NakedSingle: 1,      // Only one candidate left in a cell
  HiddenSingle: 2,     // Only one place for a digit in a row/col/box
  PointingPair: 3,     // Candidates in a box aligned in a row/col
  BoxLineReduction: 3, // Candidates in a row/col confined to one box
  NakedPair: 4,        // Two cells in a unit with same two candidates
  HiddenPair: 4,       // Two candidates only appear in two cells of a unit
  NakedTriple: 4,      // Three cells in a unit sharing three candidates
  XWing: 5,            // Two rows where a digit appears in exactly the same two columns
  Swordfish: 5,        // Three rows where a digit appears in same three columns
  YWing: 5,            // Bent triple chain elimination
} as const;

export type SolveResult = {
  solved: boolean;
  grid: (Digit | null)[][];
  maxTechnique: number; // Highest technique level used
  steps: number;        // Total logical deductions made
};

type Candidates = Set<Digit>[][];

function createCandidates(grid: (Digit | null)[][]): Candidates {
  const candidates: Candidates = Array.from({ length: 9 }, () =>
    Array.from({ length: 9 }, () => new Set<Digit>())
  );

  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] !== null) continue;
      for (const d of DIGITS) {
        if (isValidPlacement(grid, r, c, d)) {
          candidates[r][c].add(d);
        }
      }
    }
  }
  return candidates;
}

function isValidPlacement(
  grid: (Digit | null)[][],
  row: number,
  col: number,
  digit: Digit
): boolean {
  // Check row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === digit) return false;
  }
  // Check column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === digit) return false;
  }
  // Check box
  const boxR = Math.floor(row / 3) * 3;
  const boxC = Math.floor(col / 3) * 3;
  for (let r = boxR; r < boxR + 3; r++) {
    for (let c = boxC; c < boxC + 3; c++) {
      if (grid[r][c] === digit) return false;
    }
  }
  return true;
}

function placeDigit(
  grid: (Digit | null)[][],
  candidates: Candidates,
  row: number,
  col: number,
  digit: Digit
): void {
  grid[row][col] = digit;
  candidates[row][col].clear();

  // Remove from row
  for (let c = 0; c < 9; c++) candidates[row][c].delete(digit);
  // Remove from column
  for (let r = 0; r < 9; r++) candidates[r][col].delete(digit);
  // Remove from box
  const boxR = Math.floor(row / 3) * 3;
  const boxC = Math.floor(col / 3) * 3;
  for (let r = boxR; r < boxR + 3; r++) {
    for (let c = boxC; c < boxC + 3; c++) {
      candidates[r][c].delete(digit);
    }
  }
}

// --- Technique: Naked Singles ---
function nakedSingles(
  grid: (Digit | null)[][],
  candidates: Candidates
): boolean {
  let found = false;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === null && candidates[r][c].size === 1) {
        const digit = [...candidates[r][c]][0];
        placeDigit(grid, candidates, r, c, digit);
        found = true;
      }
    }
  }
  return found;
}

// --- Technique: Hidden Singles ---
function hiddenSingles(
  grid: (Digit | null)[][],
  candidates: Candidates
): boolean {
  let found = false;

  const tryUnit = (cells: [number, number][]) => {
    for (const d of DIGITS) {
      const positions = cells.filter(
        ([r, c]) => grid[r][c] === null && candidates[r][c].has(d)
      );
      if (positions.length === 1) {
        const [r, c] = positions[0];
        placeDigit(grid, candidates, r, c, d);
        found = true;
      }
    }
  };

  // Rows
  for (let r = 0; r < 9; r++) {
    tryUnit(Array.from({ length: 9 }, (_, c) => [r, c] as [number, number]));
  }
  // Columns
  for (let c = 0; c < 9; c++) {
    tryUnit(Array.from({ length: 9 }, (_, r) => [r, c] as [number, number]));
  }
  // Boxes
  for (let box = 0; box < 9; box++) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;
    const cells: [number, number][] = [];
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        cells.push([r, c]);
      }
    }
    tryUnit(cells);
  }

  return found;
}

// --- Technique: Pointing Pairs/Triples ---
function pointingPairs(candidates: Candidates): boolean {
  let found = false;

  for (let box = 0; box < 9; box++) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;

    for (const d of DIGITS) {
      const positions: [number, number][] = [];
      for (let r = br; r < br + 3; r++) {
        for (let c = bc; c < bc + 3; c++) {
          if (candidates[r][c].has(d)) positions.push([r, c]);
        }
      }

      if (positions.length < 2 || positions.length > 3) continue;

      // All in same row?
      const rows = new Set(positions.map(([r]) => r));
      if (rows.size === 1) {
        const row = [...rows][0];
        for (let c = 0; c < 9; c++) {
          if (c >= bc && c < bc + 3) continue;
          if (candidates[row][c].delete(d)) found = true;
        }
      }

      // All in same column?
      const cols = new Set(positions.map(([, c]) => c));
      if (cols.size === 1) {
        const col = [...cols][0];
        for (let r = 0; r < 9; r++) {
          if (r >= br && r < br + 3) continue;
          if (candidates[r][col].delete(d)) found = true;
        }
      }
    }
  }

  return found;
}

// --- Technique: Box/Line Reduction ---
function boxLineReduction(candidates: Candidates): boolean {
  let found = false;

  // Check rows
  for (let r = 0; r < 9; r++) {
    for (const d of DIGITS) {
      const cols = [];
      for (let c = 0; c < 9; c++) {
        if (candidates[r][c].has(d)) cols.push(c);
      }
      if (cols.length < 2 || cols.length > 3) continue;

      const boxes = new Set(cols.map((c) => getBox(r, c)));
      if (boxes.size === 1) {
        const boxR = Math.floor(r / 3) * 3;
        const boxC = Math.floor(cols[0] / 3) * 3;
        for (let br = boxR; br < boxR + 3; br++) {
          if (br === r) continue;
          for (let bc = boxC; bc < boxC + 3; bc++) {
            if (candidates[br][bc].delete(d)) found = true;
          }
        }
      }
    }
  }

  // Check columns
  for (let c = 0; c < 9; c++) {
    for (const d of DIGITS) {
      const rows = [];
      for (let r = 0; r < 9; r++) {
        if (candidates[r][c].has(d)) rows.push(r);
      }
      if (rows.length < 2 || rows.length > 3) continue;

      const boxes = new Set(rows.map((r) => getBox(r, c)));
      if (boxes.size === 1) {
        const boxR = Math.floor(rows[0] / 3) * 3;
        const boxC = Math.floor(c / 3) * 3;
        for (let bc = boxC; bc < boxC + 3; bc++) {
          if (bc === c) continue;
          for (let br = boxR; br < boxR + 3; br++) {
            if (candidates[br][bc].delete(d)) found = true;
          }
        }
      }
    }
  }

  return found;
}

// --- Technique: Naked Pairs ---
function nakedPairs(candidates: Candidates): boolean {
  let found = false;

  const processUnit = (cells: [number, number][]) => {
    const empties = cells.filter(([r, c]) => candidates[r][c].size === 2);

    for (let i = 0; i < empties.length; i++) {
      for (let j = i + 1; j < empties.length; j++) {
        const [r1, c1] = empties[i];
        const [r2, c2] = empties[j];
        const s1 = candidates[r1][c1];
        const s2 = candidates[r2][c2];

        // Check if same two candidates
        if (s1.size !== 2 || s2.size !== 2) continue;
        const a1 = [...s1];
        const a2 = [...s2];
        if (a1[0] !== a2[0] || a1[1] !== a2[1]) continue;

        // Remove these digits from other cells in the unit
        for (const [r, c] of cells) {
          if ((r === r1 && c === c1) || (r === r2 && c === c2)) continue;
          for (const d of a1) {
            if (candidates[r][c].delete(d as Digit)) found = true;
          }
        }
      }
    }
  };

  forEachUnit(processUnit);
  return found;
}

// --- Technique: Hidden Pairs ---
function hiddenPairs(candidates: Candidates): boolean {
  let found = false;

  const processUnit = (cells: [number, number][]) => {
    // For each pair of digits, check if they only appear in exactly 2 cells
    for (let i = 0; i < DIGITS.length; i++) {
      for (let j = i + 1; j < DIGITS.length; j++) {
        const d1 = DIGITS[i];
        const d2 = DIGITS[j];

        const positions = cells.filter(
          ([r, c]) => candidates[r][c].has(d1) || candidates[r][c].has(d2)
        );

        if (positions.length !== 2) continue;

        // Both digits must appear in both cells
        const [r1, c1] = positions[0];
        const [r2, c2] = positions[1];
        if (
          !candidates[r1][c1].has(d1) || !candidates[r1][c1].has(d2) ||
          !candidates[r2][c2].has(d1) || !candidates[r2][c2].has(d2)
        ) continue;

        // Remove all other candidates from these two cells
        for (const [r, c] of positions) {
          for (const d of [...candidates[r][c]]) {
            if (d !== d1 && d !== d2) {
              candidates[r][c].delete(d);
              found = true;
            }
          }
        }
      }
    }
  };

  forEachUnit(processUnit);
  return found;
}

// --- Technique: Naked Triples ---
function nakedTriples(candidates: Candidates): boolean {
  let found = false;

  const processUnit = (cells: [number, number][]) => {
    const empties = cells.filter(
      ([r, c]) => candidates[r][c].size >= 2 && candidates[r][c].size <= 3
    );

    for (let i = 0; i < empties.length; i++) {
      for (let j = i + 1; j < empties.length; j++) {
        for (let k = j + 1; k < empties.length; k++) {
          const trio = [empties[i], empties[j], empties[k]] as [number, number][];
          const union = new Set<Digit>();
          for (const [r, c] of trio) {
            for (const d of candidates[r][c]) union.add(d);
          }
          if (union.size !== 3) continue;

          for (const [r, c] of cells) {
            if (trio.some(([tr, tc]) => tr === r && tc === c)) continue;
            for (const d of union) {
              if (candidates[r][c].delete(d)) found = true;
            }
          }
        }
      }
    }
  };

  forEachUnit(processUnit);
  return found;
}

// --- Technique: X-Wing ---
function xWing(candidates: Candidates): boolean {
  let found = false;

  for (const d of DIGITS) {
    // Row-based X-Wing
    const rowPositions: number[][] = [];
    for (let r = 0; r < 9; r++) {
      const cols: number[] = [];
      for (let c = 0; c < 9; c++) {
        if (candidates[r][c].has(d)) cols.push(c);
      }
      rowPositions.push(cols);
    }

    for (let r1 = 0; r1 < 9; r1++) {
      if (rowPositions[r1].length !== 2) continue;
      for (let r2 = r1 + 1; r2 < 9; r2++) {
        if (rowPositions[r2].length !== 2) continue;
        if (
          rowPositions[r1][0] === rowPositions[r2][0] &&
          rowPositions[r1][1] === rowPositions[r2][1]
        ) {
          const [c1, c2] = rowPositions[r1];
          for (let r = 0; r < 9; r++) {
            if (r === r1 || r === r2) continue;
            if (candidates[r][c1].delete(d)) found = true;
            if (candidates[r][c2].delete(d)) found = true;
          }
        }
      }
    }

    // Column-based X-Wing
    const colPositions: number[][] = [];
    for (let c = 0; c < 9; c++) {
      const rows: number[] = [];
      for (let r = 0; r < 9; r++) {
        if (candidates[r][c].has(d)) rows.push(r);
      }
      colPositions.push(rows);
    }

    for (let c1 = 0; c1 < 9; c1++) {
      if (colPositions[c1].length !== 2) continue;
      for (let c2 = c1 + 1; c2 < 9; c2++) {
        if (colPositions[c2].length !== 2) continue;
        if (
          colPositions[c1][0] === colPositions[c2][0] &&
          colPositions[c1][1] === colPositions[c2][1]
        ) {
          const [r1, r2] = colPositions[c1];
          for (let c = 0; c < 9; c++) {
            if (c === c1 || c === c2) continue;
            if (candidates[r1][c].delete(d)) found = true;
            if (candidates[r2][c].delete(d)) found = true;
          }
        }
      }
    }
  }

  return found;
}

// --- Helper: iterate all units (rows, cols, boxes) ---
function forEachUnit(fn: (cells: [number, number][]) => void): void {
  for (let r = 0; r < 9; r++) {
    fn(Array.from({ length: 9 }, (_, c) => [r, c] as [number, number]));
  }
  for (let c = 0; c < 9; c++) {
    fn(Array.from({ length: 9 }, (_, r) => [r, c] as [number, number]));
  }
  for (let box = 0; box < 9; box++) {
    const br = Math.floor(box / 3) * 3;
    const bc = (box % 3) * 3;
    const cells: [number, number][] = [];
    for (let r = br; r < br + 3; r++) {
      for (let c = bc; c < bc + 3; c++) {
        cells.push([r, c]);
      }
    }
    fn(cells);
  }
}

/**
 * Solve a puzzle using human-style logic techniques.
 * Returns the result including the highest technique level required.
 */
export function solveWithLogic(
  puzzle: (Digit | null)[][],
  maxTechniqueLevel?: number,
): SolveResult {
  const grid = puzzle.map((row) => [...row]);
  const candidates = createCandidates(grid);
  let maxTechnique = 0;
  let steps = 0;

  const isSolved = () => grid.every((row) => row.every((cell) => cell !== null));
  const hasContradiction = () => {
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] === null && candidates[r][c].size === 0) return true;
      }
    }
    return false;
  };

  // Apply techniques in order of difficulty
  const allTechniques: [number, () => boolean][] = [
    [Technique.NakedSingle, () => nakedSingles(grid, candidates)],
    [Technique.HiddenSingle, () => hiddenSingles(grid, candidates)],
    [Technique.PointingPair, () => pointingPairs(candidates)],
    [Technique.BoxLineReduction, () => boxLineReduction(candidates)],
    [Technique.NakedPair, () => nakedPairs(candidates)],
    [Technique.HiddenPair, () => hiddenPairs(candidates)],
    [Technique.NakedTriple, () => nakedTriples(candidates)],
    [Technique.XWing, () => xWing(candidates)],
  ];
  const techniques = maxTechniqueLevel !== undefined
    ? allTechniques.filter(([level]) => level <= maxTechniqueLevel)
    : allTechniques;

  let progress = true;
  while (progress && !isSolved() && !hasContradiction()) {
    progress = false;
    for (const [level, technique] of techniques) {
      if (technique()) {
        maxTechnique = Math.max(maxTechnique, level);
        steps++;
        progress = true;
        break; // Restart from easiest technique
      }
    }
  }

  return { solved: isSolved(), grid, maxTechnique, steps };
}

/**
 * Brute-force solver using backtracking.
 * Used for generation and validation (checking unique solutions).
 */
export function solveBruteForce(
  puzzle: (Digit | null)[][],
  maxSolutions = 2
): Digit[][][] {
  const grid = puzzle.map((row) => [...row]) as (Digit | null)[][];
  const solutions: Digit[][][] = [];

  function solve(): boolean {
    // Find first empty cell
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (grid[r][c] !== null) continue;

        for (const d of DIGITS) {
          if (isValidPlacement(grid, r, c, d)) {
            grid[r][c] = d;
            if (solve()) return true;
            grid[r][c] = null;
          }
        }
        return false; // No valid digit found
      }
    }

    // No empty cells — solved
    solutions.push(grid.map((row) => [...row]) as Digit[][]);
    return solutions.length >= maxSolutions;
  }

  solve();
  return solutions;
}

/**
 * Check if a puzzle has exactly one solution.
 */
export function hasUniqueSolution(puzzle: (Digit | null)[][]): boolean {
  return solveBruteForce(puzzle, 2).length === 1;
}

/**
 * Map technique level to our difficulty names.
 */
export function techniqueToDifficulty(
  maxTechnique: number
): 'beginner' | 'easy' | 'medium' | 'hard' | 'expert' {
  if (maxTechnique <= Technique.NakedSingle) return 'beginner';
  if (maxTechnique <= Technique.HiddenSingle) return 'easy';
  if (maxTechnique <= Technique.BoxLineReduction) return 'medium';
  if (maxTechnique <= Technique.NakedTriple) return 'hard';
  return 'expert';
}
