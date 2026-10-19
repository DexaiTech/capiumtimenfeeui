import { describe, expect, it } from 'vitest';

import {
  addMonths,
  calendarWeeks,
  formatDayHeader,
  formatLongDay,
  formatWeekRange,
  isIsoDate,
  isoWeekday,
  isSameMonth,
  monthEnd,
  monthLabel,
  monthStart,
  weekDates,
  weekStartOf,
  weekdayName,
} from './weeks';

describe('weeks', () => {
  it('reads the ISO weekday of a date', () => {
    expect(isoWeekday('2026-10-12')).toBe(1);
    expect(isoWeekday('2026-10-18')).toBe(7);
  });

  it('moves a date back to the first day of the practice week', () => {
    expect(weekStartOf('2026-10-14', 1)).toBe('2026-10-12');
    expect(weekStartOf('2026-10-18', 1)).toBe('2026-10-12');
    expect(weekStartOf('2026-10-12', 1)).toBe('2026-10-12');
    // A week that starts on Sunday: Sunday 18/10 opens the next week.
    expect(weekStartOf('2026-10-18', 7)).toBe('2026-10-18');
    expect(weekStartOf('2026-10-17', 7)).toBe('2026-10-11');
  });

  it('lists the seven dates of a week, over a month end', () => {
    expect(weekDates('2026-10-26')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('writes dates the UK way', () => {
    expect(weekdayName('2026-10-14')).toBe('Wed');
    expect(weekdayName('2026-10-14', 'long')).toBe('Wednesday');
    expect(formatDayHeader('2026-10-14')).toBe('Wed 14/10');
    expect(formatLongDay('2026-10-14')).toBe('Wednesday 14/10/2026');
    expect(formatWeekRange('2026-10-12')).toBe('12/10/2026 – 18/10/2026');
  });

  it('knows real dates from impossible ones', () => {
    expect(isIsoDate('2026-02-28')).toBe(true);
    expect(isIsoDate('2026-02-30')).toBe(false);
    expect(isIsoDate('14/10/2026')).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });

  it('works out months', () => {
    expect(monthStart('2026-10-14')).toBe('2026-10-01');
    expect(monthEnd('2026-10-14')).toBe('2026-10-31');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
    expect(addMonths('2026-10-14', 1)).toBe('2026-11-01');
    expect(addMonths('2026-01-31', -1)).toBe('2025-12-01');
    expect(monthLabel('2026-10-14')).toBe('October 2026');
    expect(isSameMonth('2026-10-31', '2026-10-01')).toBe(true);
    expect(isSameMonth('2026-10-31', '2026-11-01')).toBe(false);
  });

  it('draws the whole weeks that cover a month', () => {
    const weeks = calendarWeeks('2026-10-14', 1);
    expect(weeks).toHaveLength(5);
    expect(weeks[0]?.[0]).toBe('2026-09-28');
    expect(weeks[4]?.[6]).toBe('2026-11-01');
    expect(weeks.every((week) => week.length === 7)).toBe(true);
  });
});
