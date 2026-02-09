import type { CSSProperties } from 'react';
import type { Digit } from '../../engine/types';
import type { TutorialCellHighlight, TutorialNoteOverride } from '../../data/tutorials';

type Props = {
  board: (Digit | null)[][];
  highlightCells: TutorialCellHighlight[];
  highlightNotes?: TutorialNoteOverride[];
};

const NOTE_GRID: Record<Digit, { gridRow: number; gridCol: number }> = {
  1: { gridRow: 1, gridCol: 1 },
  2: { gridRow: 1, gridCol: 2 },
  3: { gridRow: 1, gridCol: 3 },
  4: { gridRow: 2, gridCol: 1 },
  5: { gridRow: 2, gridCol: 2 },
  6: { gridRow: 2, gridCol: 3 },
  7: { gridRow: 3, gridCol: 1 },
  8: { gridRow: 3, gridCol: 2 },
  9: { gridRow: 3, gridCol: 3 },
};

const COLOR_MAP: Record<string, string> = {
  primary: 'var(--color-tutorial-primary)',
  secondary: 'var(--color-tutorial-secondary)',
  target: 'var(--color-tutorial-target)',
};

export default function TutorialBoard({ board, highlightCells, highlightNotes }: Props) {
  // Build lookup maps for fast access
  const highlightMap = new Map<string, string>();
  for (const h of highlightCells) {
    highlightMap.set(`${h.row},${h.col}`, COLOR_MAP[h.color]);
  }

  const notesMap = new Map<string, Digit[]>();
  if (highlightNotes) {
    for (const n of highlightNotes) {
      notesMap.set(`${n.row},${n.col}`, n.notes);
    }
  }

  return (
    <div
      className="grid w-full max-w-[280px] mx-auto border-2 rounded-md"
      style={{
        gridTemplateColumns: 'repeat(9, 1fr)',
        borderColor: 'var(--color-board-border)',
      }}
    >
      {board.flatMap((row, r) =>
        row.map((digit, c) => {
          const key = `${r},${c}`;
          const bg = highlightMap.get(key) ?? 'var(--color-cell-bg)';
          const notes = notesMap.get(key);

          const borderStyle: CSSProperties = {
            borderTop: r === 0 ? 'none' : `${r % 3 === 0 ? 2 : 1}px solid ${r % 3 === 0 ? 'var(--color-board-border)' : 'var(--color-cell-border)'}`,
            borderLeft: c === 0 ? 'none' : `${c % 3 === 0 ? 2 : 1}px solid ${c % 3 === 0 ? 'var(--color-board-border)' : 'var(--color-cell-border)'}`,
            borderRight: c === 8 ? 'none' : undefined,
            borderBottom: r === 8 ? 'none' : undefined,
            backgroundColor: bg,
          };

          return (
            <div
              key={key}
              className="relative flex items-center justify-center aspect-square"
              style={borderStyle}
            >
              {digit ? (
                <span
                  className="font-semibold leading-none"
                  style={{
                    color: 'var(--color-digit-given)',
                    fontSize: 'clamp(0.5rem, 2.5cqi, 1.1rem)',
                  }}
                >
                  {digit}
                </span>
              ) : notes && notes.length > 0 ? (
                <div
                  className="absolute inset-0 grid items-center justify-items-center"
                  style={{
                    padding: '1px',
                    gridTemplateColumns: 'repeat(3, 1fr)',
                    gridTemplateRows: 'repeat(3, 1fr)',
                  }}
                >
                  {([1, 2, 3, 4, 5, 6, 7, 8, 9] as Digit[]).map((d) => (
                    <span
                      key={d}
                      className="leading-none"
                      style={{
                        fontSize: 'clamp(0.25rem, 1cqi, 0.4rem)',
                        gridRow: NOTE_GRID[d].gridRow,
                        gridColumn: NOTE_GRID[d].gridCol,
                        visibility: notes.includes(d) ? 'visible' : 'hidden',
                        color: 'var(--color-note)',
                      }}
                    >
                      {d}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
}
