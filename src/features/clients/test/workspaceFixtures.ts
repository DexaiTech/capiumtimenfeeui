import type { CentralClient } from '../central/types';
import type { ClientDetail } from '../types';
import type {
  ClientOverview,
  ClientWip,
  CreditNoteRow,
  DisbursementRow,
  ExpensesOverview,
  InvoiceRow,
  InvoiceTemplateOption,
  JobRow,
  PaymentRow,
  TimeEntryRow,
  TimeOverview,
  VatRateOption,
  WipItem,
} from '../workspace/types';
import { mutual, techwave, techwaveDetail, testMembers } from './fixtures';

/** Ids look like the API's UUIDs; the prefix tells the kinds of record apart. */
const gid = (tail: string) => `0198c1f2-0000-7000-8000-${tail}`;

export const GRACE_ID = testMembers[0]?.user_id ?? gid('00000000f001');
export const ADA_ID = testMembers[1]?.user_id ?? gid('00000000f002');

/* --------------------------------- Client details --------------------------------- */

/** Techwave after "Enable" from the central service: it follows the central name and address. */
export const linkedDetail: ClientDetail = {
  ...techwaveDetail,
  central_client_id: 'cen-0001',
  central_sync_state: 'synced',
  central_synced_at: '2026-05-12T10:00:00Z',
};

export const mutualDetail: ClientDetail = {
  ...mutual,
  contacts: [],
  engagements: [],
  rates: [],
  financials: techwaveDetail.financials,
  recurring_fees: techwaveDetail.recurring_fees,
  default_service: null,
  invoice_template: null,
  merged_into: null,
};

/** Mutual Technologies, merged into Techwave by the central service: read-only history. */
export const mergedDetail: ClientDetail = {
  ...mutualDetail,
  status: 'inactive',
  central_client_id: 'cen-0002',
  central_sync_state: 'synced',
  central_synced_at: '2026-05-12T10:00:00Z',
  merged_into_client_id: techwave.id,
  merged_into: { id: techwave.id, code: techwave.code, name: techwave.name },
};

/* ------------------------------------ Overview ------------------------------------ */

const TIME_OVERVIEW: TimeOverview = {
  scope: 'all',
  minutes_30d: 960,
  billable_minutes_30d: 750,
  minutes_ytd: 3600,
  billable_minutes_ytd: 3000,
  last_entry_on: '2026-06-12',
};

const EXPENSES_OVERVIEW: ExpensesOverview = {
  scope: 'all',
  count: 2,
  net: 4500,
  gross: 5400,
  awaiting_approval: 0,
};

export const techwaveOverview: ClientOverview = {
  client_id: techwave.id,
  as_of: '2026-06-15',
  ytd_from: '2026-01-01',
  last_30d_from: '2026-05-17',
  jobs: {
    total: 3,
    by_status: { not_started: 1, in_progress: 1, on_hold: 0, completed: 1, closed: 0 },
  },
  time: TIME_OVERVIEW,
  expenses: EXPENSES_OVERVIEW,
  wip: {
    time: 100000,
    fixed_fee: 20000,
    expense: 5000,
    total: 125000,
    ageing: { '0_30': 60000, '31_60': 40000, '61_90': 15000, '90_plus': 10000 },
    item_count: 5,
  },
  invoices: {
    count: 4,
    by_status: { draft: 1, issued: 0, overdue: 1, part_paid: 1, paid: 1, void: 0 },
    billed_ytd: 800000,
    outstanding: 120000,
    overdue: 30000,
    last_invoice_on: '2026-05-30',
  },
  payments: { received_ytd: 600000, count_ytd: 3, last_payment_on: '2026-06-02' },
  recent_activity: [
    {
      id: gid('00000000a001'),
      action: 'invoice.issued',
      label: 'Invoice issued',
      at: '2026-06-10T09:00:00Z',
      actor_user_id: GRACE_ID,
      actor_name: 'Grace Hopper',
      target_type: 'invoice',
      target_id: gid('00000000b003'),
    },
    {
      id: gid('00000000a002'),
      action: 'client.central_synced',
      label: 'Details confirmed by the central service',
      at: '2026-06-01T08:30:00Z',
      actor_user_id: null,
      actor_name: null,
      target_type: 'client',
      target_id: techwave.id,
    },
  ],
  tab_counts: {
    jobs: 3,
    time_entries: 18,
    expenses: 2,
    wip: 5,
    invoices: 4,
    payments: 3,
    contacts: 2,
  },
};

