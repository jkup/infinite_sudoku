import type { Cage } from '../../engine/types';
import { getCageBorders } from '../../engine/killer';

type CageOverlayProps = {
  cages: Cage[];
};

/**
 * SVG overlay that draws dashed cage borders.
 * Sum labels are rendered in the Cell component instead to avoid overlap.
 * Lines are drawn at exact cell boundaries (no inset) so corners connect.
 */
export default function CageOverlay({ cages }: CageOverlayProps) {
  // Deduplicate edges: each border segment is shared by two cells,
  // so without dedup both emit a line and it appears double-thick.
  const seen = new Set<string>();
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const borders = getCageBorders(cages, row, col);

      if (borders.top) {
        const key = `h:${row},${col}`;
        if (!seen.has(key)) { seen.add(key); lines.push({ x1: col, y1: row, x2: col + 1, y2: row }); }
      }
      if (borders.bottom) {
        const key = `h:${row + 1},${col}`;
        if (!seen.has(key)) { seen.add(key); lines.push({ x1: col, y1: row + 1, x2: col + 1, y2: row + 1 }); }
      }
      if (borders.left) {
        const key = `v:${row},${col}`;
        if (!seen.has(key)) { seen.add(key); lines.push({ x1: col, y1: row, x2: col, y2: row + 1 }); }
      }
      if (borders.right) {
        const key = `v:${row},${col + 1}`;
        if (!seen.has(key)) { seen.add(key); lines.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 }); }
      }
    }
  }

  return (
    <svg
      viewBox="0 0 9 9"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-hidden="true"
    >
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="var(--color-cage-border)"
          strokeWidth="0.04"
          strokeDasharray="0.07 0.05"
        />
      ))}
    </svg>
  );
}
