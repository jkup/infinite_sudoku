import type { Digit, Puzzle } from '../engine/types';

export type HighlightColor = 'primary' | 'secondary' | 'target';

export type TutorialCellHighlight = {
  row: number;
  col: number;
  color: HighlightColor;
};

export type TutorialNoteOverride = {
  row: number;
  col: number;
  notes: Digit[];
};

export type TutorialDefinition = {
  id: string;
  level: number;
  name: string;
  difficulty: string;
  explanation: string[];
  lessonBoard: (Digit | null)[][];
  highlightCells: TutorialCellHighlight[];
  highlightNotes?: TutorialNoteOverride[];
  practicePuzzle: Puzzle;
};

// Helper to build a 9x9 grid from row strings (0 = null, 1-9 = digit)
function grid(rows: string[]): (Digit | null)[][] {
  return rows.map((row) =>
    row.split('').map((ch) => {
      const n = Number(ch);
      return n === 0 ? null : (n as Digit);
    })
  );
}

/**
 * All 8 tutorials ordered by technique level.
 * Each has a lesson board illustrating the technique and a practice puzzle.
 */
export const TUTORIALS: TutorialDefinition[] = [
  // ─────────────────────────────────────────────
  // 1. Naked Single (level 1, Beginner)
  // ─────────────────────────────────────────────
  {
    id: 'naked-single',
    level: 1,
    name: 'Naked Single',
    difficulty: 'Beginner',
    explanation: [
      'A Naked Single occurs when a cell has only one possible candidate left. After eliminating all digits that appear in the same row, column, and box, only one digit remains.',
      'Look at the highlighted cell. Its row already contains 1, 2, 3, 5, 6, 7, 8. Its column and box eliminate 4. The only remaining candidate is 9 — so it must be 9!',
      'This is the most fundamental solving technique. Always start by scanning for cells where all but one candidate has been eliminated.',
    ],
    lessonBoard: grid([
      '534678912',
      '672195348',
      '198342567',
      '859761423',
      '426853791',
      '713924856',
      '961537284',
      '287419635',
      '345286170',
    ]),
    highlightCells: [
      { row: 8, col: 8, color: 'target' },
      // Row peers
      { row: 8, col: 0, color: 'secondary' },
      { row: 8, col: 1, color: 'secondary' },
      { row: 8, col: 2, color: 'secondary' },
      { row: 8, col: 3, color: 'secondary' },
      { row: 8, col: 4, color: 'secondary' },
      { row: 8, col: 5, color: 'secondary' },
      { row: 8, col: 6, color: 'secondary' },
      { row: 8, col: 7, color: 'secondary' },
    ],
    highlightNotes: [{ row: 8, col: 8, notes: [9] }],
    practicePuzzle: {
      initial: grid([
        '534678012',
        '672195348',
        '198342567',
        '859761423',
        '426853791',
        '713924856',
        '961537284',
        '287419635',
        '345286170',
      ]),
      solution: grid([
        '534678912',
        '672195348',
        '198342567',
        '859761423',
        '426853791',
        '713924856',
        '961537284',
        '287419635',
        '345286179',
      ]) as Digit[][],
      difficulty: 'beginner',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 2. Hidden Single (level 2, Easy)
  // ─────────────────────────────────────────────
  {
    id: 'hidden-single',
    level: 2,
    name: 'Hidden Single',
    difficulty: 'Easy',
    explanation: [
      'A Hidden Single is when a digit can only go in one place within a row, column, or box — even though that cell might have other candidates too.',
      'In the highlighted box, digit 5 can only go in the target cell. The other empty cells in the box are blocked from containing 5 by digits in their rows or columns.',
      'Unlike Naked Singles where you eliminate candidates from one cell, Hidden Singles require scanning an entire unit (row, column, or box) to find where a specific digit must go.',
    ],
    lessonBoard: grid([
      '913006470',
      '600931005',
      '005740931',
      '108009340',
      '340010809',
      '009304010',
      '091400503',
      '500193064',
      '034065190',
    ]),
    highlightCells: [
      { row: 0, col: 4, color: 'target' },
      // Box 1 peers (top-middle box: rows 0-2, cols 3-5)
      { row: 0, col: 3, color: 'primary' },
      { row: 0, col: 5, color: 'primary' },
      { row: 1, col: 3, color: 'primary' },
      { row: 1, col: 4, color: 'primary' },
      { row: 1, col: 5, color: 'primary' },
      { row: 2, col: 3, color: 'primary' },
      { row: 2, col: 4, color: 'primary' },
      { row: 2, col: 5, color: 'primary' },
    ],
    highlightNotes: [{ row: 0, col: 4, notes: [2, 5, 8] }],
    practicePuzzle: {
      initial: grid([
        '913000470',
        '600931005',
        '005740931',
        '108009340',
        '340010809',
        '009304010',
        '091400503',
        '500193064',
        '034065190',
      ]),
      solution: grid([
        '913856472',
        '672931845',
        '845742931',
        '168279346',
        '346518829',
        '529364718',
        '291487563',
        '587193264',
        '734625191',
      ]) as Digit[][],
      difficulty: 'easy',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 3. Pointing Pair (level 3, Medium)
  // ─────────────────────────────────────────────
  {
    id: 'pointing-pair',
    level: 3,
    name: 'Pointing Pair',
    difficulty: 'Medium',
    explanation: [
      'A Pointing Pair (or Triple) happens when all candidates for a digit within a box are aligned in a single row or column.',
      'Since that digit must go somewhere in the box, and the only options are in one row/column, you can eliminate that digit from other cells in the same row/column outside the box.',
      'Look at the primary-highlighted cells in the box — they are the only places where that digit can go, and they share a row. The secondary cells show where candidates get eliminated.',
    ],
    lessonBoard: grid([
      '020000070',
      '600020800',
      '070600020',
      '800070060',
      '050800040',
      '040050003',
      '090003050',
      '002080006',
      '060000090',
    ]),
    highlightCells: [
      { row: 0, col: 1, color: 'primary' },
      { row: 0, col: 2, color: 'primary' },
      { row: 0, col: 3, color: 'secondary' },
      { row: 0, col: 4, color: 'secondary' },
      { row: 0, col: 5, color: 'secondary' },
      { row: 0, col: 7, color: 'secondary' },
    ],
    highlightNotes: [
      { row: 0, col: 1, notes: [3, 4, 8] },
      { row: 0, col: 2, notes: [1, 3, 4, 8] },
    ],
    practicePuzzle: {
      initial: grid([
        '020000070',
        '600020800',
        '070600020',
        '800070060',
        '050800040',
        '040050003',
        '090003050',
        '002080006',
        '060000090',
      ]),
      solution: grid([
        '821549376',
        '634721859',
        '975638124',
        '813974562',
        '356812947',
        '247356813',
        '498263751',
        '572184636',
        '163497298',
      ]) as Digit[][],
      difficulty: 'medium',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 4. Box/Line Reduction (level 3, Medium)
  // ─────────────────────────────────────────────
  {
    id: 'box-line-reduction',
    level: 3,
    name: 'Box/Line Reduction',
    difficulty: 'Medium',
    explanation: [
      'Box/Line Reduction is the reverse of Pointing Pairs. When all candidates for a digit in a row or column fall within a single box, you can eliminate that digit from other cells in that box.',
      'If digit X in row 4 can only appear in columns 3-5 (all within one box), then X cannot appear anywhere else in that box.',
      'This technique and Pointing Pairs are two sides of the same coin — one restricts a row/column based on a box, the other restricts a box based on a row/column.',
    ],
    lessonBoard: grid([
      '900084060',
      '006930500',
      '040506009',
      '060850040',
      '004060800',
      '050049060',
      '400608090',
      '005090400',
      '090340005',
    ]),
    highlightCells: [
      { row: 4, col: 3, color: 'primary' },
      { row: 4, col: 5, color: 'primary' },
      // Other cells in the box that get eliminations
      { row: 3, col: 3, color: 'secondary' },
      { row: 3, col: 4, color: 'secondary' },
      { row: 3, col: 5, color: 'secondary' },
      { row: 5, col: 4, color: 'secondary' },
    ],
    practicePuzzle: {
      initial: grid([
        '900084060',
        '006930500',
        '040506009',
        '060850040',
        '004060800',
        '050049060',
        '400608090',
        '005090400',
        '090340005',
      ]),
      solution: grid([
        '951284367',
        '876931542',
        '342576189',
        '763852941',
        '294167853',
        '185449276',
        '437628591',
        '625791438',
        '918345625',
      ]) as Digit[][],
      difficulty: 'medium',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 5. Naked Pair (level 4, Hard)
  // ─────────────────────────────────────────────
  {
    id: 'naked-pair',
    level: 4,
    name: 'Naked Pair',
    difficulty: 'Hard',
    explanation: [
      'A Naked Pair occurs when two cells in the same unit (row, column, or box) have exactly the same two candidates and no others.',
      'Since one of the pair must be one value and the other must be the second value, you can eliminate both candidates from all other cells in that unit.',
      'The two primary-highlighted cells both contain only candidates {4, 7}. One will be 4 and the other 7, so no other cell in their shared unit can contain 4 or 7.',
    ],
    lessonBoard: grid([
      '012000534',
      '000012000',
      '000534012',
      '020000153',
      '000020000',
      '153000020',
      '034000201',
      '000034000',
      '201000034',
    ]),
    highlightCells: [
      { row: 1, col: 0, color: 'primary' },
      { row: 1, col: 2, color: 'primary' },
      { row: 1, col: 1, color: 'secondary' },
      { row: 1, col: 3, color: 'secondary' },
      { row: 1, col: 4, color: 'secondary' },
      { row: 1, col: 5, color: 'secondary' },
    ],
    highlightNotes: [
      { row: 1, col: 0, notes: [6, 7] },
      { row: 1, col: 2, notes: [6, 7] },
    ],
    practicePuzzle: {
      initial: grid([
        '012000534',
        '000012000',
        '000534012',
        '020000153',
        '000020000',
        '153000020',
        '034000201',
        '000034000',
        '201000034',
      ]),
      solution: grid([
        '612879534',
        '879612345',
        '345534612',
        '428967153',
        '967128345',
        '153345928',
        '534896271',
        '896234517',
        '271451834',
      ]) as Digit[][],
      difficulty: 'hard',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 6. Hidden Pair (level 4, Hard)
  // ─────────────────────────────────────────────
  {
    id: 'hidden-pair',
    level: 4,
    name: 'Hidden Pair',
    difficulty: 'Hard',
    explanation: [
      'A Hidden Pair occurs when two digits can only appear in exactly two cells within a unit. Those two cells may have other candidates, but you can remove all candidates except the pair.',
      'Unlike a Naked Pair (where the pair is obvious), a Hidden Pair is "hidden" among other candidates in the cells.',
      'In the highlighted unit, digits 3 and 7 only appear as candidates in the two primary cells. Even though those cells have other candidates too, you can remove everything except 3 and 7 from them.',
    ],
    lessonBoard: grid([
      '049002010',
      '070040592',
      '120970400',
      '700090004',
      '000407000',
      '400010009',
      '004720081',
      '217080040',
      '080400270',
    ]),
    highlightCells: [
      { row: 3, col: 1, color: 'primary' },
      { row: 5, col: 1, color: 'primary' },
      { row: 4, col: 1, color: 'secondary' },
    ],
    highlightNotes: [
      { row: 3, col: 1, notes: [3, 5, 6, 8] },
      { row: 5, col: 1, notes: [3, 5, 6, 8] },
      { row: 4, col: 1, notes: [1, 5, 6, 8, 9] },
    ],
    practicePuzzle: {
      initial: grid([
        '049002010',
        '070040592',
        '120970400',
        '700090004',
        '000407000',
        '400010009',
        '004720081',
        '217080040',
        '080400270',
      ]),
      solution: grid([
        '549832716',
        '876145932',
        '123976458',
        '718293564',
        '962457183',
        '435618729',
        '654729381',
        '217863945',
        '389541276',
      ]) as Digit[][],
      difficulty: 'hard',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 7. Naked Triple (level 4, Hard)
  // ─────────────────────────────────────────────
  {
    id: 'naked-triple',
    level: 4,
    name: 'Naked Triple',
    difficulty: 'Hard',
    explanation: [
      'A Naked Triple extends the Naked Pair concept to three cells. Three cells in a unit that together contain exactly three different candidates form a Naked Triple.',
      'Important: each cell does not need all three candidates! For example, cells with {2,5}, {2,9}, and {5,9} form a valid triple of {2,5,9}.',
      'You can eliminate all three candidates from other cells in the same unit, because those three values must fill the three cells of the triple.',
    ],
    lessonBoard: grid([
      '980300100',
      '602089050',
      '001060920',
      '096520003',
      '050003296',
      '023096510',
      '069035801',
      '015908060',
      '008010039',
    ]),
    highlightCells: [
      { row: 0, col: 3, color: 'primary' },
      { row: 0, col: 5, color: 'primary' },
      { row: 0, col: 7, color: 'primary' },
      { row: 0, col: 2, color: 'secondary' },
      { row: 0, col: 8, color: 'secondary' },
    ],
    highlightNotes: [
      { row: 0, col: 3, notes: [4, 7] },
      { row: 0, col: 5, notes: [4, 5] },
      { row: 0, col: 7, notes: [4, 5, 7] },
    ],
    practicePuzzle: {
      initial: grid([
        '980300100',
        '602089050',
        '001060920',
        '096520003',
        '050003296',
        '023096510',
        '069035801',
        '015908060',
        '008010039',
      ]),
      solution: grid([
        '984375162',
        '632189457',
        '571264928',
        '896527413',
        '457813296',
        '123496578',
        '269735841',
        '315948762',
        '748612935',
      ]) as Digit[][],
      difficulty: 'hard',
      mode: 'classic',
      gridSize: 9,
    },
  },

  // ─────────────────────────────────────────────
  // 8. X-Wing (level 5, Expert)
  // ─────────────────────────────────────────────
  {
    id: 'x-wing',
    level: 5,
    name: 'X-Wing',
    difficulty: 'Expert',
    explanation: [
      'An X-Wing pattern occurs when a digit appears as a candidate in exactly two cells in each of two rows, and those cells share the same two columns (forming a rectangle).',
      'Since the digit must go in one of the two cells in each row, the four cells of the X-Wing cover both columns. Therefore, you can eliminate that digit from all other cells in those two columns.',
      'The four primary cells form the X-Wing rectangle. The secondary cells show where candidates get eliminated. X-Wings can also be found with columns as the base (checking rows for eliminations).',
    ],
    lessonBoard: grid([
      '100000569',
      '090010400',
      '056009010',
      '080093600',
      '004060900',
      '009840020',
      '070400690',
      '005020070',
      '960000004',
    ]),
    highlightCells: [
      { row: 1, col: 0, color: 'primary' },
      { row: 1, col: 5, color: 'primary' },
      { row: 7, col: 0, color: 'primary' },
      { row: 7, col: 5, color: 'primary' },
      // Column eliminations
      { row: 2, col: 0, color: 'secondary' },
      { row: 3, col: 0, color: 'secondary' },
      { row: 4, col: 0, color: 'secondary' },
      { row: 5, col: 5, color: 'secondary' },
      { row: 6, col: 5, color: 'secondary' },
    ],
    practicePuzzle: {
      initial: grid([
        '100000569',
        '090010400',
        '056009010',
        '080093600',
        '004060900',
        '009840020',
        '070400690',
        '005020070',
        '960000004',
      ]),
      solution: grid([
        '142738569',
        '893615427',
        '756249813',
        '281593674',
        '534162988',
        '679841325',
        '378456192',
        '415928736',
        '962371454',
      ]) as Digit[][],
      difficulty: 'expert',
      mode: 'classic',
      gridSize: 9,
    },
  },
];
