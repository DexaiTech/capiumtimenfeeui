import { describe, expect, it } from 'vitest';

import {
  formatDecimalHours,
  formatMinutes,
  formatMinutesLong,
  hoursToMinutes,
  minutesToHours,
  parseMinutes,
  roundUpToIncrement,
} from './minutes';

describe('formatMinutes', () => {
  it('formats minutes as h:mm', () => {
    expect(formatMinutes(90)).toBe('1:30');
    expect(formatMinutes(0)).toBe('0:00');
    expect(formatMinutes(5)).toBe('0:05');
    expect(formatMinutes(60)).toBe('1:00');
    expect(formatMinutes(600)).toBe('10:00');
    expect(formatMinutes(1440)).toBe('24:00');
    expect(formatMinutes(-90)).toBe('-1:30');
  });

  it('gives an empty string for a missing value', () => {
    expect(formatMinutes(null)).toBe('');
    expect(formatMinutes(undefined)).toBe('');
    expect(formatMinutes(Number.NaN)).toBe('');
  });
});

describe('formatDecimalHours and formatMinutesLong', () => {
  it('formats decimal hours', () => {
    expect(formatDecimalHours(90)).toBe('1.50');
    expect(formatDecimalHours(20)).toBe('0.33');
    expect(formatDecimalHours(6, 1)).toBe('0.1');
  });

  it('formats long durations', () => {
    expect(formatMinutesLong(90)).toBe('1h 30m');
    expect(formatMinutesLong(45)).toBe('45m');
    expect(formatMinutesLong(120)).toBe('2h');
  });
});

describe('parseMinutes', () => {
  it('parses h:mm', () => {
    expect(parseMinutes('1:30')).toBe(90);
    expect(parseMinutes('0:05')).toBe(5);
    expect(parseMinutes('10:00')).toBe(600);
    expect(parseMinutes(' 2:45 ')).toBe(165);
  });

  it('parses decimal hours, with a point or a comma', () => {
    expect(parseMinutes('1.5')).toBe(90);
    expect(parseMinutes('0.25')).toBe(15);
    expect(parseMinutes('0,75')).toBe(45);
    expect(parseMinutes('.1')).toBe(6);
    expect(parseMinutes('2')).toBe(120);
    expect(parseMinutes('0.333')).toBe(20);
  });

  it('parses hours and minutes with units', () => {
    expect(parseMinutes('1h 30m')).toBe(90);
    expect(parseMinutes('45m')).toBe(45);
    expect(parseMinutes('1.5h')).toBe(90);
    expect(parseMinutes('2 hours')).toBe(120);
    expect(parseMinutes('90 mins')).toBe(90);
  });

  it('rejects what is not a duration', () => {
    expect(parseMinutes('')).toBeNull();
    expect(parseMinutes('abc')).toBeNull();
    expect(parseMinutes('1:75')).toBeNull();
    expect(parseMinutes('1:5')).toBeNull();
    expect(parseMinutes('-1')).toBeNull();
    expect(parseMinutes('1.2.3')).toBeNull();
  });

  it('round-trips with formatMinutes', () => {
    for (const minutes of [0, 1, 6, 59, 60, 61, 90, 455, 1440]) {
      expect(parseMinutes(formatMinutes(minutes))).toBe(minutes);
    }
  });
});

describe('roundUpToIncrement', () => {
  it('rounds up to the practice increment', () => {
    expect(roundUpToIncrement(1, 6)).toBe(6);
    expect(roundUpToIncrement(6, 6)).toBe(6);
    expect(roundUpToIncrement(7, 6)).toBe(12);
    expect(roundUpToIncrement(31, 15)).toBe(45);
    expect(roundUpToIncrement(31, 1)).toBe(31);
  });
});

describe('hoursToMinutes and minutesToHours', () => {
  it('converts weekly capacity', () => {
    expect(hoursToMinutes('37.5')).toBe(2250);
    expect(hoursToMinutes('40')).toBe(2400);
    expect(hoursToMinutes('7,5')).toBe(450);
    expect(hoursToMinutes('abc')).toBeNull();
    expect(minutesToHours(2250)).toBe('37.5');
    expect(minutesToHours(2400)).toBe('40');
  });
});
