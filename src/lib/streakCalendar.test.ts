import { describe, expect, it } from 'vitest';
import { calendarWeeks, describeCalendarDay } from './streakCalendar';

describe('calendarWeeks', () => {
  it('ends with the week containing today, Monday first', () => {
    // 2026-09-06 is a Sunday, so its week runs 08-31 .. 09-06.
    const weeks = calendarWeeks('2026-09-06', ['2026-09-05', '2026-08-24'], 2);
    expect(weeks).toHaveLength(2);
    expect(weeks[0].map((d) => d.date)).toEqual([
      '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29', '2026-08-30',
    ]);
    expect(weeks[1][0].date).toBe('2026-08-31');
    expect(weeks[1][6]).toEqual({ date: '2026-09-06', completed: false, isToday: true, isFuture: false });
    expect(weeks[1][5].completed).toBe(true);
    expect(weeks[0][0].completed).toBe(true);
  });

  it('marks the rest of the current week as future', () => {
    // 2026-09-08 is a Tuesday.
    const [week] = calendarWeeks('2026-09-08', [], 1);
    expect(week.map((d) => d.isFuture)).toEqual([false, false, true, true, true, true, true]);
    expect(week[1].isToday).toBe(true);
  });

  it('rejects bad input', () => {
    expect(() => calendarWeeks('nope', [])).toThrow('Invalid date');
    expect(() => calendarWeeks('2026-09-08', [], 0)).toThrow('Invalid week count');
  });
});

describe('describeCalendarDay', () => {
  it('describes each state in words', () => {
    expect(describeCalendarDay({ date: '2026-09-07', completed: true, isToday: false, isFuture: false })).toMatch(/September 7: completed$/);
    expect(describeCalendarDay({ date: '2026-09-07', completed: false, isToday: true, isFuture: false })).toMatch(/not completed yet$/);
    expect(describeCalendarDay({ date: '2026-09-07', completed: false, isToday: false, isFuture: true })).toMatch(/upcoming$/);
    expect(describeCalendarDay({ date: '2026-09-07', completed: false, isToday: false, isFuture: false })).toMatch(/missed$/);
  });
});
