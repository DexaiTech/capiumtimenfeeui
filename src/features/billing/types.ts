/**
 * Shapes of the billing endpoints: invoices, credit notes, payments, statements and the client's
 * WIP (`app/schemas/{invoices,payments,billing}.py`, `docs/modules/billing.md`). Money is pence,
 * VAT rates basis points, `quantity` and `hours` decimal strings with two places, dates
 * `YYYY-MM-DD` in the practice time zone and timestamps UTC.
 */
import type { BasisPoints, IsoDate, IsoDateTime, Pence } from '@/types/api';

export interface ClientRef {
  id: string;
  code: string;
  name: string;
}

export interface JobRef {
  id: string;
  number: string;
  name: string;
  billing_basis: string;
}

/* --------------------------------- Invoices --------------------------------- */

/** What the API derives from the stored status, the balance and the due date. */
export const INVOICE_DISPLAY_STATUSES = [
  'draft',
  'awaiting_approval',
  'approved',
  'issued',
  'part_paid',
  'paid',
  'credited',
  'overdue',
  'void',
] as const;
export type InvoiceDisplayStatus = (typeof INVOICE_DISPLAY_STATUSES)[number];

export type InvoiceStoredStatus = 'draft' | 'awaiting_approval' | 'approved' | 'issued' | 'void';

/** A person as the API names them (`PersonRef`). */
export interface PersonRef {
  user_id: string;
  full_name: string | null;
}

