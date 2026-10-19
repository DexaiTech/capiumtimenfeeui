import type {
  AgeingAmounts,
  ClientRef,
  DebtorInvoice,
  DebtorRow,
  DebtorTotals,
  ReminderLogEntry,
  Statement,
  StatementEntry,
  StatementRow,
  StatementTotals,
} from '../types';

/** The practice's clients; Morgan has no email address. */
export const bright: ClientRef = { id: 'c-bright', code: 'C0005', name: 'Brightside Bakery Ltd' };
export const harbour: ClientRef = { id: 'c-harbour', code: 'C0002', name: 'Harbour & Co' };
export const north: ClientRef = { id: 'c-north', code: 'C0004', name: 'Northgate Dental LLP' };
export const morgan: ClientRef = { id: 'c-morgan', code: 'C0006', name: 'A. Morgan' };
export const clients: ClientRef[] = [bright, harbour, north, morgan];

export const emailsOf: Record<string, string[]> = {
  [bright.id]: ['info@brightside.example'],
  [harbour.id]: ['info@harbour.example'],
  [north.id]: ['jo@example.com'],
};

const zeroAgeing = (): AgeingAmounts => ({
  current: 0,
  days_1_30: 0,
  days_31_60: 0,
  days_61_90: 0,
  days_90_plus: 0,
});

/* --------------------------------- Debtors --------------------------------- */

/** Northgate: £1,482.00 in two old invoices, never reminded. */
export function debtorRow(overrides: Partial<DebtorRow> = {}): DebtorRow {
  return {
    ...zeroAgeing(),
    days_61_90: 69000,
    days_90_plus: 79200,
    client: north,
    partner_user_id: null,
    manager_user_id: null,
    total: 148200,
    overdue: 148200,
    invoice_count: 2,
    oldest_due_date: '2026-05-31',
    max_days_overdue: 140,
    last_reminder_at: null,
    ...overrides,
  };
}

export function debtorTotals(rows: DebtorRow[]): DebtorTotals {
  const sum = (pick: (row: DebtorRow) => number) => rows.reduce((all, row) => all + pick(row), 0);
  return {
    current: sum((row) => row.current),
    days_1_30: sum((row) => row.days_1_30),
    days_31_60: sum((row) => row.days_31_60),
    days_61_90: sum((row) => row.days_61_90),
    days_90_plus: sum((row) => row.days_90_plus),
    total: sum((row) => row.total),
    overdue: sum((row) => row.overdue),
    client_count: rows.length,
    invoice_count: sum((row) => row.invoice_count),
  };
}

export const debtorRows = (): DebtorRow[] => [
  debtorRow(),
  debtorRow({
    ...zeroAgeing(),
    days_1_30: 33200,
    client: harbour,
    total: 33200,
    overdue: 33200,
    invoice_count: 1,
    oldest_due_date: '2026-10-01',
    max_days_overdue: 17,
    last_reminder_at: '2026-10-10T09:00:00Z',
  }),
  debtorRow({
    ...zeroAgeing(),
    days_31_60: 23760,
    client: morgan,
    total: 23760,
    overdue: 23760,
    invoice_count: 1,
    oldest_due_date: '2026-08-31',
    max_days_overdue: 48,
  }),
  debtorRow({
    ...zeroAgeing(),
    current: 30060,
    client: bright,
    total: 30060,
    overdue: 0,
    invoice_count: 1,
    oldest_due_date: '2026-11-09',
    max_days_overdue: 0,
  }),
];

export function debtorInvoice(overrides: Partial<DebtorInvoice> = {}): DebtorInvoice {
  return {
    id: 'inv-4',
    number: 'INV-00004',
    source: null,
    issue_date: '2026-05-01',
    due_date: '2026-05-31',
    days_overdue: 140,
    bucket: 'days_90_plus',
    gross_total: 79200,
    paid: 0,
    credited: 0,
    outstanding: 79200,
    display_status: 'overdue',
    last_reminder_at: null,
    reminder_count: 0,
    ...overrides,
  };
}

