import { describe, expect, it } from 'vitest';

import { dailyTargets, weeklyTarget } from './targets';
import { weekDates } from './weeks';

const FULL = {
  weekly_capacity_minutes: 2250,
  working_days: [1, 2, 3, 4, 5],
  start_date: null,
  leaving_date: null,
};
const WEEK = weekDates('2026-10-12');

describe('dailyTargets', () => {
  it('divides the capacity over the working days and nothing on a day off', () => {
    expect(dailyTargets(FULL, WEEK)).toEqual([450, 450, 450, 450, 450, 0, 0]);
    expect(weeklyTarget(FULL, WEEK)).toBe(2250);
  });

  it('gives the leftover minutes to the first working days, so a week adds up exactly', () => {
    const threeDays = { ...FULL, weekly_capacity_minutes: 2000, working_days: [1, 3, 5] };
    expect(dailyTargets(threeDays, WEEK)).toEqual([667, 0, 667, 0, 666, 0, 0]);
    expect(weeklyTarget(threeDays, WEEK)).toBe(2000);
  });

  it('has no target before the start date or after the leaving date', () => {
    expect(dailyTargets({ ...FULL, start_date: '2026-10-14' }, WEEK)).toEqual([
      0, 0, 450, 450, 450, 0, 0,
    ]);
    expect(dailyTargets({ ...FULL, leaving_date: '2026-10-13' }, WEEK)).toEqual([
      450, 450, 0, 0, 0, 0, 0,
    ]);
  });

  it('asks nothing of someone with no capacity or no working day', () => {
    expect(weeklyTarget({ ...FULL, weekly_capacity_minutes: 0 }, WEEK)).toBe(0);
    expect(weeklyTarget({ ...FULL, working_days: [] }, WEEK)).toBe(0);
  });
});
