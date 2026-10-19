import { testUser } from '@/test/fixtures';

import type {
  Adjustment,
  ClientRef,
  HistoricItem,
  HistoricReport,
  HistoricRow,
  Member,
  Movement,
  Transfer,
  WipAges,
  WipGroupRow,
  WipGroupTotals,
  WipItem,
  WriteOff,
} from '../types';

/** The practice and its people: Ada is the signed-in person. */
export const IDS = {
  acme: '0198c1f2-0000-7000-8000-0000000000c1',
  globex: '0198c1f2-0000-7000-8000-0000000000c2',
  ada: testUser.id,
  ben: '0198c1f2-0000-7000-8000-000000000002',
  cara: '0198c1f2-0000-7000-8000-000000000003',
} as const;

export const acme: ClientRef = { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' };
export const globex: ClientRef = { id: IDS.globex, code: 'GLOB', name: 'Globex plc' };
export const clients: ClientRef[] = [acme, globex];

/** A job as the pickers list it (`GET /jobs`). */
export interface JobFixture {
  id: string;
  number: string;
  name: string;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

const jobFixture = (id: string, number: string, name: string, client: ClientRef): JobFixture => ({
  id,
  number,
  name,
  client_id: client.id,
  client_code: client.code,
  client_name: client.name,
  service_id: null,
  service_name: null,
});

export const jobs: JobFixture[] = [
  jobFixture('j-1', 'J00001', 'Year-end accounts', acme),
  jobFixture('j-2', 'J00002', 'Bookkeeping', acme),
  jobFixture('j-3', 'J00003', 'Audit', globex),
];

const member = (user_id: string, full_name: string, email: string): Member => ({
  user_id,
  full_name,
  email,
  status: 'active',
});

export const members: Member[] = [
  member(IDS.ada, 'Ada Lovelace', 'ada@example.com'),
  member(IDS.ben, 'Ben Carter', 'ben@example.com'),
  member(IDS.cara, 'Cara Diaz', 'cara@example.com'),
];

export const services = [
  { id: 's-1', code: 'AUD', name: 'Audit', is_active: true },
  { id: 's-2', code: 'BK', name: 'Bookkeeping', is_active: true },
];

/* --------------------------------- Summary --------------------------------- */

export const ages = (overrides: Partial<WipAges> = {}): WipAges => ({
  days_0_30: 0,
  days_31_60: 0,
  days_61_90: 0,
  days_90_plus: 0,
  ...overrides,
});

/** A row of `GET /wip/summary`: grouped by client unless told otherwise. */
export function groupRow(overrides: Partial<WipGroupRow> = {}): WipGroupRow {
  return {
    group_by: 'client',
    key: IDS.acme,
    name: 'Acme Ltd',
    code: 'ACME',
    client: null,
    minutes: 600,
    hours: '10.00',
    time: 90000,
    fixed_fee: 20000,
    expense: 5000,
    total: 115000,
    ages: ages({ days_0_30: 80000, days_31_60: 20000, days_90_plus: 15000 }),
    oldest_date: '2026-06-02',
    item_count: 7,
    over_90_bp: 1304,
    ...overrides,
  };
}

/** The totals over some rows, as the API adds them up. */
export function totalsOf(rows: WipGroupRow[]): WipGroupTotals {
  const sum = (pick: (row: WipGroupRow) => number) => rows.reduce((all, row) => all + pick(row), 0);
  const total = sum((row) => row.total);
  const dates = rows.map((row) => row.oldest_date).filter((date): date is string => date !== null);
  return {
    minutes: sum((row) => row.minutes),
    hours: (sum((row) => row.minutes) / 60).toFixed(2),
    time: sum((row) => row.time),
    fixed_fee: sum((row) => row.fixed_fee),
    expense: sum((row) => row.expense),
    total,
    ages: ages({
      days_0_30: sum((row) => row.ages.days_0_30),
      days_31_60: sum((row) => row.ages.days_31_60),
      days_61_90: sum((row) => row.ages.days_61_90),
      days_90_plus: sum((row) => row.ages.days_90_plus),
    }),
    oldest_date: dates.sort()[0] ?? null,
    item_count: sum((row) => row.item_count),
    over_90_bp:
      total > 0 ? Math.round((sum((row) => row.ages.days_90_plus) / total) * 10_000) : null,
  };
}

/* ---------------------------------- Items ---------------------------------- */

/** A time item of `GET /wip/items`: selectable, on Acme's year-end job. */
export function item(overrides: Partial<WipItem> = {}): WipItem {
  return {
    kind: 'time',
    id: 't-1',
    date: '2026-09-07',
    job: { id: 'j-1', number: 'J00001', name: 'Year-end accounts', billing_basis: 'hourly' },
    person: { user_id: IDS.ben, full_name: 'Ben Carter' },
    description: 'Bank reconciliation',
    minutes: 90,
    hours: '1.50',
    rate: 12000,
    value: 18000,
    client: acme,
    age_days: 41,
    component: 'time',
    charge_value: 18000,
    selectable: true,
    ...overrides,
  };
}

/* ------------------------------ Adjustments etc. ------------------------------ */

export const person = (user_id: string, full_name: string) => ({ user_id, full_name });

/** A write-off still waiting for approval, requested by Ben. */
export function adjustment(overrides: Partial<Adjustment> = {}): Adjustment {
  return {
    id: 'a-1',
    client: acme,
    job: { id: 'j-1', number: 'J00001', name: 'Year-end accounts' },
    kind: 'write_off',
    component: 'time',
    amount: 250000,
    signed_amount: -250000,
    effective_date: '2026-10-10',
    reason: 'Client disputed the hours',
    status: 'pending',
    approval_required: true,
    threshold: 50000,
    requested_by: person(IDS.ben, 'Ben Carter'),
    requested_at: '2026-10-10T09:00:00Z',
    decided_by: null,
    decided_at: null,
    decision_note: null,
    reversed_by: null,
    reversed_at: null,
    reversal_reason: null,
    in_force: false,
    movement_id: null,
    ...overrides,
  };
}

export function transfer(overrides: Partial<Transfer> = {}): Transfer {
  return {
    id: 'tr-1',
    client: acme,
    from_job: { id: 'j-1', number: 'J00001', name: 'Year-end accounts' },
    to_job: { id: 'j-2', number: 'J00002', name: 'Bookkeeping' },
    component: 'time',
    amount: 36000,
    effective_date: '2026-10-12',
    reason: 'Booked to the wrong job',
    items: [
      { kind: 'time', id: 't-1', value: 18000 },
      { kind: 'time', id: 't-2', value: 18000 },
    ],
    status: 'applied',
    created_by: person(IDS.ada, 'Ada Lovelace'),
    created_at: '2026-10-12T10:00:00Z',
    reversed_by: null,
    reversed_at: null,
    reversal_reason: null,
    ...overrides,
  };
}

/** Two items of Acme's written off by Ada, not tied to a job. */
export function writeOff(overrides: Partial<WriteOff> = {}): WriteOff {
  return {
    id: 'wo-1',
    client: acme,
    job_id: null,
    written_off_on: '2026-10-09',
    reason: 'Client agreed to drop the courier cost',
    total_wip_value: 4550,
    item_count: 2,
    created_by: IDS.ada,
    created_at: '2026-10-09T08:00:00Z',
    ...overrides,
  };
}

export function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: 'm-1',
    kind: 'write_off',
    scope: 'amount',
    component: 'time',
    client: acme,
    job: { id: 'j-1', number: 'J00001', name: 'Year-end accounts' },
    amount: -50000,
    effective_date: '2026-10-09',
    reason: 'Goodwill',
    actor: person(IDS.ada, 'Ada Lovelace'),
    approval_state: 'not_required',
    approved_by: null,
    approved_at: null,
    reversal_of_id: null,
    reversed: false,
    source_type: 'adjustment',
    source_id: 'a-9',
    item_count: 0,
    created_at: '2026-10-09T08:00:00Z',
    ...overrides,
  };
}

