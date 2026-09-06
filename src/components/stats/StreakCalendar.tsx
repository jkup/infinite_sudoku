import { utcDateString } from '../../lib/daily';
import { calendarWeeks, describeCalendarDay } from '../../lib/streakCalendar';

type Props = {
  dailyDates: string[];
  currentStreak: number;
  longestStreak: number;
  weeks?: number;
};

const WEEKDAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Trailing-weeks grid of daily completions with streak totals. */
export default function StreakCalendar({ dailyDates, currentStreak, longestStreak, weeks = 8 }: Props) {
  const rows = calendarWeeks(utcDateString(), dailyDates, weeks);
  const muted = { color: 'var(--color-text-muted)' };

  return (
    <section aria-label="Daily streak calendar" className="text-left">
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide" style={muted}>Daily streak</h3>
        <p className="text-xs" style={muted}>
          <span style={{ color: 'var(--color-text)' }} className="font-semibold">{currentStreak}</span> current
          {' · '}
          <span style={{ color: 'var(--color-text)' }} className="font-semibold">{longestStreak}</span> longest
        </p>
      </div>
      <div role="grid" aria-label={`Daily puzzle completions, last ${weeks} weeks`} className="inline-grid gap-1" style={{ gridTemplateColumns: 'repeat(7, 1rem)' }}>
        <div role="row" className="contents">
          {WEEKDAY_LABELS.map((label, index) => (
            <div key={index} role="columnheader" className="text-[10px] text-center leading-4" style={muted} aria-label={['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][index]}>
              {label}
            </div>
          ))}
        </div>
        {rows.map((week) => (
          <div key={week[0].date} role="row" className="contents">
            {week.map((day) => (
              <div
                key={day.date}
                role="gridcell"
                aria-label={describeCalendarDay(day)}
                title={describeCalendarDay(day)}
                className="w-4 h-4 rounded-sm"
                style={{
                  backgroundColor: day.completed ? 'var(--color-btn-active-bg)' : 'var(--color-bg-secondary)',
                  outline: day.isToday ? '2px solid var(--color-text)' : undefined,
                  outlineOffset: day.isToday ? '1px' : undefined,
                  opacity: day.isFuture ? 0.35 : 1,
                }}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