/** What a member of staff gets: no WIP, invoices or payments, and only their own time. */
export const staffOverview: ClientOverview = {
  ...techwaveOverview,
  time: { ...TIME_OVERVIEW, scope: 'own' },
  expenses: { ...EXPENSES_OVERVIEW, scope: 'own' },
  wip: null,
  invoices: null,
  payments: null,
  tab_counts: {
    ...techwaveOverview.tab_counts,
    wip: null,
    invoices: null,
    payments: null,
  },
};

/** Every section the caller may not see is null. */
export const emptyOverview: ClientOverview = {
  ...techwaveOverview,
  jobs: null,
  time: null,
  expenses: null,
  wip: null,
  invoices: null,
  payments: null,
  recent_activity: [],
  tab_counts: {
    jobs: null,
    time_entries: null,
    expenses: null,
    wip: null,
    invoices: null,
    payments: null,
    contacts: 0,
  },
};

/* ------------------------------------- Records ------------------------------------- */

const job = (
  tail: string,
  fields: Pick<JobRow, 'number' | 'name' | 'status'> & Partial<JobRow>,
): JobRow => ({
  id: gid(tail),
  client_id: techwave.id,
  service_name: 'Accounts',
  billing_basis: 'fixed',
  fixed_fee: 150000,
  budget_minutes: 2400,
  budget_fee: null,
  start_date: '2026-04-01',
  due_date: '2026-09-30',
  partner_user_id: null,
  manager_user_id: GRACE_ID,
  logged_minutes: 600,
  billable_minutes: 600,
  time_value: 60000,
  wip_value: 60000,
  billed_value: 0,
  budget_minutes_used_bp: 2500,
  ...fields,
});

export const jobs: JobRow[] = [
  job('a00000000001', { number: 'J-0001', name: 'Year-end accounts 2026', status: 'in_progress' }),
  job('a00000000002', {
    number: 'J-0002',
    name: 'VAT return Q1',
    status: 'planned',
    service_name: 'VAT Returns',
    due_date: '2026-07-31',
    wip_value: 0,
    time_value: 0,
    logged_minutes: 0,
    billable_minutes: 0,
    budget_minutes_used_bp: 0,
  }),
  job('a00000000003', {
    number: 'J-0003',
    name: 'Payroll April',
    status: 'completed',
    service_name: 'Payroll',
    billed_value: 5000,
    wip_value: 0,
  }),
];

const entry = (
  tail: string,
  fields: Pick<TimeEntryRow, 'entry_date' | 'minutes'> & Partial<TimeEntryRow>,
): TimeEntryRow => {
  const row: TimeEntryRow = {
    id: gid(tail),
    user_id: GRACE_ID,
    timesheet_id: gid('e00000000001'),
    timesheet_status: 'open',
    client_id: techwave.id,
    client_code: techwave.code,
    client_name: techwave.name,
    job_id: jobs[0]?.id ?? null,
    job_number: 'J-0001',
    job_name: 'Year-end accounts 2026',
    service_id: null,
    service_name: null,
    activity_code_id: null,
    activity_code: 'ACC',
    activity_name: 'Accounts preparation',
    description: null,
    internal_note: null,
    is_billable: true,
    charge_rate: 9500,
    charge_value: 0,
    cost_rate: null,
    cost_value: null,
    rate_source: null,
    billing_status: 'unbilled',
    is_locked: false,
    created_by: GRACE_ID,
    created_at: '2026-06-12T09:00:00Z',
    updated_at: '2026-06-12T09:00:00Z',
    ...fields,
  };
  // As the API works it out: anything no longer unbilled is locked.
  return { ...row, is_locked: fields.is_locked ?? row.billing_status !== 'unbilled' };
};

