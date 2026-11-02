/**
 * Shapes the Client 360 workspace reads: the overview (`app/schemas/client_overview.py`) and
 * the rows of the other modules' lists it filters by `client_id` (jobs, time entries,
 * disbursements, the client's WIP, invoices, credit notes and payments). Only the fields the
 * tabs use are listed; field names mirror the Pydantic models. Money is pence, durations are
 * whole minutes, dates `YYYY-MM-DD` in the practice time zone.
 */
import type { TimeEntry } from '@/features/time';
import type { IsoDate, IsoDateTime, Pence } from '@/types/api';
import type { RecoveryFigures, RecoveryRate } from '@/types/recovery';

import type { ClientRef } from '../types';

/** The tabs of the client workspace, in order; the URL segment is the id. */
export const CLIENT_TAB_IDS = [
  'overview',
  'jobs',
  'time',
  'expenses',
  'wip',
  'invoices',
  'payments',
  'recovery',
  'contacts',
  'history',
  'settings',
] as const;
export type ClientTabId = (typeof CLIENT_TAB_IDS)[number];

/* --------------------------------- Overview --------------------------------- */

export interface JobsOverview {
  total: number;
  /** `not_started`, `in_progress`, `on_hold`, `completed` and `closed`: always all five. */
  by_status: Record<string, number>;
}

export interface TimeOverview {
  /** `own`: the caller sees only their own time (`time.log` without `time.read_all`). */
  scope: 'all' | 'own';
  minutes_30d: number;
  billable_minutes_30d: number;
  minutes_ytd: number;
  billable_minutes_ytd: number;
  last_entry_on: IsoDate | null;
}

export interface ExpensesOverview {
  scope: 'all' | 'own';
  count: number;
  net: Pence;
  gross: Pence;
  awaiting_approval: number;
}

export interface WipAgeing {
  '0_30': Pence;
  '31_60': Pence;
  '61_90': Pence;
  '90_plus': Pence;
}

export interface WipOverview {
  /** Unbilled billable time, except on fixed-fee jobs. */
  time: Pence;
  /** Unbilled billable time on fixed-fee jobs. */
  fixed_fee: Pence;
  expense: Pence;
  total: Pence;
  ageing: WipAgeing;
  item_count: number;
}

export interface InvoicesOverview {
  count: number;
  /** `draft`, `issued`, `overdue`, `part_paid`, `paid` and `void`: always all six. */
  by_status: Record<string, number>;
  /** Net of the invoices issued since 1 January. */
  billed_ytd: Pence;
  outstanding: Pence;
  overdue: Pence;
  last_invoice_on: IsoDate | null;
}

export interface PaymentsOverview {
  received_ytd: Pence;
  count_ytd: number;
  last_payment_on: IsoDate | null;
}

export interface ActivityEvent {
  id: string;
  /** The audit action, for example `client.updated`. */
  action: string;
  /** The action in words. */
  label: string;
  at: IsoDateTime;
  /** Null: the system (central events). */
  actor_user_id: string | null;
  actor_name: string | null;
  target_type: string | null;
  target_id: string | null;
}

/** The counts of the tab badges; null where the caller may not see the tab's data. */
export interface TabCounts {
  jobs: number | null;
  time_entries: number | null;
  expenses: number | null;
  wip: number | null;
  invoices: number | null;
  payments: number | null;
  contacts: number;
}

/** `GET /clients/{id}/overview`: every section the caller may not see is null. */
export interface ClientOverview {
  client_id: string;
  as_of: IsoDate;
  ytd_from: IsoDate;
  last_30d_from: IsoDate;
  jobs: JobsOverview | null;
  time: TimeOverview | null;
  expenses: ExpensesOverview | null;
  wip: WipOverview | null;
  invoices: InvoicesOverview | null;
  payments: PaymentsOverview | null;
  recent_activity: ActivityEvent[];
  tab_counts: TabCounts;
}

/* ----------------------------------- Jobs ----------------------------------- */

