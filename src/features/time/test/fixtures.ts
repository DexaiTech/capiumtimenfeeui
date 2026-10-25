import { testUser } from '@/test/fixtures';
import { addDays } from '@/utils/dates';

import type { JobRef, StaffPerson, TimeEntry, Timer, Timesheet, TimesheetStatus } from '../types';

/** The practice's "now" in every test: a Wednesday, 11:00 in London (BST). */
export const NOW_ISO = '2026-10-14T10:00:00Z';
export const TODAY = '2026-10-14';
/** Monday of the week that holds `TODAY`, and the week before it. */
export const WEEK = '2026-10-12';
export const PREVIOUS_WEEK = '2026-10-05';

/** The signed-in person (`testUser`). */
export const ME = testUser.id;
export const SAM = '0198c1f2-0000-7000-8000-0000000000c1';
/** A member of staff without a login: nobody can sign in as them. */
export const LEE = '0198c1f2-0000-7000-8000-0000000000c2';

export const ACME = { id: '0198c1f2-0000-7000-8000-0000000000d1', code: 'AC001', name: 'Acme Ltd' };
export const BETA = { id: '0198c1f2-0000-7000-8000-0000000000d2', code: 'BE002', name: 'Beta LLP' };
export const CLIENTS = [ACME, BETA];

export const ACCOUNTS = { id: '0198c1f2-0000-7000-8000-0000000000e1', name: 'Year-end accounts' };
export const TAX = { id: '0198c1f2-0000-7000-8000-0000000000e2', name: 'Tax returns' };

export const PREPARATION = {
  id: '0198c1f2-0000-7000-8000-0000000000f1',
  code: 'PREP',
  name: 'Preparation',
  is_chargeable: true,
};
export const REVIEW = {
  id: '0198c1f2-0000-7000-8000-0000000000f2',
  code: 'REV',
  name: 'Review',
  is_chargeable: true,
};
export const ADMIN = {
  id: '0198c1f2-0000-7000-8000-0000000000f3',
  code: 'ADM',
  name: 'Admin',
  is_chargeable: false,
};
export const ACTIVITIES = [PREPARATION, REVIEW, ADMIN];

const jobBase = { billing_basis: 'hourly' as const };

export const ACCOUNTS_JOB: JobRef = {
  ...jobBase,
  id: '0198c1f2-0000-7000-8000-000000000a01',
  number: 'J00001',
  name: 'Year-end accounts 2026',
  status: 'in_progress',
  client_id: ACME.id,
  client_code: ACME.code,
  client_name: ACME.name,
  service_id: ACCOUNTS.id,
  service_name: ACCOUNTS.name,
};
export const VAT_JOB: JobRef = {
  ...jobBase,
  id: '0198c1f2-0000-7000-8000-000000000a02',
  number: 'J00002',
  name: 'VAT returns',
  status: 'in_progress',
  client_id: ACME.id,
  client_code: ACME.code,
  client_name: ACME.name,
  service_id: TAX.id,
  service_name: TAX.name,
};
export const CLOSED_JOB: JobRef = {
  ...jobBase,
  id: '0198c1f2-0000-7000-8000-000000000a03',
  number: 'J00003',
  name: 'Payroll 2025',
  status: 'completed',
  client_id: BETA.id,
  client_code: BETA.code,
  client_name: BETA.name,
  service_id: null,
  service_name: null,
};
export const JOBS = [ACCOUNTS_JOB, VAT_JOB, CLOSED_JOB];

export const PEOPLE: StaffPerson[] = [
  {
    id: ME,
    code: 'ADA',
    full_name: 'Ada Lovelace',
    status: 'active',
    has_login: true,
    approver: null,
    weekly_capacity_minutes: 2250,
    working_days: [1, 2, 3, 4, 5],
    start_date: '2020-01-01',
    leaving_date: null,
  },
  {
    id: SAM,
    code: 'SAM',
    full_name: 'Sam Staff',
    status: 'active',
    has_login: true,
    approver: { id: ME, full_name: 'Ada Lovelace' },
    weekly_capacity_minutes: 2250,
    working_days: [1, 2, 3, 4, 5],
    start_date: '2021-03-01',
    leaving_date: null,
  },
  {
    id: LEE,
    code: 'LEE',
    full_name: 'Lee Locum',
    status: 'active',
    has_login: false,
    approver: { id: ME, full_name: 'Ada Lovelace' },
    weekly_capacity_minutes: 1500,
    working_days: [1, 2, 3, 4, 5],
    start_date: '2022-06-01',
    leaving_date: null,
  },
];

/** The sheet of a week gets an id that tells whose and which week it is. */
export const sheetId = (userId: string, weekStart: string) =>
  `sheet-${userId.slice(-2)}-${weekStart}`;

export const CHARGE_RATE = 9500;
export const COST_RATE = 4000;

export const poundsFor = (minutes: number, rate: number) => Math.round((minutes * rate) / 60);

