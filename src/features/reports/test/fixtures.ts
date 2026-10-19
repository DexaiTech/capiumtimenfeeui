import { testUser } from '@/test/fixtures';

import type {
  AgedDebtorRow,
  AgedDebtorTotals,
  BillingRow,
  BillingTotals,
  ExpenseReportRow,
  ExpenseReportTotals,
  JobProfitabilityRow,
  JobProfitabilityTotals,
  MissingTimesheetRow,
  MissingTimesheetTotals,
  PaymentReportRow,
  PaymentReportTotals,
  RecoveryRow,
  RecoveryTotals,
  UtilisationRow,
  UtilisationTotals,
  WipReportRow,
  WipReportTotals,
} from '../types';

/** The practice and its people: Ada is the signed-in person. */
export const IDS = {
  acme: '0198c1f2-0000-7000-8000-0000000000c1',
  globex: '0198c1f2-0000-7000-8000-0000000000c2',
  ada: testUser.id,
  ben: '0198c1f2-0000-7000-8000-000000000002',
  cara: '0198c1f2-0000-7000-8000-000000000003',
} as const;

/* --------------------------------- Lookups --------------------------------- */

export const clients = [
  { id: IDS.acme, code: 'ACME', name: 'Acme Ltd' },
  { id: IDS.globex, code: 'GLOB', name: 'Globex plc' },
];

export const jobs = [
  {
    id: 'j-1',
    number: 'J00001',
    name: 'Year-end accounts',
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    service_id: null,
    service_name: null,
  },
  {
    id: 'j-2',
    number: 'J00002',
    name: 'Audit',
    client_id: IDS.globex,
    client_code: 'GLOB',
    client_name: 'Globex plc',
    service_id: null,
    service_name: null,
  },
];

const member = (id: string, full_name: string) => ({
  id,
  full_name,
  code: null,
  email: `${full_name.split(' ')[0]?.toLowerCase() ?? 'x'}@example.com`,
  status: 'active',
});

export const members = [
  member(IDS.ada, 'Ada Lovelace'),
  member(IDS.ben, 'Ben Carter'),
  member(IDS.cara, 'Cara Diaz'),
];

export const services = [
  { id: 's-1', code: 'AUD', name: 'Audit', is_active: true },
  { id: 's-2', code: 'BK', name: 'Bookkeeping', is_active: true },
];

/* ------------------------------- Utilisation ------------------------------- */

const utilisation = (
  user_id: string,
  full_name: string,
  numbers: Pick<
    UtilisationRow,
    | 'capacity_minutes'
    | 'total_minutes'
    | 'chargeable_minutes'
    | 'non_chargeable_minutes'
    | 'utilisation_bp'
    | 'target_bp'
    | 'variance_bp'
  >,
  status = 'active',
): UtilisationRow => ({ user_id, full_name, initials: null, status, ...numbers });

export const utilisationRows = (): UtilisationRow[] => [
  utilisation(IDS.ada, 'Ada Lovelace', {
    capacity_minutes: 9000,
    total_minutes: 7200,
    chargeable_minutes: 6000,
    non_chargeable_minutes: 1200,
    utilisation_bp: 6667,
    target_bp: 7500,
    variance_bp: -833,
  }),
  utilisation(IDS.ben, 'Ben Carter', {
    capacity_minutes: 9000,
    total_minutes: 8400,
    chargeable_minutes: 7800,
    non_chargeable_minutes: 600,
    utilisation_bp: 8667,
    target_bp: 7500,
    variance_bp: 1167,
  }),
  utilisation(
    IDS.cara,
    'Cara Diaz',
    {
      capacity_minutes: 4500,
      total_minutes: 4500,
      chargeable_minutes: 3000,
      non_chargeable_minutes: 1500,
      utilisation_bp: 6667,
      target_bp: 7000,
      variance_bp: -333,
    },
    'left',
  ),
];

export const utilisationTotals = (): UtilisationTotals => ({
  working_days: 20,
  capacity_minutes: 22500,
  total_minutes: 20100,
  chargeable_minutes: 16800,
  non_chargeable_minutes: 3300,
  utilisation_bp: 7467,
  target_bp: 7500,
  variance_bp: -33,
});

/* ---------------------------- Job profitability ---------------------------- */