export interface InvoiceSummary {
  id: string;
  /** Null until the invoice is issued. */
  number: string | null;
  status: InvoiceStoredStatus;
  display_status: InvoiceDisplayStatus;
  client: ClientRef | null;
  issue_date: IsoDate | null;
  due_date: IsoDate | null;
  reference: string | null;
  currency: string;
  net_total: Pence;
  vat_total: Pence;
  gross_total: Pence;
  paid_total: Pence;
  credited_total: Pence;
  balance: Pence;
  /** Needs approval before it can be issued under the practice's current settings. */
  approval_required: boolean;
  sent_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

export type InvoiceLineKind = 'time' | 'fixed_fee' | 'disbursement' | 'expense' | 'manual';

/** The WIP a line bills: `adjustment = billed_value - wip_value` (negative: write-off). */
export interface InvoiceLineWip {
  item_count: number;
  time_entry_ids: string[];
  disbursement_ids: string[];
  wip_value: Pence;
  billed_value: Pence;
  adjustment: Pence;
}

export interface InvoiceLine {
  id: string;
  position: number;
  kind: InvoiceLineKind;
  description: string;
  job_id: string | null;
  service_id: string | null;
  /** A decimal string with two places. */
  quantity: string;
  unit_amount: Pence;
  net_amount: Pence;
  vat_rate_id: string | null;
  vat_rate_bp: BasisPoints;
  vat_amount: Pence;
  gross_amount: Pence;
  /** Null on manual lines. */
  wip: InvoiceLineWip | null;
}

export interface VatSummaryRow {
  vat_rate_bp: BasisPoints;
  net: Pence;
  vat: Pence;
}

export interface InvoicePaymentRow {
  allocation_id: string;
  payment_id: string;
  received_on: IsoDate;
  method: string;
  reference: string | null;
  amount: Pence;
}

export interface InvoiceCreditNoteRow {
  id: string;
  number: string;
  issue_date: IsoDate;
  reason: string;
  gross_total: Pence;
}

export interface InvoiceWipTotals {
  wip_value: Pence;
  billed_value: Pence;
  adjustment: Pence;
}

export type ApprovalAction = 'submitted' | 'approved' | 'rejected';

/** One step of the approval history of an invoice, oldest first. */
export interface ApprovalEvent {
  id: string;
  action: ApprovalAction;
  actor: PersonRef;
  note: string | null;
  /** The invoice total when the step happened. */
  gross_total: Pence;
  created_at: IsoDateTime;
}

export interface InvoiceDetail extends InvoiceSummary {
  notes: string | null;
  issued_at: IsoDateTime | null;
  issued_by: string | null;
  voided_at: IsoDateTime | null;
  void_reason: string | null;
  created_by: string | null;
  approvals: ApprovalEvent[];
  /** The caller may approve it right now (holds `invoice.approve`, and the self-approval rule allows it). */
  can_approve: boolean;
  lines: InvoiceLine[];
  vat_summary: VatSummaryRow[];
  wip: InvoiceWipTotals;
  payments: InvoicePaymentRow[];
  credit_notes: InvoiceCreditNoteRow[];
}

/** `GET /invoices/summary`: the figures behind the status tabs. */
export interface InvoiceListSummary {
  counts: Record<InvoiceDisplayStatus | 'total', number>;
  outstanding: Pence;
  overdue: Pence;
  awaiting_approval_gross: Pence;
}

export type GroupBy = 'job' | 'entry' | 'single';

/** Changes one line of the draft being built: exactly one selector, then what to change. */
export interface LineOverride {
  job_id?: string;
  time_entry_id?: string;
  disbursement_id?: string;
  net_amount?: Pence;
  description?: string;
  vat_rate_id?: string;
}

export interface InvoiceCreate {
  client_id: string;
  issue_date?: IsoDate;
  due_date?: IsoDate;
  reference?: string;
  notes?: string;
  time_entry_ids: string[];
  disbursement_ids: string[];
  /** Approved expense lines (only when the API takes them; see `docs/modules/wip.md`). */
  expense_line_ids?: string[];
  group_by: GroupBy;
  overrides: LineOverride[];
}

/** PATCH of the header: a draft takes all four, an issued invoice is not editable. */
export interface InvoiceHeaderUpdate {
  issue_date?: IsoDate;
  due_date?: IsoDate;
  reference?: string | null;
  notes?: string | null;
}

export interface InvoiceLineCreate {
  description: string;
  /** A decimal string with two places. */
  quantity?: string;
  unit_amount: Pence;
  net_amount?: Pence;
  vat_rate_id?: string | null;
}

export interface InvoiceLineUpdate {
  description?: string;
  quantity?: string;
  unit_amount?: Pence;
  net_amount?: Pence;
  /** Null re-applies the default VAT resolution. */
  vat_rate_id?: string | null;
}

export interface InvoiceIssueBody {
  issue_date?: IsoDate;
  due_date?: IsoDate;
}

export interface InvoiceSent {
  invoice_id: string;
  to: string[];
  queued: boolean;
}

export interface InvoiceListFilters {
  client_id?: string;
  status?: ReadonlyArray<InvoiceDisplayStatus>;
  date_from?: IsoDate;
  date_to?: IsoDate;
  q?: string;
  outstanding?: boolean;
}

/* -------------------------------- Credit notes ------------------------------- */

export interface CreditNoteLine {
  id: string;
  position: number;
  description: string;
  net_amount: Pence;
  vat_rate_id: string | null;
  vat_rate_bp: BasisPoints;
  vat_amount: Pence;
  gross_amount: Pence;
}

export interface CreditNote {
  id: string;
  number: string;
  invoice_id: string;
  invoice_number: string | null;
  client: ClientRef | null;
  issue_date: IsoDate;
  reason: string;
  net_total: Pence;
  vat_total: Pence;
  gross_total: Pence;
  /** Null in the list. */
  lines: CreditNoteLine[] | null;
  created_by: string | null;
  created_at: IsoDateTime;
}

export interface CreditNoteCreate {
  lines: Array<{ description: string; net_amount: Pence; vat_rate_id?: string }>;
  reason: string;
  issue_date?: IsoDate;
}

export interface CreditNoteListFilters {
  client_id?: string;
  invoice_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
  q?: string;
}

/* ---------------------------------- Payments --------------------------------- */

export const PAYMENT_METHODS = [
  'bank_transfer',
  'card',
  'direct_debit',
  'cash',
  'cheque',
  'other',
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATES = [
  'unallocated',
  'part_allocated',
  'allocated',
  'void',
  'reversed',
] as const;
export type PaymentState = (typeof PAYMENT_STATES)[number];

export interface PaymentAllocation {
  id: string;
  invoice_id: string;
  invoice_number: string | null;
  amount: Pence;
  created_at: IsoDateTime;
}

export interface Payment {
  id: string;
  client: ClientRef | null;
  received_on: IsoDate;
  amount: Pence;
  method: PaymentMethod;
  reference: string | null;
  notes: string | null;
  allocated_total: Pence;
  unallocated: Pence;
  state: PaymentState;
  voided_at: IsoDateTime | null;
  /** Set on a reversed payment (which also has `voided_at`). */
  reversed_at: IsoDateTime | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  /** The reversal was a bounced payment. */
  bounced: boolean;
  created_by: string | null;
  created_at: IsoDateTime;
  /** Null in the list. */
  allocations: PaymentAllocation[] | null;
}

export interface AllocationInput {
  invoice_id: string;
  amount: Pence;
}

export interface PaymentCreate {
  client_id: string;
  received_on: IsoDate;
  amount: Pence;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  allocations?: AllocationInput[];
  auto_allocate?: boolean;
}

/** Either explicit allocations or `auto_allocate: true` (oldest invoice first). */
export type AllocateBody = { allocations: AllocationInput[] } | { auto_allocate: true };

export interface PaymentListFilters {
  client_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
  method?: ReadonlyArray<PaymentMethod>;
  state?: PaymentState | 'on_account';
  q?: string;
}

/* --------------------------------- Statements -------------------------------- */

export type StatementEntryType = 'invoice' | 'credit_note' | 'payment' | 'payment_reversal';

export interface StatementEntry {
  date: IsoDate;
  type: StatementEntryType;
  id: string;
  number: string | null;
  description: string;
  /** Invoices add, credit notes and payments subtract. */
  amount: Pence;
  balance: Pence;
}

export interface Statement {
  client: ClientRef;
  currency: string;
  date_from: IsoDate | null;
  date_to: IsoDate;
  opening_balance: Pence;
  entries: StatementEntry[];
  invoiced: Pence;
  credited: Pence;
  paid: Pence;
  closing_balance: Pence;
  /** Cash received that is not allocated to any invoice. */
  unallocated_cash: Pence;
}

/* ------------------------------------ WIP ------------------------------------ */

export type WipItemKind = 'time' | 'fixed_fee' | 'expense' | 'disbursement';

/** What a recognised fixed fee is made of (`kind = 'fixed_fee'` items only). */
export interface FixedFeeInfo {
  fee: Pence;
  recognised: Pence;
  billed: Pence;
  mode: string;
  progress_bp: BasisPoints | null;
  /** The job's unbilled time entries: billing selects these to bill the fee. */
  time_entry_ids: string[];
}

/** One billable item of the client's WIP (`docs/modules/wip.md`, "Contract for billing"). */
export interface WipItem {
  kind: WipItemKind;
  id: string;
  date: IsoDate;
  age_days?: number;
  job: JobRef | null;
  person: { user_id: string; full_name: string | null } | null;
  description: string | null;
  minutes: number | null;
  /** A decimal string with two places. */
  hours: string | null;
  rate: Pence | null;
  /** What counts in the totals (0 for time of a fixed-fee job whose fee is recognised). */
  value: Pence;
  /** What the time is worth at its charge-out rate. */
  charge_value?: Pence;
  component?: string;
  /** False for items billing cannot take by their id (a fixed fee, an adjustment). */
  selectable?: boolean;
  supplier: string | null;
  claim_id?: string | null;
  fixed_fee?: FixedFeeInfo | null;
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

/* ---------------------------- Credit notes and WIP ---------------------------- */

export type CreditNoteWipMode = 'return' | 'write_off';

/** `POST /credit-notes/{id}/wip`: what became of the work a credit note cleared. */
export interface CreditNoteWip {
  id: string;
  credit_note_id: string;
  invoice_id: string;
  client: ClientRef | null;
  mode: CreditNoteWipMode;
  reason: string;
  net_credited: Pence;
  wip_value: Pence;
  item_count: number;
  created_at: IsoDateTime;
}

/* --------------------------------- Debtors --------------------------------- */

export const AGEING_BUCKETS = [
  'current',
  'days_1_30',
  'days_31_60',
  'days_61_90',
  'days_90_plus',
] as const;
export type AgeingBucket = (typeof AGEING_BUCKETS)[number];

export type AgeingAmounts = Record<AgeingBucket, Pence>;

export interface DebtorRow extends AgeingAmounts {
  client: ClientRef;
  partner_user_id: string | null;
  manager_user_id: string | null;
  total: Pence;
  /** Everything past its due date: `total - current`. */
  overdue: Pence;
  invoice_count: number;
  oldest_due_date: IsoDate | null;
  max_days_overdue: number;
  last_reminder_at: IsoDateTime | null;
}

export interface DebtorTotals extends AgeingAmounts {
  total: Pence;
  overdue: Pence;
  client_count: number;
  invoice_count: number;
}

/** `GET /debtors`: the clients that owe something, with the totals of every matching client. */
export interface DebtorsPage {
  as_at: IsoDate;
  currency: string;
  totals: DebtorTotals;
  rows: DebtorRow[];
}

export interface DebtorInvoice {
  id: string;
  number: string | null;
  /** `opening` for an imported opening invoice. */
  source: string | null;
  issue_date: IsoDate | null;
  due_date: IsoDate | null;
  days_overdue: number;
  bucket: AgeingBucket;
  gross_total: Pence;
  paid: Pence;
  credited: Pence;
  outstanding: Pence;
  display_status: InvoiceDisplayStatus;
  last_reminder_at: IsoDateTime | null;
  reminder_count: number;
}

/** `GET /debtors/{client_id}/invoices`: the client's open invoices, oldest due first. */
export interface DebtorInvoices {
  client: ClientRef;
  as_at: IsoDate;
  totals: AgeingAmounts & { total: Pence };
  invoices: DebtorInvoice[];
}

export interface DebtorFilters {
  as_at?: IsoDate;
  client_id?: string;
  partner_user_id?: string;
  manager_user_id?: string;
  /** Pence: only clients whose total is at least this. */
  min_balance?: Pence;
}

export type DebtorSort =
  | 'client'
  | 'total'
  | 'current'
  | 'days_1_30'
  | 'days_31_60'
  | 'days_61_90'
  | 'days_90_plus'
  | 'oldest_due';

/* -------------------------------- Reminders -------------------------------- */

export type ReminderTemplate = 'client_payment_reminder' | 'client_payment_final_notice';

export type ReminderSkipReason =
  | 'already_reminded_today'
  | 'not_overdue'
  | 'no_balance'
  | 'not_issued'
  | 'no_recipient';

/** Exactly one of `client_ids` (every overdue invoice of each) and `invoice_ids`. */
export type ReminderRequest = {
  template?: ReminderTemplate;
  dry_run?: boolean;
} & ({ client_ids: string[]; invoice_ids?: never } | { invoice_ids: string[]; client_ids?: never });

export interface ReminderPreview {
  client: ClientRef;
  to: string[];
  subject: string;
  text: string;
  total_due: Pence;
  invoices: Array<{
    invoice_id: string;
    number: string | null;
    due_date: IsoDate;
    days_overdue: number;
    outstanding: Pence;
  }>;
}

export interface ReminderResult {
  dry_run: boolean;
  template: ReminderTemplate;
  emails_queued: number;
  invoices_queued: number;
  clients: ReminderPreview[];
  skipped: Array<{
    invoice_id: string;
    number: string | null;
    client_id: string;
    reason: ReminderSkipReason;
  }>;
}

export type ReminderStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export interface ReminderLogEntry {
  id: string;
  client: ClientRef;
  invoice: { id: string; number: string | null };
  template: ReminderTemplate;
  source: 'manual' | 'scheduled';
  status: ReminderStatus;
  sent_on: IsoDate | null;
  to: string[];
  days_overdue: number;
  amount_due: Pence;
  sent_by: PersonRef | null;
  sent_at: IsoDateTime | null;
  error: string | null;
  created_at: IsoDateTime;
}

export interface ReminderLogFilters {
  client_id?: string;
  invoice_id?: string;
  status?: ReminderStatus;
  source?: 'manual' | 'scheduled';
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* ---------------------------- Statements (list) ---------------------------- */

export interface StatementRow {
  client: ClientRef;
  partner_user_id: string | null;
  manager_user_id: string | null;
  outstanding: Pence;
  on_account: Pence;
  /** `outstanding - on_account`: the closing balance of the statement. */
  balance: Pence;
  overdue: Pence;
  oldest_overdue_due_date: IsoDate | null;
  oldest_overdue_days: number;
  last_statement_sent_at: IsoDateTime | null;
  last_statement_to: string[] | null;
  has_recipient: boolean;
}

export interface StatementTotals {
  client_count: number;
  outstanding: Pence;
  overdue: Pence;
  on_account: Pence;
  balance: Pence;
}

/** `GET /statements`: the clients that owe something or hold cash on account. */
export interface StatementsPage {
  totals: StatementTotals;
  rows: StatementRow[];
}

export type StatementSort = 'client' | 'balance' | 'overdue' | 'last_sent';

export interface StatementListFilters {
  client_id?: string;
  partner_user_id?: string;
  manager_user_id?: string;
  min_balance?: Pence;
  overdue_only?: boolean;
  never_sent?: boolean;
  q?: string;
}

export interface StatementSendBody {
  date_from?: IsoDate;
  date_to?: IsoDate;
  to?: string[];
}

export interface StatementSent {
  id: string;
  client_id: string;
  to: string[];
  date_from: IsoDate | null;
  date_to: IsoDate;
  closing_balance: Pence;
  /** False: a send for this client is already queued (the last ten minutes). */
  queued: boolean;
}

/* ---------------------------------- Settings --------------------------------- */

/** A VAT code of the practice as the line selects offer it. */
export interface VatOption {
  id: string;
  name: string;
  code: string;
  rate_bp: BasisPoints;
  is_default: boolean;
  is_archived: boolean;
}