/* -------------------------------- Historic WIP -------------------------------- */

export function historicRow(overrides: Partial<HistoricRow> = {}): HistoricRow {
  return {
    group_by: 'client',
    key: IDS.acme,
    name: 'Acme Ltd',
    code: 'ACME',
    client: null,
    billing_type: null,
    minutes: 600,
    hours: '10.00',
    time_wip: 90000,
    fixed_fee_wip: 20000,
    expense_wip: 5000,
    write_ons: 10000,
    write_offs: -15000,
    total: 110000,
    ages: ages({ days_0_30: 80000, days_31_60: 10000, days_90_plus: 20000 }),
    oldest_date: '2026-05-20',
    item_count: 6,
    ...overrides,
  };
}

export function historicReport(
  rows: HistoricRow[],
  overrides: Partial<HistoricReport> = {},
): HistoricReport {
  const sum = (pick: (row: HistoricRow) => number) => rows.reduce((all, row) => all + pick(row), 0);
  return {
    rows,
    totals: {
      minutes: sum((row) => row.minutes),
      hours: (sum((row) => row.minutes) / 60).toFixed(2),
      time_wip: sum((row) => row.time_wip),
      fixed_fee_wip: sum((row) => row.fixed_fee_wip),
      expense_wip: sum((row) => row.expense_wip),
      write_ons: sum((row) => row.write_ons),
      write_offs: sum((row) => row.write_offs),
      total: sum((row) => row.total),
      ages: ages({
        days_0_30: sum((row) => row.ages.days_0_30),
        days_31_60: sum((row) => row.ages.days_31_60),
        days_61_90: sum((row) => row.ages.days_61_90),
        days_90_plus: sum((row) => row.ages.days_90_plus),
      }),
      oldest_date: rows[0]?.oldest_date ?? null,
      item_count: sum((row) => row.item_count),
    },
    filters: { as_at: '2026-09-30', group_by: 'client' },
    snapshot: { frozen: true, taken_at: '2026-10-01T06:00:00Z', source: 'snapshot' },
    notice: 'Figures as at 30 September 2026 are frozen and will not change.',
    ...overrides,
  };
}

export function historicItem(overrides: Partial<HistoricItem> = {}): HistoricItem {
  return {
    kind: 'time',
    id: 'h-1',
    component: 'time',
    date: '2026-08-20',
    age_days: 41,
    client: acme,
    job_id: 'j-1',
    job_number: 'J00001',
    job_name: 'Year-end accounts',
    billing_type: 'hourly',
    description: 'Preparing the accounts',
    minutes: 120,
    value: 24000,
    charge_value: 24000,
    ...overrides,
  };
}
