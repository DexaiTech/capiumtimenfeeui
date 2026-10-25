import { describe, expect, it } from 'vitest';

import { ApiError } from '@/services/api';

import {
  describeFailure,
  detailsObject,
  dialogError,
  errorCode,
  fieldDetails,
  toFormError,
} from './errors';
import { describeVariance, formatClock, formatDayList, formatShare, refLabel } from './format';
import { changeLines, formatEntryValue } from './history';
import { chartRows, groupLabel, presetOf, rangePresets, valueLessCost } from './analysis';
import type { TimeEntryHistory, TimeSummaryRow } from '../types';

const apiError = (init: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Bad.', ...init });

describe('errors', () => {
  it('reads the fields a 422 names, and the object details of a 409', () => {
    const fields = apiError({
      details: [{ field: 'minutes', code: 'day_limit', message: 'Too much' }],
    });
    expect(fieldDetails(fields)).toEqual([
      { field: 'minutes', code: 'day_limit', message: 'Too much' },
    ]);
    expect(fieldDetails(new Error('x'))).toEqual([]);
    const locked = apiError({
      status: 409,
      code: 'PERIOD_LOCKED',
      details: { date: '2026-03-15' },
    });
    expect(detailsObject(locked)).toEqual({ date: '2026-03-15' });
    expect(detailsObject(fields)).toBeNull();
    expect(errorCode(locked)).toBe('PERIOD_LOCKED');
  });

  it('renames the API field to the form field of a 422 and leaves other errors alone', () => {
    const error = apiError({ details: [{ field: 'minutes', message: 'Too much' }] });
    const renamed = toFormError(error, { minutes: 'time' });
    expect(fieldDetails(renamed)).toEqual([{ field: 'time', message: 'Too much' }]);
    const conflict = apiError({ status: 409, code: 'JOB_CLOSED' });
    expect(toFormError(conflict, { minutes: 'time' })).toBe(conflict);
  });

  it('words a failure by its status', () => {
    expect(describeFailure(apiError({ status: 403, message: 'No.' }), 'Failed').title).toBe(
      "You don't have permission to do that",
    );
    expect(describeFailure(apiError({ status: 404 }), 'Failed').title).toBe(
      'That record no longer exists',
    );
    expect(describeFailure(apiError({ status: 429, retryAfter: 90 }), 'Failed').description).toBe(
      'Try again in 2 minutes.',
    );
    expect(
      describeFailure(
        apiError({ status: 500, message: 'Boom', requestId: 'r1' }),
        'Could not save',
      ),
    ).toEqual({
      title: 'Could not save',
      description: 'Boom (Request ID: r1)',
    });
    expect(describeFailure(new Error('x'), 'Could not save').description).toMatch(/unexpected/);
    expect(dialogError(apiError({ message: 'Nope' }))).toEqual({
      message: 'Nope',
      requestId: undefined,
    });
  });
});

describe('format', () => {
  it('describes a variance in words and a sign', () => {
    expect(describeVariance(0)).toEqual({ kind: 'on', text: 'On target' });
    expect(describeVariance(30)).toEqual({ kind: 'over', text: '+0:30' });
    expect(describeVariance(-450)).toEqual({ kind: 'under', text: '-7:30' });
  });

  it('formats days, clocks, shares and references', () => {
    expect(formatDayList(['2026-10-13', '2026-10-15'])).toBe('Tue 13/10, Thu 15/10');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-4)).toBe('0:00:00');
    expect(formatShare(45, 60)).toBe('75%');
    expect(formatShare(0, 0)).toBe('—');
    expect(refLabel({ code: 'J00001', name: 'Accounts' })).toBe('J00001 Accounts');
    expect(refLabel({ code: null, name: 'Accounts' })).toBe('Accounts');
  });
});