export const JOB_STATUSES = [
  'planned',
  'in_progress',
  'on_hold',
  'completed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** One row of `GET /jobs`. */
export interface JobRow {
  id: string;
  number: string;
  name: string;
  client_id: string;
  service_name: string | null;
  status: JobStatus;
  billing_basis: string;
  fixed_fee: Pence | null;
  /** The job's own hourly rate: the client rate agreed for the job (null: the task rate). */
  hourly_rate: Pence | null;
  budget_minutes: number | null;
  budget_fee: Pence | null;
  start_date: IsoDate | null;
  due_date: IsoDate | null;
  partner_user_id: string | null;
  manager_user_id: string | null;
  logged_minutes: number;
  billable_minutes: number;
  time_value: Pence;
  wip_value: Pence;
  billed_value: Pence;
  budget_minutes_used_bp: number | null;
}

/** What a job's time is billed at (`GET /clients/{id}/job-rates`, APT54). */
export type JobRateSource = 'fixed_fee' | 'non_billable' | 'client_rule' | 'job' | 'task' | 'staff';

/** A rate agreed with the client for everyone, which the ladder uses before a job's own rate. */
export interface ClientRuleRef {
  id: string;
  /** `client_service`: for the job's service; `client`: for any service. */
  level: 'client_service' | 'client';
  rate: Pence;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
}

/** One job of `GET /clients/{id}/job-rates`: its rate and where it comes from. */
export interface JobRate {
  job_id: string;
  billing_basis: 'hourly' | 'fixed' | 'non_billable';
  fixed_fee: Pence | null;
  /** The job's own hourly rate: the client rate agreed for the job. */
  job_rate: Pence | null;
  /** The rates set against the job's service (null without one, or without `rate.read`). */
  task_rate: { low: Pence; high: Pence; rules: number } | null;
  client_rule: ClientRuleRef | null;
  /** Client rates for named people in force (null without `rate.read`). */
  person_rules: number | null;
  source: JobRateSource;
}

export interface ClientJobRates {
  client_id: string;
  as_of: IsoDate;
  show_rates: boolean;
  jobs: JobRate[];
}

/* ------------------------------ Time and expenses ------------------------------ */

export const BILLING_STATUSES = ['unbilled', 'in_draft', 'billed', 'written_off'] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/**
 * One row of `GET /time-entries`: the whole entry as the Time feature reads it, because the tab
 * edits and deletes it with that feature's panel and rules.
 */
export type TimeEntryRow = TimeEntry;

/** One row of `GET /disbursements`. */
export interface DisbursementRow {
  id: string;
  client_id: string;
  job_id: string | null;
  incurred_on: IsoDate;
  description: string;
  supplier: string | null;
  amount: Pence;
  is_billable: boolean;
  billing_status: BillingStatus;
  created_by: string | null;
}

/* -------------------------------------- WIP -------------------------------------- */

export interface WipJobRef {
  id: string;
  number: string;
  name: string;
  billing_basis: string;
}

/** One item of the client's WIP: a time entry or a disbursement. */
export interface WipItem {
  kind: 'time' | 'disbursement';
  id: string;
  date: IsoDate;
  job: WipJobRef | null;
  person: { user_id: string; full_name: string | null } | null;
  description: string | null;
  minutes: number | null;
  /** A decimal string with two places. */
  hours: string | null;
  rate: Pence | null;
  value: Pence;
  supplier: string | null;
}

export interface WipTotals {
  minutes: number;
  hours: string;
  time_value: Pence;
  disbursement_value: Pence;
  total: Pence;
}

/** `GET /clients/{id}/wip`: bounded, every item of the client in date order. */
export interface ClientWip {
  client: ClientRef;
  items: WipItem[];
  totals: WipTotals;
}

/* ------------------------------ Invoices and payments ------------------------------ */

export const INVOICE_STATUSES = [
  'draft',
  'issued',
  'overdue',
  'part_paid',
  'paid',
  'void',
] as const;
export type InvoiceDisplayStatus = (typeof INVOICE_STATUSES)[number];

/** One row of `GET /invoices`. */
export interface InvoiceRow {
  id: string;
  number: string | null;
  display_status: InvoiceDisplayStatus;
  issue_date: IsoDate | null;
  due_date: IsoDate | null;
  reference: string | null;
  net_total: Pence;
  vat_total: Pence;
  gross_total: Pence;
  paid_total: Pence;
  credited_total: Pence;
  balance: Pence;
  sent_at: IsoDateTime | null;
}

/** One row of `GET /credit-notes`. */
export interface CreditNoteRow {
  id: string;
  number: string;
  invoice_id: string;
  invoice_number: string | null;
  issue_date: IsoDate;
  reason: string;
  net_total: Pence;
  vat_total: Pence;
  gross_total: Pence;
}

export const PAYMENT_STATES = ['unallocated', 'part_allocated', 'allocated', 'void'] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_METHODS = [
  'bank_transfer',
  'card',
  'direct_debit',
  'cash',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** One row of `GET /payments`. */
export interface PaymentRow {
  id: string;
  received_on: IsoDate;
  amount: Pence;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  allocated_total: Pence;
  unallocated: Pence;
  state: PaymentState;
  voided_at: IsoDateTime | null;
}

/* ------------------------------ Invoices and recovery ------------------------------ */

/** One job of `GET /clients/{id}/recovery`: its invoice value against the task rate, the staff
 * rates and cost plus. */
export interface JobRecovery extends RecoveryFigures {
  /** Null for the work on the client without a job. */
  job_id: string | null;
  number: string | null;
  name: string;
  status: string | null;
  billing_basis: string | null;
  fixed_fee: Pence | null;
  /** The job's own hourly rate: the client job-specific rate agreed for it (APT54). */
  hourly_rate: Pence | null;
  /** The job's own cost-plus mark-up, if set. */
  job_markup_bp: number | null;
  /** The contract terms in words: "Fixed fee of £1,500.00". */
  terms: string;
}

/** `GET /clients/{id}/recovery` (`wip.read`): every job with billable time, all dates. */
export interface ClientRecovery {
  client: ClientRef;
  jobs: JobRecovery[];
  totals: RecoveryFigures;
  /** The practice's cost-plus mark-up in basis points (5000 = 50%). */
  practice_markup_bp: number;
  /** The client's own mark-up, if set (a job's comes before it). */
  client_markup_bp: number | null;
  /** The practice's order of the rates the recovery rate is looked for in. */
  rate_order: RecoveryRate[];
  /** Payments not allocated to an invoice: a credit for a future invoice, reducing no invoice. */
  credit_on_account: Pence;
  /** Whether the caller may see cost (`rate.read`); cost plus is null otherwise. */
  show_cost: boolean;
}

/* ------------------------------ Settings lookups ------------------------------ */

/** `GET /vat-rates`: only what the default-VAT-code select needs. */
export interface VatRateOption {
  id: string;
  name: string;
  code: string;
  rate_bp: number;
  is_archived: boolean;
}

/** `GET /invoice-templates`: only what the template select needs. */
export interface InvoiceTemplateOption {
  id: string;
  name: string;
  is_default: boolean;
  status: 'active' | 'inactive';
}
