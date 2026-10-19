/**
 * Shapes of the Expenses endpoints (`docs/modules/expenses.md` of the API) and of the older
 * disbursements (`docs/modules/billing.md`). Money is pence, VAT rates and markups are basis
 * points, calendar dates `YYYY-MM-DD` in the practice time zone, timestamps UTC.
 */
import type { BasisPoints, IsoDate, IsoDateTime, Pence } from '@/types/api';

export type SortOrder = 'asc' | 'desc';

/* --------------------------------- Vocabulary --------------------------------- */

/** In the order lists and charts use. */
export const CLAIM_STATUSES = ['draft', 'submitted', 'approved', 'returned'] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

export type ClaimEventAction = 'submitted' | 'recalled' | 'approved' | 'returned' | 'corrected';

/** Who paid: the person (reimbursed) or the practice (company card). */
export type Payer = 'staff' | 'practice';

export const BILLING_STATUSES = ['unbilled', 'in_draft', 'billed', 'written_off'] as const;
export type BillingStatus = (typeof BILLING_STATUSES)[number];

/* ------------------------------------ Types ----------------------------------- */

export interface ExpenseType {
  id: string;
  name: string;
  code: string;
  default_vat_rate_id: string | null;
  is_mileage: boolean;
  default_billable: boolean;
  is_active: boolean;
  /** Whether any line uses the type: a used type is deactivated, never deleted. */
  is_used: boolean;
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ExpenseTypeCreate {
  name: string;
  code: string;
  default_vat_rate_id?: string | null;
  is_mileage?: boolean;
  default_billable?: boolean;
  is_active?: boolean;
}

export type ExpenseTypeUpdate = Partial<ExpenseTypeCreate>;

export type TypeSort = 'name' | 'code';

export interface TypeFilters {
  q?: string;
  is_active?: boolean;
  is_mileage?: boolean;
  sort?: TypeSort;
  order?: SortOrder;
}

/* ----------------------------- Claims, lines, receipts ------------------------- */

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

export interface Receipt {
  id: string;
  expense_id: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  is_image: boolean;
  uploaded_by: string;
  uploaded_by_name: string | null;
  created_at: IsoDateTime;
}

export interface LineTypeRef {
  id: string;
  name: string;
  code: string;
  is_mileage: boolean;
}

export interface ExpenseLine {
  id: string;
  claim_id: string;
  expense_type_id: string;
  expense_type: LineTypeRef;
  incurred_on: IsoDate;
  description: string;
  client_id: string | null;
  client: ClientRef | null;
  job_id: string | null;
  job: JobRef | null;
  supplier: string | null;
  vat_rate_id: string | null;
  vat_rate_bp: BasisPoints | null;
  net: Pence;
  vat: Pence;
  gross: Pence;
  /** Mileage lines only, two decimals ("42.50"). */
  miles: string | null;
  /** Pence per mile the net was priced at. */
  mileage_rate_applied: Pence | null;
  is_billable: boolean;
  /** The practice markup when the line was saved. */
  markup_bp: BasisPoints;
  recharge_amount: Pence;
  payer: Payer;
  billing_status: BillingStatus;
  /** Gross above the practice threshold and not mileage: needs a receipt to be submitted. */
  receipt_required: boolean;
  receipt_count: number;
  receipts: Receipt[];
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A line of `GET /expenses`, with what it belongs to. */
export interface ExpenseLineListItem extends ExpenseLine {
  claim_status: ClaimStatus;
  claim_title: string | null;
  user_id: string;
  user_name: string | null;
}

/** What the caller may do with a claim now: show or hide the buttons by it. */
export interface ClaimActions {
  can_edit: boolean;
  can_delete: boolean;
  can_submit: boolean;
  can_recall: boolean;
  can_approve: boolean;
  can_return: boolean;
  can_correct: boolean;
}

export interface ClaimTotals {
  net: Pence;
  vat: Pence;
  gross: Pence;
  /** What the clients are charged. */
  recharge: Pence;
  /** The gross of the lines the staff member paid. */
  reimbursable: Pence;
}

export interface ExpenseClaim {
  id: string;
  user_id: string;
  user_name: string | null;
  created_by: string;
  created_by_name: string | null;
  title: string | null;
  status: ClaimStatus;
  submitted_at: IsoDateTime | null;
  decided_at: IsoDateTime | null;
  decided_by: string | null;
  decided_by_name: string | null;
  /** The reason of a return, or the optional note of an approval. */
  decision_note: string | null;
  line_count: number;
  first_date: IsoDate | null;
  last_date: IsoDate | null;
  totals: ClaimTotals;
  actions: ClaimActions;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ClaimEvent {
  id: string;
  action: ClaimEventAction;
  actor_user_id: string;
  actor_name: string | null;
  note: string | null;
  created_at: IsoDateTime;
}

export interface ExpenseClaimDetail extends ExpenseClaim {
  lines: ExpenseLine[];
  events: ClaimEvent[];
}

export interface ExpenseSummary {
  counts: Record<ClaimStatus | 'total', number>;
  pending_gross: Pence;
  awaiting_my_approval: { count: number; gross: Pence };
}

/** An item of `GET /expense-receipts`: the receipt with the line and claim it proves. */
export interface ReceiptListItem extends Receipt {
  claim_id: string;
  claim_status: ClaimStatus;
  claim_title: string | null;
  user_id: string;
  user_name: string | null;
  description: string;
  incurred_on: IsoDate;
  gross: Pence;
  client: ClientRef | null;
}

/* ----------------------------------- Requests ---------------------------------- */

export interface ExpenseLineInput {
  expense_type_id: string;
  incurred_on: IsoDate;
  description: string;
  client_id?: string | null;
  job_id?: string | null;
  supplier?: string | null;
  vat_rate_id?: string | null;
  net?: Pence;
  vat?: Pence;
  gross?: Pence;
  /** Mileage types only. */
  miles?: number | string;
  is_billable?: boolean;
  /** Needs `expense.manage`; null recalculates it. */
  recharge_amount?: Pence | null;
  payer?: Payer;
}

/** A line change: any subset; `reason` is required for a line of an approved claim. */
export type ExpenseLineUpdate = Partial<ExpenseLineInput> & { reason?: string };

export interface ExpenseClaimInput {
  title?: string | null;
  /** The claimant when entering a claim for someone else (`expense.manage`). */
  user_id?: string;
  lines?: ExpenseLineInput[];
}

/* ------------------------------------ Filters ---------------------------------- */

export type ClaimSort = 'created_at' | 'submitted_at' | 'total' | 'user';

export interface ClaimFilters {
  status?: ClaimStatus[];
  user_id?: string;
  mine?: boolean;
  date_from?: IsoDate;
  date_to?: IsoDate;
  client_id?: string;
  job_id?: string;
  /** A claim with at least one line that is (not) billable. */
  is_billable?: boolean;
  q?: string;
  sort?: ClaimSort;
  order?: SortOrder;
}

export interface ApprovalFilters {
  user_id?: string;
  q?: string;
}

export type ReceiptSort = 'created_at' | 'incurred_on' | 'gross';

export interface ReceiptFilters {
  claim_id?: string;
  user_id?: string;
  mine?: boolean;
  client_id?: string;
  status?: ClaimStatus[];
  date_from?: IsoDate;
  date_to?: IsoDate;
  q?: string;
  sort?: ReceiptSort;
  order?: SortOrder;
}

export type LineSort = 'incurred_on' | 'gross' | 'created_at';

export interface LineFilters {
  status?: ClaimStatus[];
  user_id?: string;
  mine?: boolean;
  client_id?: string;
  /** Only lines above the receipt threshold (not mileage) that have no receipt. */
  needs_receipt?: boolean;
  date_from?: IsoDate;
  date_to?: IsoDate;
  q?: string;
  sort?: LineSort;
  order?: SortOrder;
}

/* ------------------------------- Disbursements --------------------------------- */

/** One row of `GET /disbursements`: a cost paid on a client's behalf, to recharge. */
export interface Disbursement {
  id: string;
  client_id: string;
  job_id: string | null;
  incurred_on: IsoDate;
  description: string;
  supplier: string | null;
  /** Pence: what is recharged (and enters WIP). */
  amount: Pence;
  vat_rate_id: string | null;
  is_billable: boolean;
  billing_status: BillingStatus;
  created_by: string | null;
  created_at: IsoDateTime;
}

export interface DisbursementCreate {
  client_id: string;
  job_id?: string | null;
  incurred_on: IsoDate;
  description: string;
  supplier?: string | null;
  amount: Pence;
  vat_rate_id?: string | null;
  is_billable?: boolean;
}

export type DisbursementUpdate = Partial<DisbursementCreate>;

export interface DisbursementFilters {
  client_id?: string;
  job_id?: string;
  billing_status?: BillingStatus[];
  is_billable?: boolean;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/** The practice settings the expense screens read (`OrganizationRead`); null when not sent. */
export interface ExpenseSettings {
  receiptThreshold: Pence | null;
  mileageRate: Pence | null;
  markupBp: BasisPoints | null;
}