export const jobProfitRows = (): JobProfitabilityRow[] => [
  {
    job_id: 'j-1',
    job_number: 'J00001',
    job_name: 'Year-end accounts',
    status: 'in_progress',
    billing_basis: 'hourly',
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    fixed_fee: null,
    logged_minutes: 1800,
    time_value: 285000,
    cost_value: 90000,
    billed_time_value: 200000,
    billed_disbursement_value: 5000,
    billed_value: 205000,
    written_off_value: 10000,
    margin: 110000,
    margin_bp: 5500,
    budget_minutes: 2400,
    budget_minutes_used_bp: 7500,
    budget_fee: null,
    budget_fee_used_bp: null,
  },
  {
    job_id: 'j-2',
    job_number: 'J00002',
    job_name: 'Audit',
    status: 'on_hold',
    billing_basis: 'fixed',
    client_id: IDS.globex,
    client_code: 'GLOB',
    client_name: 'Globex plc',
    fixed_fee: 500000,
    logged_minutes: 600,
    time_value: 95000,
    cost_value: 30000,
    billed_time_value: 0,
    billed_disbursement_value: 0,
    billed_value: 0,
    written_off_value: 0,
    margin: -30000,
    margin_bp: null,
    budget_minutes: null,
    budget_minutes_used_bp: null,
    budget_fee: 500000,
    budget_fee_used_bp: 1900,
  },
];

export const jobProfitTotals = (): JobProfitabilityTotals => ({
  logged_minutes: 2400,
  time_value: 380000,
  cost_value: 120000,
  billed_time_value: 200000,
  billed_disbursement_value: 5000,
  billed_value: 205000,
  written_off_value: 10000,
  margin: 80000,
  margin_bp: 4000,
});

/** What the API answers to someone who may not see rates: cost and margin are null. */
export const withoutRates = (rows: JobProfitabilityRow[]) =>
  rows.map((row) => ({ ...row, cost_value: null, margin: null, margin_bp: null }));

export const jobProfitTotalsWithoutRates = (): JobProfitabilityTotals => ({
  ...jobProfitTotals(),
  cost_value: null,
  margin: null,
  margin_bp: null,
});

/* ----------------------------------- WIP ----------------------------------- */

export const wipRows = (): WipReportRow[] => [
  {
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    job_id: 'j-1',
    job_number: 'J00001',
    job_name: 'Year-end accounts',
    minutes: 1200,
    time_value: 150000,
    disbursement_value: 5000,
    total: 155000,
    age_0_30: 80000,
    age_31_60: 50000,
    age_61_90: 20000,
    age_91_plus: 5000,
    oldest_item_date: '2026-06-20',
  },
  {
    client_id: IDS.globex,
    client_code: 'GLOB',
    client_name: 'Globex plc',
    job_id: null,
    job_number: null,
    job_name: null,
    minutes: 300,
    time_value: 40000,
    disbursement_value: 0,
    total: 40000,
    age_0_30: 40000,
    age_31_60: 0,
    age_61_90: 0,
    age_91_plus: 0,
    oldest_item_date: '2026-10-05',
  },
];

export const wipTotals = (): WipReportTotals => ({
  minutes: 1500,
  time_value: 190000,
  disbursement_value: 5000,
  total: 195000,
  age_0_30: 120000,
  age_31_60: 50000,
  age_61_90: 20000,
  age_91_plus: 5000,
  oldest_item_date: '2026-06-20',
});

/* -------------------------------- Recoverability ----------------------------- */

export const recoveryRows = (): RecoveryRow[] => [
  {
    key: IDS.acme,
    code: 'ACME',
    name: 'Acme Ltd',
    client_name: null,
    client_id: IDS.acme,
    wip_value: 200000,
    billed_wip_value: 190000,
    billed_value: 195000,
    billing_adjustment: 5000,
    written_off_value: 10000,
    net_adjustment: -5000,
    recovery_bp: 9750,
  },
  {
    key: IDS.globex,
    code: 'GLOB',
    name: 'Globex plc',
    client_name: null,
    client_id: IDS.globex,
    wip_value: 100000,
    billed_wip_value: 100000,
    billed_value: 100000,
    billing_adjustment: 0,
    written_off_value: 0,
    net_adjustment: 0,
    recovery_bp: 10000,
  },
  {
    key: null,
    code: null,
    name: 'Unassigned',
    client_name: null,
    client_id: null,
    wip_value: 5000,
    billed_wip_value: 0,
    billed_value: 0,
    billing_adjustment: 0,
    written_off_value: 0,
    net_adjustment: 0,
    recovery_bp: 0,
  },
];

