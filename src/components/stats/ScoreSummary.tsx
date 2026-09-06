import { useGameStore } from '../../store/gameStore';
import { scoreBreakdown } from '../../lib/scoring';
import { formatTime } from '../../lib/formatTime';

const numberFormat = new Intl.NumberFormat();

/**
 * Score for the just-completed game, computed with the same shared formula the
 * server uses, so it is available immediately and for offline or signed-out solves.
 * Reads the frozen completion stats from the game store.
 */
export default function ScoreSummary() {
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const solveTimeMs = useGameStore((s) => s.elapsedMs);
  const hintsUsed = useGameStore((s) => s.hintsUsed);
  const errorsMade = useGameStore((s) => s.errorsMade);

  const breakdown = scoreBreakdown({ difficulty, mode, solveTimeMs, hintsUsed, errorsMade });
  const rows: Array<{ label: string; detail: string; delta: number }> = [
    { label: 'Base', detail: `${difficulty} ${mode}`, delta: breakdown.base },
    { label: 'Time', detail: `${formatTime(solveTimeMs)} (par ${formatTime(breakdown.parTimeMs)})`, delta: -breakdown.timePenalty },
    { label: 'Hints', detail: String(hintsUsed), delta: -breakdown.hintPenalty },
    { label: 'Errors', detail: String(errorsMade), delta: -breakdown.errorPenalty },
  ];

  return (
    <section className="mb-5" aria-label="Score">
      <p className="text-4xl font-bold tabular-nums" style={{ color: 'var(--color-text)' }} data-testid="score-total">
        {numberFormat.format(breakdown.score)}
      </p>
      <p className="text-xs uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>points</p>
      <dl className="text-sm text-left grid grid-cols-[auto_1fr_auto] gap-x-3 gap-y-1">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="font-semibold" style={{ color: 'var(--color-text)' }}>{row.label}</dt>
            <dd className="capitalize" style={{ color: 'var(--color-text-muted)' }}>{row.detail}</dd>
            <dd className="text-right tabular-nums" style={{ color: 'var(--color-text)' }}>
              {row.delta < 0 ? `−${numberFormat.format(-row.delta)}` : numberFormat.format(row.delta)}
            </dd>
          </div>
        ))}
      </dl>
      {breakdown.floored && (
        <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Minimum score applied ({numberFormat.format(breakdown.minimum)} points).
        </p>
      )}
    </section>
  );
}
