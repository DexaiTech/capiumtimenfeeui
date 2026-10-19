/**
 * Shapes of the report endpoints (`app/schemas/{reports,reports_ext}.py`, `docs/modules/reports.md`).
 * Every report answers `{rows, totals, filters, page}`; money is pence, durations whole minutes and
 * percentages basis points (`null` when the denominator is zero).
 */
import type { BasisPoints, IsoDate, Pence } from '@/types/api';

export interface ReportFilters {
  date_from?: IsoDate | null;
  date_to?: IsoDate | null;
  as_at?: IsoDate | null;
  group_by?: string | null;
  week_from?: IsoDate | null;
  week_to?: IsoDate | null;
}

export interface ReportPageInfo {
  total: number;
  limit: number | null;
  offset: number;
  has_more: boolean;
  next_offset: number | null;
}

/** What a report endpoint answers (WIP has no `page`). */
export interface ReportData<TRow, TTotals> {
  rows: TRow[];
  totals: TTotals;
  filters: ReportFilters;
  page?: ReportPageInfo;
}

export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

/* -------------------------------- Utilisation -------------------------------- */

export interface UtilisationAmounts {
  capacity_minutes: number;
  total_minutes: number;
  chargeable_minutes: number;
  non_chargeable_minutes: number;
  utilisation_bp: BasisPoints | null;
  target_bp: BasisPoints | null;
  variance_bp: BasisPoints | null;
}

export interface UtilisationRow extends UtilisationAmounts {
  user_id: string;
  full_name: string;
  initials: string | null;
  status: string;
}

export interface UtilisationTotals extends UtilisationAmounts {
  working_days: number;
}

/* ----------------------------- Job profitability ----------------------------- */

export interface JobProfitAmounts {
  logged_minutes: number;
  time_value: Pence;
  cost_value: Pence | null;
  billed_time_value: Pence;
  billed_disbursement_value: Pence;
  billed_value: Pence;
  written_off_value: Pence;
  margin: Pence | null;
  margin_bp: BasisPoints | null;
}

export interface JobProfitabilityRow extends JobProfitAmounts {
  job_id: string;
  job_number: string;
  job_name: string;
  status: string;
  billing_basis: string;
  client_id: string;
  client_code: string;
  client_name: string;
  fixed_fee: Pence | null;
  budget_minutes: number | null;
  budget_minutes_used_bp: BasisPoints | null;
  budget_fee: Pence | null;
  budget_fee_used_bp: BasisPoints | null;
}

export type JobProfitabilityTotals = JobProfitAmounts;

/* ----------------------------------- WIP ----------------------------------- */

export interface WipAmounts {
  minutes: number;
  time_value: Pence;
  disbursement_value: Pence;
  total: Pence;
  age_0_30: Pence;
  age_31_60: Pence;
  age_61_90: Pence;
  age_91_plus: Pence;
}

export interface WipReportRow extends WipAmounts {
  client_id: string;
  client_code: string;
  client_name: string;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  oldest_item_date: IsoDate;
}

export interface WipReportTotals extends WipAmounts {
  oldest_item_date: IsoDate | null;
}

/* ------------------------------- Recoverability ------------------------------ */

export interface RecoveryAmounts {
  billed_wip_value: Pence;
  billed_value: Pence;
  billing_adjustment: Pence;
  written_off_value: Pence;
  wip_value: Pence;
  net_adjustment: Pence;
  recovery_bp: BasisPoints | null;
}

export interface RecoveryRow extends RecoveryAmounts {
  key: string | null;
  code: string | null;
  name: string;
  client_name: string | null;
  user_id?: string | null;
  client_id?: string | null;
  job_id?: string | null;
}

export type RecoveryTotals = RecoveryAmounts;

/* ----------------------------- Billing summary ----------------------------- */

export interface BillingAmounts {
  invoice_count: number;
  invoiced_net: Pence;
  invoiced_vat: Pence;
  invoiced_gross: Pence;
  credit_note_count: number;
  credited_net: Pence;
  credited_vat: Pence;
  credited_gross: Pence;
  net_billed: Pence;
  receipts: Pence;
}

export interface BillingRow extends BillingAmounts {
  key: string | null;
  name: string;
  partner_user_id?: string | null;
  date_from?: IsoDate | null;
  date_to?: IsoDate | null;
}

export type BillingTotals = BillingAmounts;

/* ------------------------------- Aged debtors ------------------------------- */

export interface AgedAmounts {
  invoice_count: number;
  current: Pence;
  days_1_30: Pence;
  days_31_60: Pence;
  days_61_90: Pence;
  days_91_plus: Pence;
  days_90_plus: Pence;
  total: Pence;
}

export interface AgedDebtorRow extends AgedAmounts {
  client_id: string;
  client_code: string;
  client_name: string;
  oldest_due_date: IsoDate;
}

export interface AgedDebtorTotals extends AgedAmounts {
  oldest_due_date: IsoDate | null;
}

/* --------------------------------- Expenses --------------------------------- */

export interface ExpenseAmounts {
  line_count: number;
  net: Pence;
  vat: Pence;
  gross: Pence;
  billable_net: Pence;
  recharge_amount: Pence;
  recharged_amount: Pence;
  reimbursable: Pence;
}

export interface ExpenseReportRow extends ExpenseAmounts {
  key: string | null;
  code: string | null;
  name: string;
  client_name: string | null;
  expense_type_id: string | null;
  user_id: string | null;
  client_id: string | null;
  job_id: string | null;
  claim_status: string | null;
  date_from: IsoDate | null;
  date_to: IsoDate | null;
}

export type ExpenseReportTotals = ExpenseAmounts;

/* --------------------------------- Payments --------------------------------- */

export interface PaymentAmounts {
  payment_count: number;
  received: Pence;
  allocated: Pence;
  on_account: Pence;
  void_count: number;
  void_amount: Pence;
}

export interface PaymentReportRow extends PaymentAmounts {
  key: string | null;
  code: string | null;
  name: string;
  client_id: string | null;
  method: string | null;
  date_from: IsoDate | null;
  date_to: IsoDate | null;
}

export type PaymentReportTotals = PaymentAmounts;

/* ---------------------------- Missing timesheets ---------------------------- */

export type MissingStatus = 'none' | 'open' | 'rejected';

export interface MissingTimesheetRow {
  user_id: string;
  name: string;
  week_start: IsoDate;
  status: MissingStatus;
  timesheet_id: string | null;
  logged_minutes: number;
  expected_minutes: number;
  shortfall_minutes: number;
  missing_day_count: number;
  missing_days: IsoDate[];
  last_reminded_at: string | null;
  has_login: boolean;
}

export interface MissingTimesheetTotals {
  timesheets: number;
  people: number;
  weeks: number;
  none_count: number;
  open_count: number;
  rejected_count: number;
  logged_minutes: number;
  expected_minutes: number;
  shortfall_minutes: number;
  missing_day_count: number;
}
