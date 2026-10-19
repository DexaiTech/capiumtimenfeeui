import { describe, expect, it } from 'vitest';

import { LEE, PEOPLE, SAM, ME, timesheetOf } from '../test/fixtures';
import type { MissingTimesheet } from '../types';
import { buildTeamRows, isMissing, type TeamRow } from './team';
import { weekDates } from './weeks';

const DAYS = weekDates('2026-10-05');

const missing = (overrides: Partial<MissingTimesheet>): MissingTimesheet => ({
  user_id: SAM,
  name: 'Sam Staff',
  week_start: '2026-10-05',
  status: 'none',
  timesheet_id: null,
  logged_minutes: 0,
  expected_minutes: 2250,
  missing_days: ['2026-10-05'],
  last_reminded_at: null,
  has_login: true,
  ...overrides,
});

describe('buildTeamRows', () => {
  it('takes the unsubmitted from the missing list and the submitted from the timesheets', () => {
    const rows = buildTeamRows({
      missing: [
        missing({}),
        missing({ user_id: LEE, name: 'Lee Locum', has_login: false, expected_minutes: 1500 }),
      ],
      sheets: [
        timesheetOf(ME, '2026-10-05', 'submitted', { total_minutes: 2000 }),
        timesheetOf(SAM, '2026-10-05', 'open'),
      ],
      staff: PEOPLE,
      days: DAYS,
    });
    expect(rows.map((row) => [row.name, row.status, row.logged, row.expected])).toEqual([
      ['Ada Lovelace', 'submitted', 2000, 2250],
      ['Lee Locum', 'none', 0, 1500],
      ['Sam Staff', 'none', 0, 2250],
    ]);
    expect(rows[1]?.hasLogin).toBe(false);
    // The submitted sheet has no expected time of its own: it is worked out from the staff list.
    expect(rows[0]?.manager).toBeNull();
    expect(rows[2]?.manager).toEqual({ id: ME, name: 'Ada Lovelace' });
  });

  it('cannot say what was expected without the staff list', () => {
    const rows = buildTeamRows({
      missing: [],
      sheets: [timesheetOf(SAM, '2026-10-05', 'approved', { total_minutes: 2250 })],
      staff: undefined,
      days: DAYS,
    });
    expect(rows[0]).toMatchObject({
      name: 'Sam Staff',
      expected: null,
      hasLogin: null,
      status: 'approved',
    });
  });

  it('keeps only the people a manager approves', () => {
    const rows = buildTeamRows({
      missing: [missing({}), missing({ user_id: ME, name: 'Ada Lovelace' })],
      sheets: [],
      staff: PEOPLE,
      days: DAYS,
      managerId: ME,
    });
    expect(rows.map((row) => row.name)).toEqual(['Sam Staff']);
  });

  it('calls a week missing until it is submitted', () => {
    const rows = (['none', 'open', 'rejected', 'submitted', 'approved'] as const).map(
      (status) => ({ status }) as unknown as TeamRow,
    );
    expect(rows.map(isMissing)).toEqual([true, true, true, false, false]);
  });
});