let counter = 0;

export interface EntryInput {
  id?: string;
  entry_date: string;
  minutes: number;
  user_id?: string;
  status?: TimesheetStatus;
  job?: JobRef | null;
  client?: { id: string; code: string; name: string } | null;
  activity?: { id: string; code: string; name: string } | null;
  description?: string | null;
  internal_note?: string | null;
  is_billable?: boolean;
  billing_status?: TimeEntry['billing_status'];
  created_by?: string | null;
  weekStart?: string;
}

/** A time entry as the API returns it, with the names filled in and the value worked out. */
export function entry(input: EntryInput): TimeEntry {
  counter += 1;
  const job = input.job === undefined ? ACCOUNTS_JOB : input.job;
  const client =
    input.client === undefined
      ? job
        ? { id: job.client_id, code: job.client_code, name: job.client_name }
        : null
      : input.client;
  const activity = input.activity === undefined ? PREPARATION : input.activity;
  const userId = input.user_id ?? ME;
  const status = input.status ?? 'open';
  const billingStatus = input.billing_status ?? 'unbilled';
  return {
    id: input.id ?? `entry-${counter}`,
    user_id: userId,
    timesheet_id: sheetId(userId, input.weekStart ?? WEEK),
    timesheet_status: status,
    entry_date: input.entry_date,
    minutes: input.minutes,
    client_id: client?.id ?? null,
    client_code: client?.code ?? null,
    client_name: client?.name ?? null,
    job_id: job?.id ?? null,
    job_number: job?.number ?? null,
    job_name: job?.name ?? null,
    service_id: job?.service_id ?? null,
    service_name: job?.service_name ?? null,
    activity_code_id: activity?.id ?? null,
    activity_code: activity?.code ?? null,
    activity_name: activity?.name ?? null,
    description: input.description ?? null,
    internal_note: input.internal_note ?? null,
    is_billable: input.is_billable ?? true,
    charge_rate: CHARGE_RATE,
    charge_value: poundsFor(input.minutes, CHARGE_RATE),
    cost_rate: COST_RATE,
    cost_value: poundsFor(input.minutes, COST_RATE),
    rate_source: 'job',
    billing_status: billingStatus,
    is_locked: status === 'submitted' || status === 'approved' || billingStatus !== 'unbilled',
    created_by: input.created_by === undefined ? userId : input.created_by,
    created_at: `2026-10-13T09:00:0${counter % 10}Z`,
    updated_at: '2026-10-13T09:00:00Z',
  };
}

/** The week the tests start from: Monday 4:00 and 3:30 on two jobs, Tuesday 7:30. */
export function weekEntries(): TimeEntry[] {
  return [
    entry({
      id: 'e-mon-1',
      entry_date: '2026-10-12',
      minutes: 240,
      description: 'Trial balance',
    }),
    entry({
      id: 'e-mon-2',
      entry_date: '2026-10-12',
      minutes: 210,
      job: VAT_JOB,
      activity: REVIEW,
    }),
    entry({
      id: 'e-tue-1',
      entry_date: '2026-10-13',
      minutes: 450,
    }),
  ];
}

export function previousWeekEntries(): TimeEntry[] {
  return [
    entry({ id: 'p-mon-1', entry_date: '2026-10-05', minutes: 300, weekStart: PREVIOUS_WEEK }),
    entry({
      id: 'p-tue-1',
      entry_date: '2026-10-06',
      minutes: 120,
      job: CLOSED_JOB,
      activity: null,
      weekStart: PREVIOUS_WEEK,
    }),
  ];
}

export function runningTimer(overrides: Partial<Timer> = {}): Timer {
  return {
    id: 'timer-1',
    user_id: ME,
    client_id: ACME.id,
    job_id: ACCOUNTS_JOB.id,
    activity_code_id: PREPARATION.id,
    description: 'Bank reconciliation',
    is_billable: true,
    is_running: true,
    started_at: '2026-10-14T09:00:00Z',
    accumulated_seconds: 0,
    elapsed_seconds: 3725,
    started_on: TODAY,
    created_at: '2026-10-14T09:00:00Z',
    ...overrides,
  };
}

export function timesheetOf(
  userId: string,
  weekStart: string,
  status: TimesheetStatus,
  overrides: Partial<Timesheet> = {},
): Timesheet {
  const name = PEOPLE.find((person) => person.id === userId)?.full_name ?? null;
  return {
    id: sheetId(userId, weekStart),
    user_id: userId,
    user_name: name,
    week_start: weekStart,
    week_end: addDays(weekStart, 6),
    status,
    submitted_at: status === 'open' ? null : '2026-10-16T16:00:00Z',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    entry_count: 0,
    total_minutes: 0,
    billable_minutes: 0,
    non_billable_minutes: 0,
    billable_value: 0,
    created_at: '2026-10-12T08:00:00Z',
    updated_at: '2026-10-16T16:00:00Z',
    ...overrides,
  };
}
