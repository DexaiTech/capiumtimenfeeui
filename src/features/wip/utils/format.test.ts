import { describe, expect, it } from 'vitest';

import { ages } from '../test/fixtures';
import {
  ageSegments,
  ageTone,
  daysText,
  isoDate,
  jobText,
  lastMonthEnd,
  personName,
  shareText,
  signedMoney,
} from './format';

describe('lastMonthEnd', () => {
  it('is the last day of the month before the one given', () => {
    expect(lastMonthEnd('2026-10-18')).toBe('2026-09-30');
    expect(lastMonthEnd('2026-03-05')).toBe('2026-02-28');
    expect(lastMonthEnd('2024-03-10')).toBe('2024-02-29');
    expect(lastMonthEnd('2026-01-01')).toBe('2025-12-31');
  });
});

describe('ageSegments', () => {
  it('has no segments without WIP', () => {
    expect(ageSegments(ages())).toEqual([]);
  });

  it('shares the bar between the buckets in proportion, in the order of the ageing', () => {
    const segments = ageSegments(ages({ days_0_30: 7500, days_61_90: 2500 }));
    expect(segments.map((segment) => segment.key)).toEqual([
      'days_0_30',
      'days_31_60',
      'days_61_90',
      'days_90_plus',
    ]);
    expect(segments.map((segment) => segment.percent)).toEqual([75, 0, 25, 0]);
    expect(segments[0]?.cssColor).toBe('var(--color-success)');
    expect(segments[3]?.cssColor).toBe('var(--color-danger)');
  });
});

describe('ageTone', () => {
  it('warns from 61 days and flags what is over 90', () => {
    expect(ageTone(10)).toBe('grey');
    expect(ageTone(60)).toBe('grey');
    expect(ageTone(61)).toBe('amber');
    expect(ageTone(90)).toBe('amber');
    expect(ageTone(91)).toBe('red');
    expect(ageTone(null)).toBe('grey');
  });
});

describe('the words of a figure', () => {
  it('writes days in the singular and the plural', () => {
    expect(daysText(1)).toBe('1 day');
    expect(daysText(41)).toBe('41 days');
  });

  it('puts a plus on what is added, and leaves what is taken with its minus', () => {
    expect(signedMoney(10000, 'GBP')).toBe('+£100.00');
    expect(signedMoney(-5000, 'GBP')).toBe('-£50.00');
    expect(signedMoney(0, 'GBP')).toBe('£0.00');
  });

  it('writes a share of nothing as a dash', () => {
    expect(shareText(1304)).toBe('13.04%');
    expect(shareText(null)).toBe('—');
  });

  it('names a job, a person and a day', () => {
    expect(jobText({ number: 'J00001', name: 'Year-end' })).toBe('J00001 Year-end');
    expect(jobText({ number: null, name: null })).toBe('Job');
    expect(jobText(null)).toBe('—');
    expect(personName({ user_id: 'u', full_name: 'Ada Lovelace' })).toBe('Ada Lovelace');
    expect(personName({ user_id: 'u', full_name: null })).toBe('Former member');
    expect(personName(null)).toBe('—');
    expect(isoDate('2026-10-18')).toBe('2026-10-18');
    expect(isoDate('18/10/2026')).toBeNull();
    expect(isoDate(null)).toBeNull();
  });
});