export const timeEntries: TimeEntryRow[] = [
  entry('c00000000001', {
    entry_date: '2026-06-12',
    minutes: 90,
    description: 'Prepared the trial balance',
    charge_value: 14250,
  }),
  entry('c00000000002', {
    entry_date: '2026-06-11',
    minutes: 45,
    is_billable: false,
    charge_value: 0,
    billing_status: 'written_off',
    description: 'Internal review',
  }),
  entry('c00000000003', {
    entry_date: '2026-06-10',
    minutes: 450,
    user_id: ADA_ID,
    charge_value: 71250,
    billing_status: 'billed',
    description: 'Audit fieldwork',
  }),
];

export const disbursements: DisbursementRow[] = [
  {
    id: gid('d00000000001'),
    client_id: techwave.id,
    job_id: null,
    incurred_on: '2026-06-05',
    description: 'Companies House filing fee',
    supplier: 'Companies House',
    amount: 1300,
    is_billable: true,
    billing_status: 'unbilled',
    created_by: GRACE_ID,
  },
  {
    id: gid('d00000000002'),
    client_id: techwave.id,
    job_id: null,
    incurred_on: '2026-05-20',
    description: 'Courier to the client',
    supplier: null,
    amount: 3200,
    is_billable: false,
    billing_status: 'written_off',
    created_by: null,
  },
];

const wipJob = (tail: string, number: string, name: string) => ({
  id: gid(tail),
  number,
  name,
  billing_basis: 'fixed',
});

const accountsJob = wipJob('a00000000001', 'J-0001', 'Year-end accounts 2026');
const payrollJob = wipJob('a00000000003', 'J-0003', 'Payroll April');

/** The day the WIP tests fix: the ages below are counted from it. */
export const WIP_TODAY = '2026-06-15';

export const wipItems: WipItem[] = [
  {
    kind: 'time',
    id: gid('c00000000001'),
    date: '2026-06-10',
    job: accountsJob,
    person: { user_id: GRACE_ID, full_name: 'Grace Hopper' },
    description: 'Prepared the trial balance',
    minutes: 90,
    hours: '1.50',
    rate: 9500,
    value: 14250,
    supplier: null,
  },
  {
    kind: 'disbursement',
    id: gid('d00000000001'),
    date: '2026-06-01',
    job: null,
    person: null,
    description: 'Companies House filing fee',
    minutes: null,
    hours: null,
    rate: null,
    value: 1300,
    supplier: 'Companies House',
  },
  {
    kind: 'time',
    id: gid('c00000000004'),
    date: '2026-05-01',
    job: accountsJob,
    person: { user_id: GRACE_ID, full_name: 'Grace Hopper' },
    description: 'Bank reconciliation',
    minutes: 120,
    hours: '2.00',
    rate: 9500,
    value: 19000,
    supplier: null,
  },
  {
    kind: 'time',
    id: gid('c00000000005'),
    date: '2026-04-10',
    job: payrollJob,
    person: { user_id: ADA_ID, full_name: 'Ada Lovelace' },
    description: 'Payroll run',
    minutes: 60,
    hours: '1.00',
    rate: 9500,
    value: 9500,
    supplier: null,
  },
  {
    kind: 'time',
    id: gid('c00000000006'),
    date: '2026-01-02',
    job: payrollJob,
    person: { user_id: ADA_ID, full_name: 'Ada Lovelace' },
    description: 'Year-end payroll',
    minutes: 30,
    hours: '0.50',
    rate: 9500,
    value: 4750,
    supplier: null,
  },
];

export const techwaveWip: ClientWip = {
  client: { id: techwave.id, code: techwave.code, name: techwave.name },
  items: wipItems,
  totals: {
    minutes: 300,
    hours: '5.00',
    time_value: 47500,
    disbursement_value: 1300,
    total: 48800,
  },
};

const invoice = (
  tail: string,
  fields: Pick<InvoiceRow, 'number' | 'display_status' | 'gross_total'> & Partial<InvoiceRow>,
): InvoiceRow => ({
  id: gid(tail),
  issue_date: '2026-04-30',
  due_date: '2026-05-30',
  reference: null,
  net_total: 0,
  vat_total: 0,
  paid_total: 0,
  credited_total: 0,
  balance: fields.gross_total,
  sent_at: null,
  ...fields,
});

