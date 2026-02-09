import type { Cage } from '../../engine/types';

type CageOverlayProps = {
  cages: Cage[];
  gridSize?: number;
};

const INSET = 0.055;

/**
 * Trace the perimeter of a cage as a closed SVG path.
 * Edges are directed clockwise so they chain into a continuous loop.
 * The path is inset from cell boundaries so it doesn't overlap grid/box lines.
 */
function traceCagePath(cage: Cage): string {
  const cellSet = new Set(cage.cells.map((c) => `${c.row},${c.col}`));

  // Collect directed boundary edges (clockwise winding)
  type Edge = [number, number, number, number]; // x1, y1, x2, y2
  const edges: Edge[] = [];

  for (const { row, col } of cage.cells) {
    // Top: left → right
    if (!cellSet.has(`${row - 1},${col}`))
      edges.push([col, row, col + 1, row]);
    // Right: top → bottom
    if (!cellSet.has(`${row},${col + 1}`))
      edges.push([col + 1, row, col + 1, row + 1]);
    // Bottom: right → left
    if (!cellSet.has(`${row + 1},${col}`))
      edges.push([col + 1, row + 1, col, row + 1]);
    // Left: bottom → top
    if (!cellSet.has(`${row},${col - 1}`))
      edges.push([col, row + 1, col, row]);
  }

  if (edges.length === 0) return '';

  // Build adjacency: from end-vertex → edge starting at that vertex
  const edgeFrom = new Map<string, Edge>();
  for (const e of edges) {
    edgeFrom.set(`${e[0]},${e[1]}`, e);
  }

  // Follow the chain to build a closed path
  const first = edges[0];
  const points: [number, number][] = [[first[0], first[1]]];
  let cur = first;

  for (let i = 0; i < edges.length; i++) {
    points.push([cur[2], cur[3]]);
    const next = edgeFrom.get(`${cur[2]},${cur[3]}`);
    if (!next) break;
    cur = next;
  }

  // Apply inset: shift each vertex inward toward the cage interior.
  // At each vertex, compute the inward direction from the two adjacent edges.
  const insetPoints = points.slice(0, -1).map((_, i) => {
    const [x, y] = points[i];
    const prev = points[(i - 1 + points.length - 1) % (points.length - 1)];
    const next = points[(i + 1) % (points.length - 1)];

    // Direction vectors of incoming and outgoing edges
    const dx1 = x - prev[0];
    const dy1 = y - prev[1];
    const dx2 = next[0] - x;
    const dy2 = next[1] - y;

    // Inward normals (rotate 90° clockwise for clockwise winding)
    const nx1 = dy1;
    const ny1 = -dx1;
    const nx2 = dy2;
    const ny2 = -dx2;

    // Average inward normal
    const nx = nx1 + nx2;
    const ny = ny1 + ny2;
    const len = Math.sqrt(nx * nx + ny * ny) || 1;

    return [x + (nx / len) * INSET, y + (ny / len) * INSET] as [number, number];
  });

  return (
    'M ' +
    insetPoints.map(([x, y]) => `${x} ${y}`).join(' L ') +
    ' Z'
  );
}

export default function CageOverlay({ cages, gridSize = 9 }: CageOverlayProps) {
  return (
    <svg
      viewBox={`0 0 ${gridSize} ${gridSize}`}
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      aria-hidden="true"
    >
      {cages.map((cage, i) => (
        <path
          key={i}
          d={traceCagePath(cage)}
          fill="none"
          stroke="var(--color-cage-border)"
          strokeWidth="0.02"
          strokeDasharray="0.07 0.045"
          strokeOpacity="0.55"
        />
      ))}
    </svg>
  );
}
