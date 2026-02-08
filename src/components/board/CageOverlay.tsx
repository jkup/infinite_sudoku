import type { Cage } from '../../engine/types';
import { getCageBorders, isCageLabelCell } from '../../engine/killer';

type CageOverlayProps = {
  cages: Cage[];
};

/**
 * SVG overlay that draws dashed cage borders and sum labels.
 * Rendered on top of the grid using absolute positioning.
 */
export default function CageOverlay({ cages }: CageOverlayProps) {
  // Each cell is 1 unit in our SVG viewBox (9x9 total)
  const INSET = 0.06; // Inset from cell edge so cage lines don't overlap grid lines

  const lines: { x1: number; y1: number; x2: number; y2: number }[] = [];
  const labels: { x: number; y: number; sum: number }[] = [];

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const borders = getCageBorders(cages, row, col);

      if (borders.top) {
        lines.push({
          x1: col + INSET,
          y1: row + INSET,
          x2: col + 1 - INSET,
          y2: row + INSET,
        });
      }
      if (borders.bottom) {
        lines.push({
          x1: col + INSET,
          y1: row + 1 - INSET,
          x2: col + 1 - INSET,
          y2: row + 1 - INSET,
        });
      }
      if (borders.left) {
        lines.push({
          x1: col + INSET,
          y1: row + INSET,
          x2: col + INSET,
          y2: row + 1 - INSET,
        });
      }
      if (borders.right) {
        lines.push({
          x1: col + 1 - INSET,
          y1: row + INSET,
          x2: col + 1 - INSET,
          y2: row + 1 - INSET,
        });
      }

      const sum = isCageLabelCell(cages, row, col);
      if (sum !== null) {
        labels.push({ x: col + INSET + 0.04, y: row + INSET + 0.04, sum });
      }
    }
  }

  return (
    <svg
      viewBox="0 0 9 9"
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    >
      {/* Cage borders */}
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.x1}
          y1={line.y1}
          x2={line.x2}
          y2={line.y2}
          stroke="currentColor"
          className="text-slate-800"
          strokeWidth="0.03"
          strokeDasharray="0.06 0.04"
          strokeLinecap="round"
        />
      ))}

      {/* Sum labels */}
      {labels.map((label, i) => (
        <g key={`label-${i}`}>
          {/* White background for readability */}
          <rect
            x={label.x}
            y={label.y}
            width={label.sum >= 10 ? 0.42 : 0.25}
            height={0.28}
            rx={0.04}
            fill="white"
          />
          <text
            x={label.x + 0.04}
            y={label.y + 0.22}
            fontSize="0.24"
            fontWeight="600"
            className="fill-slate-600"
            fontFamily="system-ui, sans-serif"
          >
            {label.sum}
          </text>
        </g>
      ))}
    </svg>
  );
}
