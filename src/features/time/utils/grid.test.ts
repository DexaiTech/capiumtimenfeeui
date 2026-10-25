import { describe, expect, it } from 'vitest';

import type { WeekGrid } from '../types';
import { ACCOUNTS_JOB, ACME, PREPARATION, VAT_JOB, entry } from '../test/fixtures';
import { buildRows, cellKey, entriesByCell, rowKey, servicesByJob, splitCellKey } from './grid';

const identity = {
  client_id: ACME.id,
  job_id: ACCOUNTS_JOB.id,
  activity_code_id: PREPARATION.id,
  is_billable: true,
};

const GRID: WeekGrid = {
  user_id: 'u',
  week_start: '2026-10-12',
  week_end: '2026-10-18',
  days: [
    '2026-10-12',
    '2026-10-13',
    '2026-10-14',
    '2026-10-15',
    '2026-10-16',
    '2026-10-17',
    '2026-10-18',
  ],
  timesheet_id: null,
  timesheet_status: 'open',
  rows: [
    {
      ...identity,
      client_code: 'AC001',
      client_name: 'Acme Ltd',
      job_number: 'J00001',
      job_name: 'Year-end accounts 2026',
      activity_code: 'PREP',
      activity_name: 'Preparation',
      minutes: [240, 0, 0, 0, 0, 0, 0],
      total_minutes: 240,
      entry_ids: ['e1'],
    },
  ],
  day_totals: [240, 0, 0, 0, 0, 0, 0],
  total_minutes: 240,
  chargeable_minutes: 240,
  non_chargeable_minutes: 0,
  today: '2026-10-14',
  targets: null,
  working_days: [],
  missing_days: [],
  day_variance: [],
};

describe('grid helpers', () => {
  it('keys a row by client, job, activity and billable status', () => {
    expect(rowKey(identity)).toBe(`${ACME.id}|${ACCOUNTS_JOB.id}|${PREPARATION.id}|billable`);
    expect(rowKey({ ...identity, is_billable: false })).toContain('non-billable');
    expect(
      rowKey({ client_id: null, job_id: null, activity_code_id: null, is_billable: false }),
    ).toBe('||'.concat('|non-billable'));
  });

  it('splits a cell key back into its row and date', () => {
    const key = cellKey(rowKey(identity), '2026-10-12');
    expect(splitCellKey(key)).toEqual({ row: rowKey(identity), date: '2026-10-12' });
  });

  it('sorts the entries of a week into their cells', () => {
    const first = entry({ entry_date: '2026-10-12', minutes: 60 });
    const second = entry({ entry_date: '2026-10-12', minutes: 30 });
    const other = entry({ entry_date: '2026-10-13', minutes: 30, job: VAT_JOB });
    const cells = entriesByCell([first, second, other]);
    expect(cells.get(cellKey(rowKey(first), '2026-10-12'))).toEqual([first, second]);
    expect(cells.get(cellKey(rowKey(other), '2026-10-13'))).toEqual([other]);
  });

  it('remembers the service of each job from the entries', () => {
    const services = servicesByJob([entry({ entry_date: '2026-10-12', minutes: 60 })]);
    expect(services.get(ACCOUNTS_JOB.id)).toBe('Year-end accounts');
  });

  it('adds the rows the person added after those of the grid, once', () => {
    const draft = {
      client_id: ACME.id,
      client_code: 'AC001',
      client_name: 'Acme Ltd',
      job_id: VAT_JOB.id,
      job_number: 'J00002',
      job_name: 'VAT returns',
      activity_code_id: null,
      activity_code: null,
      activity_name: null,
      is_billable: true,
      service_name: 'Tax returns',
    };
    const rows = buildRows(
      GRID,
      [draft, draft, { ...draft, job_id: ACCOUNTS_JOB.id, activity_code_id: PREPARATION.id }],
      new Map(),
    );
    expect(rows.map((row) => [row.job_number, row.draft])).toEqual([
      ['J00001', false],
      ['J00002', true],
    ]);
    expect(rows[1]?.minutes).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
