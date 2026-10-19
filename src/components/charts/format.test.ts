import { describe, expect, it } from 'vitest';

import { formatDateTick, formatMinutes, formatPercent, formatShortDate } from './format';

describe('formatMinutes', () => {
  it.each([
    [0, '0m'],
    [45, '45m'],
    [60, '1h'],
    [90, '1h 30m'],
    [120, '2h'],
    [1500, '25h'],
    [89.6, '1h 30m'],
    [-90, '-1h 30m'],
    [Number.NaN, '0m'],
  ])('formats %s as %s', (minutes, expected) => {
    expect(formatMinutes(minutes)).toBe(expected);
  });
});

describe('formatShortDate', () => {
  it('formats a date-only string in UTC', () => {
    expect(formatShortDate('2025-10-05')).toBe('Oct 5');
  });

  it('formats an ISO timestamp in UTC regardless of the local zone', () => {
    expect(formatShortDate('2025-10-05T23:30:00Z')).toBe('Oct 5');
    expect(formatShortDate(new Date(Date.UTC(2025, 0, 31)))).toBe('Jan 31');
  });

  it('honours the locale', () => {
    expect(formatShortDate('2025-10-05', 'de-DE')).toBe('5. Okt.');
  });

  it('returns unparseable input as text', () => {
    expect(formatShortDate('not a date')).toBe('not a date');
  });

  it('is available as a tick formatter', () => {
    expect(formatDateTick('2025-03-09')).toBe('Mar 9');
  });
});

describe('formatPercent', () => {
  it('rounds a ratio to a whole percentage', () => {
    expect(formatPercent(0.256)).toBe('26%');
    expect(formatPercent(0)).toBe('0%');
  });
});
