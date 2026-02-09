import { useEffect, useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { getStats } from '../../lib/api';
import type { UserStats } from '../../lib/api';

export default function StatsPanel() {
  const { isSignedIn, isLoaded } = useAuth();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    setLoading(true);
    getStats()
      .then(setStats)
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, [isLoaded, isSignedIn]);

  if (!isLoaded) return null;

  if (!isSignedIn) {
    return (
      <div className="text-center text-sm py-6" style={{ color: 'var(--color-text-muted)' }}>
        Sign in to track your stats across devices.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center text-sm py-6" style={{ color: 'var(--color-text-muted)' }}>
        Loading stats...
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center text-sm py-6" style={{ color: 'var(--color-text-muted)' }}>
        No stats yet — complete a puzzle to get started!
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 text-center">
      <StatCard label="Games" value={stats.totalGamesCompleted} />
      <StatCard label="Total Score" value={stats.totalScore.toLocaleString()} />
      <StatCard label="Hints Used" value={stats.totalHintsUsed} />
      <StatCard label="Daily Streak" value={stats.currentDailyStreak} />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--color-bg-secondary)' }}>
      <div className="text-2xl font-bold" style={{ color: 'var(--color-text)' }}>{value}</div>
      <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
    </div>
  );
}
