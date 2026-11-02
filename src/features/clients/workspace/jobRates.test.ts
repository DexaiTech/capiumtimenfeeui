import { describe, expect, it } from 'vitest';

import { describeJobRate, taskRateText } from './jobRates';
import type { JobRate } from './types';

const hourly = {
  billing_basis: 'hourly',
  fixed_fee: null,
  hourly_rate: null,
  service_name: 'Annual Accounts',
};

function rate(fields: Partial<JobRate>): JobRate {
  return {
    job_id: 'j1',
    billing_basis: 'hourly',
    fixed_fee: null,
    job_rate: null,
    task_rate: null,
    client_rule: null,
    person_rules: 0,
    source: 'task',
    ...fields,
  };
}

describe('describeJobRate', () => {
  it('shows the task rate until a client rate is agreed for the job', () => {
    const task = rate({ task_rate: { low: 10000, high: 10000, rules: 1 } });
    expect(describeJobRate(hourly, task, 'GBP')).toEqual({
      label: 'Task rate £100.00/h',
      detail: "The service's rate",
    });
    const agreed = rate({ source: 'job', job_rate: 12000 });
    expect(describeJobRate({ ...hourly, hourly_rate: 12000 }, agreed, 'GBP')).toEqual({
      label: 'Client rate £120.00/h',
      detail: 'Agreed for this job',
    });
  });

  it('shows a range when the task rate differs by grade, and staff rates without one', () => {
    const range = rate({ task_rate: { low: 8000, high: 15000, rules: 3 }, person_rules: 1 });
    expect(describeJobRate(hourly, range, 'GBP')).toEqual({
      label: 'Task rate £80.00–£150.00/h',
      detail: "The service's rates, by grade or person · 1 person has their own client rate",
    });
    expect(describeJobRate(hourly, rate({ source: 'staff' }), 'GBP').label).toBe('Staff rates');
    expect(
      describeJobRate({ ...hourly, service_name: null }, rate({ source: 'staff' }), 'GBP').detail,
    ).toBe("No service: each person's charge-out rate");
  });

  it("names a client rate for everyone that comes before the job's rate", () => {
    const rule = rate({
      source: 'client_rule',
      job_rate: 12000,
      client_rule: {
        id: 'r1',
        level: 'client_service',
        rate: 11000,
        effective_from: '2026-01-01',
        effective_to: null,
      },
    });
    expect(describeJobRate({ ...hourly, hourly_rate: 12000 }, rule, 'GBP')).toEqual({
      label: 'Client rate £110.00/h',
      detail: 'Agreed with the client for Annual Accounts',
    });
  });

  it('shows the fee of a fixed-fee job and falls back to the job while the rates load', () => {
    const fixed = { ...hourly, billing_basis: 'fixed', fixed_fee: 150000 };
    expect(describeJobRate(fixed, undefined, 'GBP')).toEqual({
      label: 'Fixed fee £1,500.00',
      detail: 'Billed as a fixed fee',
    });
    expect(describeJobRate({ ...hourly, hourly_rate: 9000 }, undefined, 'GBP').label).toBe(
      'Client rate £90.00/h',
    );
    expect(describeJobRate({ ...hourly, billing_basis: 'non_billable' }, undefined, 'GBP')).toEqual(
      { label: 'Non-billable', detail: 'Its time is not billed' },
    );
    expect(taskRateText(null, 'GBP')).toBe('Task rate');
  });
});
