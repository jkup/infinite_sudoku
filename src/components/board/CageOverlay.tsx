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
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const borders = getCageBorders(cages, row, col);

      if (borders.top) {
        lines.push({ x1: col, y1: row, x2: col + 1, y2: row });
      }
      if (borders.bottom) {
        lines.push({ x1: col, y1: row + 1, x2: col + 1, y2: row + 1 });
      }
      if (borders.left) {
        lines.push({ x1: col, y1: row, x2: col, y2: row + 1 });
      }
      if (borders.right) {
        lines.push({ x1: col + 1, y1: row, x2: col + 1, y2: row + 1 });
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
          stroke="#334155"
          strokeWidth="0.04"
          strokeDasharray="0.07 0.05"
        />
      ))}
    </svg>
  );
}
