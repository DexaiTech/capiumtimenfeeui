import { describe, expect, it } from 'vitest';

import { addMonths, nextJobHint, nextJobPeriod, periodLabel } from './jobPeriods';

const base = { leadDays: 0, today: '2026-01-01' } as const;

describe('addMonths', () => {
  it('clamps to the end of a shorter month', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-11-30', 3)).toBe('2027-02-28');
  });

  it('counts from the anchor, so the day comes back after a short month', () => {
    expect(addMonths('2026-01-31', 2)).toBe('2026-03-31');
  });

  it('crosses years', () => {
    expect(addMonths('2026-10-15', 12)).toBe('2027-10-15');
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
  });
});

describe('nextJobPeriod', () => {
  it('takes the first monthly period that has not ended', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'monthly',
      startDate: '2026-01-31',
      today: '2026-04-01',
    });
    expect(period).toEqual({
      periodStart: '2026-03-31',
      periodEnd: '2026-04-29',
      createOn: '2026-03-31',
    });
  });

  it('skips the monthly periods in the past and keeps the one running today', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'monthly',
      startDate: '2026-01-15',
      today: '2026-03-20',
    });
    expect(period?.periodStart).toBe('2026-03-15');
    const running = nextJobPeriod({
      ...base,
      frequency: 'monthly',
      startDate: '2026-01-15',
      today: '2026-02-20',
    });
    expect(running?.periodStart).toBe('2026-02-15');
    expect(running?.periodEnd).toBe('2026-03-14');
  });

  it('steps quarterly by three months', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'quarterly',
      startDate: '2026-01-10',
      today: '2026-05-01',
    });
    expect(period).toEqual({
      periodStart: '2026-04-10',
      periodEnd: '2026-07-09',
      createOn: '2026-04-10',
    });
  });

  it('steps annually by twelve months', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'annually',
      startDate: '2025-04-01',
      today: '2026-06-01',
    });
    expect(period?.periodStart).toBe('2026-04-01');
    expect(period?.periodEnd).toBe('2027-03-31');
  });

  it('gives a one-off engagement the single period of its start date', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'one_off',
      startDate: '2026-05-01',
      leadDays: 10,
    });
    expect(period).toEqual({ periodStart: '2026-05-01', periodEnd: null, createOn: '2026-04-21' });
  });

  it('creates the job the lead days before the period starts', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'monthly',
      startDate: '2026-10-01',
      leadDays: 6,
    });
    expect(period?.createOn).toBe('2026-09-25');
    expect(
      nextJobPeriod({ ...base, frequency: 'monthly', startDate: '2026-03-01', leadDays: 1 })
        ?.createOn,
    ).toBe('2026-02-28');
  });

  it('never creates a job for a period that has ended', () => {
    const period = nextJobPeriod({
      ...base,
      frequency: 'monthly',
      startDate: '2026-01-01',
      today: '2026-02-01',
    });
    expect(period?.periodStart).toBe('2026-02-01');
    expect(period?.periodStart).not.toBe('2026-01-01');
  });

  it('gives nothing once the end date is before the next period', () => {
    expect(
      nextJobPeriod({
        ...base,
        frequency: 'monthly',
        startDate: '2026-01-01',
        endDate: '2026-02-15',
        today: '2026-03-01',
      }),
    ).toBeNull();
    expect(
      nextJobPeriod({
        ...base,
        frequency: 'one_off',
        startDate: '2026-05-01',
        endDate: '2026-04-01',
      }),
    ).toBeNull();
  });

  it('gives nothing without a valid start date', () => {
    expect(nextJobPeriod({ ...base, frequency: 'monthly', startDate: '' })).toBeNull();
  });
});

describe('periodLabel and nextJobHint', () => {
  it('labels a month, a quarter and a year', () => {
    expect(
      periodLabel('monthly', { periodStart: '2026-10-01', periodEnd: '2026-10-31', createOn: '' }),
    ).toBe('Oct 2026');
    expect(
      periodLabel('quarterly', {
        periodStart: '2026-10-01',
        periodEnd: '2026-12-31',
        createOn: '',
      }),
    ).toBe('Oct-Dec 2026');
    expect(
      periodLabel('annually', { periodStart: '2026-04-01', periodEnd: '2027-03-31', createOn: '' }),
    ).toBe('Apr 2026 - Mar 2027');
  });

  it('words the hint', () => {
    expect(
      nextJobHint({
        frequency: 'monthly',
        startDate: '2026-10-01',
        leadDays: 6,
        today: '2026-09-01',
      }),
    ).toBe('Next job: Oct 2026, created on 25/09/2026');
    expect(
      nextJobHint({
        frequency: 'one_off',
        startDate: '2026-10-01',
        leadDays: 6,
        today: base.today,
      }),
    ).toBe('One job, for the start date.');
    expect(
      nextJobHint({ frequency: 'monthly', startDate: '', leadDays: 6, today: base.today }),
    ).toBeNull();
  });
});
