import { describe, expect, it } from 'vitest';

import {
  daysOfMonth,
  dateSpan,
  dueNote,
  isOverdue,
  monthLabel,
  monthRange,
  ragOfUsage,
  shiftMonth,
  usageTone,
  weekColumn,
} from './format';

describe('budget usage', () => {
  it('is green under 80%, amber from 80% and red from 100%', () => {
    expect([null, 0, 7999, 8000, 9999, 10000, 15000].map(ragOfUsage)).toEqual([
      null,
      'green',
      'green',
      'amber',
      'amber',
      'red',
      'red',
    ]);
    expect([null, 100, 8500, 12000].map(usageTone)).toEqual([
      'primary',
      'success',
      'warning',
      'danger',
    ]);
  });
});

describe('due dates', () => {
  it('is overdue only for an open job past its date', () => {
    expect(isOverdue('2026-10-01', 'in_progress', '2026-10-18')).toBe(true);
    expect(isOverdue('2026-10-18', 'in_progress', '2026-10-18')).toBe(false);
    expect(isOverdue('2026-10-01', 'completed', '2026-10-18')).toBe(false);
    expect(isOverdue(null, 'planned', '2026-10-18')).toBe(false);
  });

  it('says how far off a due date is', () => {
    expect(dueNote('2026-10-18', '2026-10-18')).toBe('Due today');
    expect(dueNote('2026-10-19', '2026-10-18')).toBe('Due in 1 day');
    expect(dueNote('2026-10-25', '2026-10-18')).toBe('Due in 7 days');
    expect(dueNote('2026-10-16', '2026-10-18')).toBe('2 days overdue');
    expect(dueNote(null, '2026-10-18')).toBeNull();
  });

  it('writes a span of dates, or the one end that is known', () => {
    expect(dateSpan('2026-04-01', '2026-06-30')).toBe('01/04/2026 - 30/06/2026');
    expect(dateSpan('2026-04-01', null)).toBe('From 01/04/2026');
    expect(dateSpan(null, '2026-06-30')).toBe('Until 30/06/2026');
    expect(dateSpan(null, null)).toBeNull();
  });
});

describe('months', () => {
  it('finds the first and last day, including February in a leap year', () => {
    expect(monthRange('2026-10-18')).toEqual({ from: '2026-10-01', to: '2026-10-31' });
    expect(monthRange('2028-02-10')).toEqual({ from: '2028-02-01', to: '2028-02-29' });
  });

  it('moves across a year end and names the month', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(monthLabel('2026-10')).toBe('October 2026');
  });

  it('lists the days and places them in a week that starts on Monday or on Sunday', () => {
    const days = daysOfMonth('2026-02');
    expect(days).toHaveLength(28);
    expect(days[0]).toBe('2026-02-01');
    // 1 February 2026 is a Sunday.
    expect(weekColumn('2026-02-01', 1)).toBe(6);
    expect(weekColumn('2026-02-01', 7)).toBe(0);
    expect(weekColumn('2026-02-02', 1)).toBe(0);
  });
});