export const recoveryTotals = (): RecoveryTotals => ({
  wip_value: 305000,
  billed_wip_value: 290000,
  billed_value: 295000,
  billing_adjustment: 5000,
  written_off_value: 10000,
  net_adjustment: -5000,
  recovery_bp: 9672,
});

export const recoveryByJob = (): RecoveryRow[] => [
  {
    key: 'j-1',
    code: 'J00001',
    name: 'Year-end accounts',
    client_name: 'Acme Ltd',
    client_id: IDS.acme,
    job_id: 'j-1',
    wip_value: 200000,
    billed_wip_value: 190000,
    billed_value: 195000,
    billing_adjustment: 5000,
    written_off_value: 10000,
    net_adjustment: -5000,
    recovery_bp: 9750,
  },
];

/* ---------------------------------- Billing ---------------------------------- */

export const billingByMonth = (): BillingRow[] => [
  {
    key: '2026-09',
    name: 'Sep 2026',
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    invoice_count: 3,
    invoiced_net: 500000,
    invoiced_vat: 100000,
    invoiced_gross: 600000,
    credit_note_count: 1,
    credited_net: 50000,
    credited_vat: 10000,
    credited_gross: 60000,
    net_billed: 450000,
    receipts: 400000,
  },
  {
    key: '2026-10',
    name: 'Oct 2026',
    date_from: '2026-10-01',
    date_to: '2026-10-31',
    invoice_count: 2,
    invoiced_net: 300000,
    invoiced_vat: 60000,
    invoiced_gross: 360000,
    credit_note_count: 0,
    credited_net: 0,
    credited_vat: 0,
    credited_gross: 0,
    net_billed: 300000,
    receipts: 250000,
  },
];

export const billingByPartner = (): BillingRow[] => [
  {
    key: IDS.ada,
    name: 'Ada Lovelace',
    partner_user_id: IDS.ada,
    invoice_count: 4,
    invoiced_net: 700000,
    invoiced_vat: 140000,
    invoiced_gross: 840000,
    credit_note_count: 1,
    credited_net: 50000,
    credited_vat: 10000,
    credited_gross: 60000,
    net_billed: 650000,
    receipts: 600000,
  },
  {
    key: null,
    name: 'No partner',
    invoice_count: 1,
    invoiced_net: 100000,
    invoiced_vat: 20000,
    invoiced_gross: 120000,
    credit_note_count: 0,
    credited_net: 0,
    credited_vat: 0,
    credited_gross: 0,
    net_billed: 100000,
    receipts: 50000,
  },
];

export const billingTotals = (): BillingTotals => ({
  invoice_count: 5,
  invoiced_net: 800000,
  invoiced_vat: 160000,
  invoiced_gross: 960000,
  credit_note_count: 1,
  credited_net: 50000,
  credited_vat: 10000,
  credited_gross: 60000,
  net_billed: 750000,
  receipts: 650000,
});

/* ---------------------------------- Expenses --------------------------------- */

const expense = (
  key: string | null,
  name: string,
  more: Partial<ExpenseReportRow> = {},
): ExpenseReportRow => ({
  key,
  code: null,
  name,
  client_name: null,
  expense_type_id: null,
  user_id: null,
  client_id: null,
  job_id: null,
  claim_status: null,
  date_from: null,
  date_to: null,
  line_count: 0,
  net: 0,
  vat: 0,
  gross: 0,
  billable_net: 0,
  recharge_amount: 0,
  recharged_amount: 0,
  reimbursable: 0,
  ...more,
});

export const expensesByType = (): ExpenseReportRow[] => [
  expense('et-1', 'Mileage', {
    code: 'MILEAGE',
    expense_type_id: 'et-1',
    line_count: 2,
    net: 5000,
    gross: 5000,
    billable_net: 5000,
    recharge_amount: 5000,
    reimbursable: 5000,
  }),
  expense('et-2', 'Travel', {
    code: 'TRAVEL',
    expense_type_id: 'et-2',
    line_count: 1,
    net: 10000,
    vat: 2000,
    gross: 12000,
    reimbursable: 12000,
  }),
];

export const expensesByClient = (): ExpenseReportRow[] => [
  expense(IDS.acme, 'Acme Ltd', {
    code: 'ACME',
    client_id: IDS.acme,
    line_count: 2,
    net: 5000,
    gross: 5000,
    billable_net: 5000,
    recharge_amount: 5000,
  }),
  expense(null, 'No client', { line_count: 1, net: 10000, vat: 2000, gross: 12000 }),
];

