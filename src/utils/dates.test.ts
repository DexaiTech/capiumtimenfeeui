import { describe, expect, it } from 'vitest';

import {
  addDays,
  dayBefore,
  daysBetween,
  formatDayMonthYear,
  formatUkDate,
  formatUkDateTime,
  formatWeekdays,
  todayInZone,
} from './dates';

describe('formatDayMonthYear', () => {
  it('writes a date as dd-MMM-yyyy', () => {
    expect(formatDayMonthYear('2026-10-17')).toBe('17-Oct-2026');
    expect(formatDayMonthYear('2026-09-30')).toBe('30-Sep-2026');
    expect(formatDayMonthYear('2026-01-05')).toBe('05-Jan-2026');
  });

  it('moves a timestamp to the calendar day of the practice time zone', () => {
    expect(formatDayMonthYear('2026-10-17T23:30:00Z', 'Europe/London')).toBe('18-Oct-2026');
    expect(formatDayMonthYear('2026-10-17T23:30:00Z', 'America/New_York')).toBe('17-Oct-2026');
    expect(formatDayMonthYear('2026-10-17T23:30:00Z')).toBe('17-Oct-2026');
  });

  it('gives an empty string for nothing usable', () => {
    expect(formatDayMonthYear(null)).toBe('');
    expect(formatDayMonthYear(undefined)).toBe('');
    expect(formatDayMonthYear('soon')).toBe('');
    expect(formatDayMonthYear('2026-10-17T99:99:99Z', 'Europe/London')).toBe('');
    expect(formatDayMonthYear('not a timestamp at all', 'Europe/London')).toBe('');
  });
});

describe('addDays and daysBetween', () => {
  it('moves a date by whole days across month and year ends', () => {
    expect(addDays('2026-10-18', 7)).toBe('2026-10-25');
    expect(addDays('2026-10-18', -18)).toBe('2026-09-30');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('soon', 1)).toBe('soon');
  });

  it('counts the days between two dates', () => {
    expect(daysBetween('2026-09-30', '2026-10-18')).toBe(18);
    expect(daysBetween('2026-10-18', '2026-10-18')).toBe(0);
    expect(daysBetween('2026-10-18', '2026-10-17')).toBe(-1);
    expect(daysBetween('soon', '2026-10-17')).toBe(0);
  });
});

describe('formatUkDate', () => {
  it('writes an ISO date as dd/MM/yyyy', () => {
    expect(formatUkDate('2026-10-18')).toBe('18/10/2026');
    expect(formatUkDate('2026-01-05')).toBe('05/01/2026');
  });

  it('ignores a time part and gives an empty string for nothing usable', () => {
    expect(formatUkDate('2026-10-18T09:00:00Z')).toBe('18/10/2026');
    expect(formatUkDate(null)).toBe('');
    expect(formatUkDate(undefined)).toBe('');
    expect(formatUkDate('soon')).toBe('');
  });
});

describe('formatUkDateTime', () => {
  it('shows a UTC timestamp in the practice time zone', () => {
    // 20:23 UTC on 20 May is 21:23 in London (BST).
    expect(formatUkDateTime('2026-05-20T20:23:00Z', 'Europe/London')).toBe('20/05/2026 21:23');
    expect(formatUkDateTime('2026-01-20T20:23:00Z', 'Europe/London')).toBe('20/01/2026 20:23');
  });

  it('rolls over to the next local day', () => {
    expect(formatUkDateTime('2026-10-17T23:30:00Z', 'Asia/Kolkata')).toBe('18/10/2026 05:00');
  });

  it('copes with an unknown zone, an invalid timestamp and no value', () => {
    expect(formatUkDateTime('2026-05-20T20:23:00Z', 'Nowhere/City')).toMatch(
      /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/,
    );
    expect(formatUkDateTime('nope', 'Europe/London')).toBe('');
    expect(formatUkDateTime(null, 'Europe/London')).toBe('');
  });
});

describe('todayInZone', () => {
  it('is the calendar day of the zone, not of UTC', () => {
    const now = new Date('2026-10-17T23:30:00Z');
    expect(todayInZone('Europe/London', now)).toBe('2026-10-18');
    expect(todayInZone('America/New_York', now)).toBe('2026-10-17');
  });
});

describe('dayBefore', () => {
  it('steps back one day across month and year ends', () => {
    expect(dayBefore('2026-10-18')).toBe('2026-10-17');
    expect(dayBefore('2026-03-01')).toBe('2026-02-28');
    expect(dayBefore('2024-03-01')).toBe('2024-02-29');
    expect(dayBefore('2026-01-01')).toBe('2025-12-31');
  });

  it('returns text that is not a date unchanged', () => {
    expect(dayBefore('')).toBe('');
  });
});

describe('formatWeekdays', () => {
  it('names a run of days as a range', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5])).toBe('Mon–Fri');
    expect(formatWeekdays([1, 2, 3, 4])).toBe('Mon–Thu');
  });

  it('lists days that are not a run', () => {
    expect(formatWeekdays([1, 3, 5])).toBe('Mon, Wed, Fri');
    expect(formatWeekdays([5, 1])).toBe('Mon, Fri');
    expect(formatWeekdays([1, 2])).toBe('Mon, Tue');
  });

  it('handles the extremes', () => {
    expect(formatWeekdays([1, 2, 3, 4, 5, 6, 7])).toBe('Every day');
    expect(formatWeekdays([])).toBe('—');
    expect(formatWeekdays([6, 7])).toBe('Sat, Sun');
  });
});
