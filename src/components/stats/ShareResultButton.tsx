import { useEffect, useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { scoreBreakdown } from '../../lib/scoring';
import { buildDailyShareText } from '../../lib/shareText';
import { shareText, type ShareOutcome } from '../../lib/share';

type Props = {
  date: string;
  /** Leaderboard standing once known; omitted from the text until then. */
  standing?: { rank: number; totalEntries: number } | null;
};

const FEEDBACK: Record<ShareOutcome, string> = {
  shared: 'Shared!',
  copied: 'Copied to clipboard',
  failed: "Couldn't share. Try copying manually.",
};

/** Copies or shares a text summary of the just-completed daily. */
export default function ShareResultButton({ date, standing }: Props) {
  const difficulty = useGameStore((s) => s.difficulty);
  const mode = useGameStore((s) => s.mode);
  const solveTimeMs = useGameStore((s) => s.elapsedMs);
  const hintsUsed = useGameStore((s) => s.hintsUsed);
  const errorsMade = useGameStore((s) => s.errorsMade);
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);

  useEffect(() => {
    if (!outcome) return;
    const timer = setTimeout(() => setOutcome(null), 2500);
    return () => clearTimeout(timer);
  }, [outcome]);

  const onShare = async () => {
    const { score } = scoreBreakdown({ difficulty, mode, solveTimeMs, hintsUsed, errorsMade });
    const text = buildDailyShareText({
      date, mode, difficulty, solveTimeMs, score, hintsUsed, errorsMade,
      ...(standing ? { rank: standing.rank, totalEntries: standing.totalEntries } : {}),
    });
    setOutcome(await shareText(text, 'Infinite Sudoku Daily'));
  };

  return (
    <div className="flex items-center justify-center gap-3 text-sm">
      <button
        onClick={() => void onShare()}
        className="px-4 py-2 rounded-xl font-semibold border transition-colors"
        style={{ backgroundColor: 'var(--color-btn-bg)', color: 'var(--color-btn-text)', borderColor: 'var(--color-cell-border)' }}
      >
        Share result
      </button>
      <span role="status" aria-live="polite" style={{ color: 'var(--color-text-muted)' }}>
        {outcome ? FEEDBACK[outcome] : ''}
      </span>
    </div>
  );
}