export const expensesByStatus = (): ExpenseReportRow[] => [
  expense('submitted', 'submitted', {
    claim_status: 'submitted',
    line_count: 3,
    net: 15000,
    vat: 2000,
    gross: 17000,
  }),
];

export const expenseTotals = (): ExpenseReportTotals => ({
  line_count: 3,
  net: 15000,
  vat: 2000,
  gross: 17000,
  billable_net: 5000,
  recharge_amount: 5000,
  recharged_amount: 0,
  reimbursable: 17000,
});

/* ------------------------------- Aged debtors ------------------------------- */

export const agedRows = (): AgedDebtorRow[] => [
  {
    client_id: IDS.acme,
    client_code: 'ACME',
    client_name: 'Acme Ltd',
    invoice_count: 2,
    current: 100000,
    days_1_30: 50000,
    days_31_60: 0,
    days_61_90: 0,
    days_91_plus: 0,
    days_90_plus: 0,
    total: 150000,
    oldest_due_date: '2026-09-20',
  },
  {
    client_id: IDS.globex,
    client_code: 'GLOB',
    client_name: 'Globex plc',
    invoice_count: 1,
    current: 0,
    days_1_30: 0,
    days_31_60: 0,
    days_61_90: 0,
    days_91_plus: 40000,
    days_90_plus: 40000,
    total: 40000,
    oldest_due_date: '2026-06-30',
  },
];

export const agedTotals = (): AgedDebtorTotals => ({
  invoice_count: 3,
  current: 100000,
  days_1_30: 50000,
  days_31_60: 0,
  days_61_90: 0,
  days_91_plus: 40000,
  days_90_plus: 40000,
  total: 190000,
  oldest_due_date: '2026-06-30',
});

/* --------------------------------- Payments --------------------------------- */

export const paymentsByMonth = (): PaymentReportRow[] => [
  {
    key: '2026-09',
    code: null,
    name: 'Sep 2026',
    client_id: null,
    method: null,
    date_from: '2026-09-01',
    date_to: '2026-09-30',
    payment_count: 2,
    received: 300000,
    allocated: 300000,
    on_account: 0,
    void_count: 0,
    void_amount: 0,
  },
  {
    key: '2026-10',
    code: null,
    name: 'Oct 2026',
    client_id: null,
    method: null,
    date_from: '2026-10-01',
    date_to: '2026-10-31',
    payment_count: 3,
    received: 250000,
    allocated: 200000,
    on_account: 50000,
    void_count: 1,
    void_amount: 20000,
  },
];

export const paymentsByClient = (): PaymentReportRow[] => [
  {
    key: IDS.acme,
    code: 'ACME',
    name: 'Acme Ltd',
    client_id: IDS.acme,
    method: null,
    date_from: null,
    date_to: null,
    payment_count: 5,
    received: 550000,
    allocated: 500000,
    on_account: 50000,
    void_count: 1,
    void_amount: 20000,
  },
];

export const paymentTotals = (): PaymentReportTotals => ({
  payment_count: 5,
  received: 550000,
  allocated: 500000,
  on_account: 50000,
  void_count: 1,
  void_amount: 20000,
});

export const emptyPaymentTotals = (): PaymentReportTotals => ({
  payment_count: 0,
  received: 0,
  allocated: 0,
  on_account: 0,
  void_count: 0,
  void_amount: 0,
});

/* ---------------------------- Missing timesheets ---------------------------- */

export const missingRows = (): MissingTimesheetRow[] => [
  {
    user_id: IDS.ben,
    name: 'Ben Carter',
    week_start: '2026-10-12',
    status: 'open',
    timesheet_id: 'ts-1',
    logged_minutes: 2160,
    expected_minutes: 2250,
    shortfall_minutes: 90,
    missing_day_count: 0,
    missing_days: [],
    last_reminded_at: null,
    has_login: true,
  },
  {
    user_id: IDS.cara,
    name: 'Cara Diaz',
    week_start: '2026-10-12',
    status: 'none',
    timesheet_id: null,
    logged_minutes: 0,
    expected_minutes: 2250,
    shortfall_minutes: 2250,
    missing_day_count: 5,
    missing_days: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'],
    last_reminded_at: '2026-10-14T09:30:00Z',
    has_login: false,
  },
];

export const missingTotals = (): MissingTimesheetTotals => ({
  timesheets: 2,
  people: 2,
  weeks: 1,
  none_count: 1,
  open_count: 1,
  rejected_count: 0,
  logged_minutes: 2160,
  expected_minutes: 4500,
  shortfall_minutes: 2340,
  missing_day_count: 5,
});
