import { addDays, isDailyDate } from './daily';

export type CalendarDay = {
  date: string;       // YYYY-MM-DD (UTC, matching daily identity)
  completed: boolean;
  isToday: boolean;
  isFuture: boolean;
};

/** How many days of history the stats endpoint returns; keep in sync with functions/api/stats.ts. */
export const DAILY_HISTORY_DAYS = 90;

/**
 * Lay out the trailing `weeks` weeks ending with the week containing `today`,
 * Monday first, marking which UTC dates have a counted daily completion.
 */
export function calendarWeeks(today: string, completedDates: Iterable<string>, weeks = 8): CalendarDay[][] {
  if (!isDailyDate(today)) throw new Error(`Invalid date: ${today}`);
  if (!Number.isInteger(weeks) || weeks < 1) throw new Error(`Invalid week count: ${weeks}`);
  const completed = new Set(completedDates);
  const daysSinceMonday = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const start = addDays(today, -daysSinceMonday - 7 * (weeks - 1));

  return Array.from({ length: weeks }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => {
      const date = addDays(start, week * 7 + day);
      return { date, completed: completed.has(date), isToday: date === today, isFuture: date > today };
    }));
}

/** Human label for a calendar cell, e.g. "Monday, September 7: completed". */
export function describeCalendarDay(day: CalendarDay): string {
  const label = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', timeZone: 'UTC',
  });
  const status = day.completed ? 'completed' : day.isFuture ? 'upcoming' : day.isToday ? 'not completed yet' : 'missed';
  return `${label}: ${status}`;
}