export const northInvoices = (): DebtorInvoice[] => [
  debtorInvoice(),
  debtorInvoice({
    id: 'inv-3',
    number: 'INV-00003',
    issue_date: '2026-07-01',
    due_date: '2026-07-31',
    days_overdue: 79,
    bucket: 'days_61_90',
    gross_total: 69000,
    outstanding: 69000,
    last_reminder_at: '2026-10-01T09:00:00Z',
    reminder_count: 2,
  }),
];

export function reminderEntry(overrides: Partial<ReminderLogEntry> = {}): ReminderLogEntry {
  return {
    id: 'rem-1',
    client: harbour,
    invoice: { id: 'inv-2', number: 'INV-00002' },
    template: 'client_payment_reminder',
    source: 'manual',
    status: 'sent',
    sent_on: '2026-10-10',
    to: ['info@harbour.example'],
    days_overdue: 9,
    amount_due: 33200,
    sent_by: { user_id: 'u-ada', full_name: 'Ada Smith' },
    sent_at: '2026-10-10T09:00:00Z',
    error: null,
    created_at: '2026-10-10T08:59:00Z',
    ...overrides,
  };
}

/* -------------------------------- Statements -------------------------------- */

export function statementRow(overrides: Partial<StatementRow> = {}): StatementRow {
  return {
    client: harbour,
    partner_user_id: null,
    manager_user_id: null,
    outstanding: 33200,
    on_account: 0,
    balance: 33200,
    overdue: 33200,
    oldest_overdue_due_date: '2026-10-01',
    oldest_overdue_days: 17,
    last_statement_sent_at: '2026-10-05T10:00:00Z',
    last_statement_to: ['info@harbour.example'],
    has_recipient: true,
    ...overrides,
  };
}

export function statementTotals(rows: StatementRow[]): StatementTotals {
  const sum = (pick: (row: StatementRow) => number) =>
    rows.reduce((all, row) => all + pick(row), 0);
  return {
    client_count: rows.length,
    outstanding: sum((row) => row.outstanding),
    overdue: sum((row) => row.overdue),
    on_account: sum((row) => row.on_account),
    balance: sum((row) => row.balance),
  };
}

export const statementRows = (): StatementRow[] => [
  statementRow(),
  statementRow({
    client: morgan,
    outstanding: 23760,
    balance: 23760,
    overdue: 23760,
    oldest_overdue_due_date: '2026-08-31',
    oldest_overdue_days: 48,
    last_statement_sent_at: null,
    last_statement_to: null,
    has_recipient: false,
  }),
  statementRow({
    client: bright,
    outstanding: 0,
    on_account: 20000,
    balance: -20000,
    overdue: 0,
    oldest_overdue_due_date: null,
    oldest_overdue_days: 0,
    last_statement_sent_at: null,
    last_statement_to: null,
  }),
];

export function statementEntry(overrides: Partial<StatementEntry> = {}): StatementEntry {
  return {
    date: '2026-09-01',
    type: 'invoice',
    id: 'inv-2',
    number: 'INV-00002',
    description: 'Invoice, due 1 October 2026',
    amount: 43200,
    balance: 43200,
    ...overrides,
  };
}

export function statement(overrides: Partial<Statement> = {}): Statement {
  return {
    client: harbour,
    currency: 'GBP',
    date_from: '2026-07-01',
    date_to: '2026-10-18',
    opening_balance: 0,
    entries: [
      statementEntry(),
      statementEntry({
        date: '2026-10-05',
        type: 'payment',
        id: 'pay-1',
        number: 'Harbour part',
        description: 'Bank transfer received (Harbour part)',
        amount: -10000,
        balance: 33200,
      }),
    ],
    invoiced: 43200,
    credited: 0,
    paid: 10000,
    closing_balance: 33200,
    unallocated_cash: 0,
    ...overrides,
  };
}