describe('history', () => {
  it('writes snapshot values the way the screens do', () => {
    expect(formatEntryValue('minutes', 90, 'GBP')).toBe('1:30');
    expect(formatEntryValue('charge_value', 15000, 'GBP')).toBe('£150.00');
    expect(formatEntryValue('entry_date', '2026-09-07', 'GBP')).toBe('07/09/2026');
    expect(formatEntryValue('is_billable', false, 'GBP')).toBe('Non-billable');
    expect(formatEntryValue('description', null, 'GBP')).toBe('—');
    expect(formatEntryValue('description', 'Trial balance', 'GBP')).toBe('Trial balance');
  });

  it('lists what a correction changed without the ids that repeat a name', () => {
    const item: TimeEntryHistory = {
      id: 'h1',
      time_entry_id: 'e1',
      user_id: 'u',
      user_name: 'Pat',
      corrected_by: 'm',
      corrected_by_name: 'Mia',
      reason: 'Mis-keyed',
      before: {},
      after: {},
      changes: {
        minutes: [60, 90],
        charge_value: [10000, 15000],
        job_id: ['a', 'b'],
        job_name: ['Old', 'New'],
      },
      created_at: '2026-09-16T10:00:00Z',
    };
    expect(changeLines(item, 'GBP')).toEqual([
      { field: 'minutes', label: 'Time', before: '1:00', after: '1:30' },
      { field: 'charge_value', label: 'Value', before: '£100.00', after: '£150.00' },
      { field: 'job_name', label: 'Job', before: 'Old', after: 'New' },
    ]);
  });
});

describe('analysis', () => {
  const row = (overrides: Partial<TimeSummaryRow>): TimeSummaryRow => ({
    key: 'k',
    code: null,
    name: 'Name',
    client_name: null,
    entry_count: 1,
    total_minutes: 60,
    chargeable_minutes: 60,
    non_chargeable_minutes: 0,
    chargeable_bp: 10000,
    charge_value: 9500,
    cost_value: 4000,
    ...overrides,
  });

  it('names a group by what it is', () => {
    expect(groupLabel('person', row({ name: 'Ada' }))).toBe('Ada');
    expect(groupLabel('day', row({ key: '2026-10-14' }))).toBe('14/10/2026');
    expect(groupLabel('week', row({ key: '2026-10-12' }))).toBe('Week of 12/10/2026');
    expect(groupLabel('month', row({ key: '2026-10-01' }))).toBe('October 2026');
  });

  it('subtracts the cost from the value, unless the cost is hidden', () => {
    expect(valueLessCost({ charge_value: 9500, cost_value: 4000 })).toBe(5500);
    expect(valueLessCost({ charge_value: 9500, cost_value: null })).toBeNull();
  });

  it('draws periods in date order and the biggest groups first, cut after a limit', () => {
    const periods = chartRows([row({ key: '2026-10-02' }), row({ key: '2026-10-01' })], 'day');
    expect(periods.map((item) => item.key)).toEqual(['2026-10-01', '2026-10-02']);
    const people = chartRows(
      [
        row({ name: 'A', total_minutes: 10 }),
        row({ name: 'B', total_minutes: 30 }),
        row({ name: 'C', total_minutes: 20 }),
      ],
      'person',
      2,
    );
    expect(people.map((item) => item.name)).toEqual(['B', 'C']);
  });

  it('offers the usual ranges and recognises them again', () => {
    const presets = rangePresets('2026-10-14', 1);
    expect(presets.find((preset) => preset.value === 'this-week')).toMatchObject({
      from: '2026-10-12',
      to: '2026-10-18',
    });
    expect(presets.find((preset) => preset.value === 'this-month')).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-31',
    });
    expect(presets.find((preset) => preset.value === 'last-month')).toMatchObject({
      from: '2026-09-01',
      to: '2026-09-30',
    });
    expect(presets.find((preset) => preset.value === 'last-30')).toMatchObject({
      from: '2026-09-15',
      to: '2026-10-14',
    });
    expect(presetOf('2026-10-01', '2026-10-31', presets)).toBe('this-month');
    expect(presetOf('2026-10-02', '2026-10-31', presets)).toBe('custom');
  });
});