export const invoices: InvoiceRow[] = [
  invoice('b00000000004', {
    number: 'INV-0004',
    display_status: 'overdue',
    gross_total: 30000,
    net_total: 25000,
    vat_total: 5000,
    reference: 'PO-77',
  }),
  invoice('b00000000003', {
    number: 'INV-0003',
    display_status: 'part_paid',
    gross_total: 120000,
    net_total: 100000,
    vat_total: 20000,
    paid_total: 30000,
    balance: 90000,
    issue_date: '2026-05-15',
    due_date: '2026-06-14',
  }),
  invoice('b00000000002', {
    number: 'INV-0002',
    display_status: 'paid',
    gross_total: 60000,
    net_total: 50000,
    vat_total: 10000,
    paid_total: 60000,
    balance: 0,
    issue_date: '2026-03-01',
    due_date: '2026-03-31',
  }),
  invoice('b00000000001', {
    number: null,
    display_status: 'draft',
    gross_total: 18000,
    net_total: 15000,
    vat_total: 3000,
    issue_date: null,
    due_date: null,
  }),
];

export const creditNotes: CreditNoteRow[] = [
  {
    id: gid('e00000000001'),
    number: 'CN-0001',
    invoice_id: gid('b00000000002'),
    invoice_number: 'INV-0002',
    issue_date: '2026-05-02',
    reason: 'Duplicate charge',
    net_total: 5000,
    vat_total: 1000,
    gross_total: 6000,
  },
];

export const payments: PaymentRow[] = [
  {
    id: gid('f00000000001'),
    received_on: '2026-06-02',
    amount: 60000,
    method: 'bank_transfer',
    reference: 'BACS 4471',
    notes: null,
    allocated_total: 60000,
    unallocated: 0,
    state: 'allocated',
    voided_at: null,
  },
  {
    id: gid('f00000000002'),
    received_on: '2026-05-15',
    amount: 20000,
    method: 'card',
    reference: null,
    notes: 'Deposit',
    allocated_total: 0,
    unallocated: 20000,
    state: 'unallocated',
    voided_at: null,
  },
  {
    id: gid('f00000000003'),
    received_on: '2026-04-02',
    amount: 5000,
    method: 'cheque',
    reference: 'Cheque 118',
    notes: null,
    allocated_total: 0,
    unallocated: 0,
    state: 'void',
    voided_at: '2026-04-03T10:00:00Z',
  },
];

/* ------------------------------- Settings lookups ------------------------------- */

export const vatRates: VatRateOption[] = [
  { id: gid('01000000a001'), name: 'Standard', code: 'S', rate_bp: 2000, is_archived: false },
  { id: gid('01000000a002'), name: 'Zero rated', code: 'Z', rate_bp: 0, is_archived: false },
];

export const invoiceTemplates: InvoiceTemplateOption[] = [
  { id: gid('02000000a001'), name: 'Classic', is_default: true, status: 'active' },
  { id: gid('02000000a002'), name: 'Modern', is_default: false, status: 'active' },
];

/* ---------------------------------- Central clients ---------------------------------- */

const central = (
  centralId: string,
  fields: Pick<CentralClient, 'name'> & Partial<CentralClient>,
): CentralClient => ({
  central_id: centralId,
  company_number: null,
  address_line1: null,
  address_line2: null,
  city: null,
  postcode: null,
  country: 'GB',
  status: 'active',
  updated_at: '2026-05-01T09:00:00Z',
  fetched_at: '2026-05-02T09:00:00Z',
  enabled: false,
  client_id: null,
  client_code: null,
  matching_client: null,
  ...fields,
});

export const northwind = central('cen-1001', {
  name: 'Northwind Traders Ltd',
  company_number: '01234567',
  address_line1: '10 Dock Road',
  city: 'Bristol',
  postcode: 'BS1 4DJ',
});

export const globex = central('cen-1002', {
  name: 'Globex Holdings plc',
  company_number: '07654321',
  address_line1: '2 Mill Lane',
  city: 'Leeds',
  postcode: 'LS1 2AB',
  enabled: true,
  client_id: techwave.id,
  client_code: techwave.code,
});

export const initech = central('cen-1003', {
  name: 'Initech Ltd',
  company_number: '09999999',
  city: 'Reading',
  postcode: 'RG1 1AA',
  matching_client: { id: mutual.id, code: mutual.code, name: mutual.name },
});

export const centralClients: CentralClient[] = [northwind, globex, initech];
