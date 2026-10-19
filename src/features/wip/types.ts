import type { IsoDate, IsoDateTime, Pence } from '@/types/api';

/** Shapes of the WIP endpoints (`/wip/*`, `/reports/wip`); money is pence, dates are ISO days. */

export const WIP_GROUPS = ['client', 'job', 'partner', 'manager', 'service'] as const;
export type WipGroup = (typeof WIP_GROUPS)[number];

export const HISTORIC_GROUPS = ['client', 'job', 'billing_type'] as const;
export type HistoricGroup = (typeof HISTORIC_GROUPS)[number];

/** Which WIP an adjustment or a transfer moves. */
export const WIP_COMPONENTS = ['time', 'fixed_fee', 'expense'] as const;
export type WipComponent = (typeof WIP_COMPONENTS)[number];

export const WIP_ITEM_KINDS = [
  'time',
  'disbursement',
  'expense',
  'fixed_fee',
  'adjustment',
] as const;
export type WipItemKind = (typeof WIP_ITEM_KINDS)[number];

/** The kinds of item billing (and a write-off or transfer) can take by id. */
export type SelectableKind = 'time' | 'disbursement' | 'expense';

export interface ClientRef {
  id: string;
  code: string;
  name: string;
}

export interface PersonRef {
  user_id: string;
  full_name: string | null;
}

export interface JobRef {
  id: string;
  number: string;
  name: string;
  billing_basis?: string | null;
}

/** A job as the adjustment, transfer and ledger records name it. */
export interface WipJobRef {
  id: string;
  number: string | null;
  name: string | null;
  billing_basis?: string | null;
}

/* --------------------------------- Summary --------------------------------- */

/** Value by the age of the items, in pence. */
export interface WipAges {
  days_0_30: Pence;
  days_31_60: Pence;
  days_61_90: Pence;
  days_90_plus: Pence;
}

export interface WipGroupTotals {
  minutes: number;
  hours: string;
  time: Pence;
  fixed_fee: Pence;
  expense: Pence;
  total: Pence;
  ages: WipAges;
  oldest_date: IsoDate | null;
  item_count: number;
  /** The share of the total older than 90 days, in basis points; null without WIP. */
  over_90_bp: number | null;
}

export interface WipGroupRow extends WipGroupTotals {
  group_by: WipGroup;
  /** The id of what the row stands for; null for work without one (no partner, say). */
  key: string | null;
  name: string;
  code: string | null;
  client: ClientRef | null;
}

export interface WipSummary {
  group_by: WipGroup;
  as_at: IsoDate;
  rows: WipGroupRow[];
  /** Over every row the filters select, not only the page. */
  totals: WipGroupTotals;
}

export const SUMMARY_SORTS = [
  'name',
  'total',
  'time',
  'fixed_fee',
  'expense',
  'oldest',
  'over_90',
  'items',
] as const;
export type SummarySort = (typeof SUMMARY_SORTS)[number];

export type SortOrder = 'asc' | 'desc';

/** The filters every WIP view shares. */
export interface WipFilters {
  client_id?: string;
  job_id?: string;
  partner_user_id?: string;
  manager_user_id?: string;
  service_id?: string;
}

export interface SummaryFilters extends WipFilters {
  group_by: WipGroup;
  q?: string;
  sort?: SummarySort;
  order?: SortOrder;
}

/* ---------------------------------- Items ---------------------------------- */

export interface FixedFee {
  fee: Pence;
  recognised: Pence;
  billed: Pence;
  mode: string;
  progress_bp: number | null;
  time_entry_ids: string[];
}

export interface WipItem {
  kind: WipItemKind;
  id: string;
  date: IsoDate;
  job: JobRef | null;
  person: PersonRef | null;
  description: string | null;
  minutes: number | null;
  hours: string | null;
  rate: Pence | null;
  /** What counts in the totals. */
  value: Pence;
  client?: ClientRef | null;
  age_days?: number | null;
  component?: WipComponent | null;
  charge_value?: Pence | null;
  /** Whether billing, a write-off or a transfer may take the item by its id. */
  selectable?: boolean | null;
  supplier?: string | null;
  fixed_fee?: FixedFee | null;
}

export const ITEM_SORTS = ['date', 'value', 'client'] as const;
export type ItemSort = (typeof ITEM_SORTS)[number];

export interface ItemFilters extends WipFilters {
  kind?: WipItemKind[];
  min_age_days?: number;
  q?: string;
  sort?: ItemSort;
  order?: SortOrder;
}

/* ------------------------------- Adjustments ------------------------------- */

export const ADJUSTMENT_KINDS = ['write_on', 'write_off'] as const;
export type AdjustmentKind = (typeof ADJUSTMENT_KINDS)[number];

export const ADJUSTMENT_STATUSES = ['pending', 'approved', 'rejected', 'reversed'] as const;
export type AdjustmentStatus = (typeof ADJUSTMENT_STATUSES)[number];

export interface Adjustment {
  id: string;
  client: ClientRef | null;
  job: WipJobRef | null;
  kind: AdjustmentKind;
  component: WipComponent;
  amount: Pence;
  /** Positive for a write-on, negative for a write-off. */
  signed_amount: Pence;
  effective_date: IsoDate;
  reason: string;
  status: AdjustmentStatus;
  approval_required: boolean;
  threshold: Pence;
  requested_by: PersonRef;
  requested_at: IsoDateTime;
  decided_by: PersonRef | null;
  decided_at: IsoDateTime | null;
  decision_note: string | null;
  reversed_by: PersonRef | null;
  reversed_at: IsoDateTime | null;
  reversal_reason: string | null;
  /** Approved, not reversed and not yet billed. */
  in_force: boolean;
  movement_id: string | null;
}

export interface AdjustmentCounts {
  pending: number;
  approved: number;
  rejected: number;
  reversed: number;
  /** What is waiting for approval, in pence. */
  pending_value: Pence;
}

export interface AdjustmentInput {
  client_id: string;
  job_id?: string | null;
  kind: AdjustmentKind;
  amount: Pence;
  reason: string;
  component?: WipComponent | null;
  effective_date?: IsoDate | null;
}

export interface AdjustmentFilters {
  status?: AdjustmentStatus[];
  kind?: AdjustmentKind;
  client_id?: string;
  job_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* --------------------------------- Transfers --------------------------------- */

export const TRANSFER_STATUSES = ['applied', 'reversed'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];

export interface TransferItemRef {
  kind: SelectableKind;
  id: string;
}

export interface TransferItem extends TransferItemRef {
  value: Pence;
}

export interface Transfer {
  id: string;
  client: ClientRef | null;
  from_job: WipJobRef | null;
  to_job: WipJobRef | null;
  component: WipComponent;
  amount: Pence;
  effective_date: IsoDate;
  reason: string;
  items: TransferItem[];
  status: TransferStatus;
  created_by: PersonRef;
  created_at: IsoDateTime;
  reversed_by: PersonRef | null;
  reversed_at: IsoDateTime | null;
  reversal_reason: string | null;
}

/** Either the `items` or an `amount` moves; the API refuses both and neither. */
export interface TransferInput {
  from_job_id: string;
  to_job_id: string;
  items?: TransferItemRef[] | null;
  amount?: Pence | null;
  reason: string;
  component?: WipComponent | null;
  effective_date?: IsoDate | null;
}

export interface TransferFilters {
  status?: TransferStatus;
  client_id?: string;
  job_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* --------------------------------- Write-offs --------------------------------- */

export interface WipItemRef {
  time_entry_id?: string | null;
  disbursement_id?: string | null;
  expense_id?: string | null;
}

export interface WriteOffInput {
  client_id: string;
  items?: WipItemRef[] | null;
  job_id?: string | null;
  reason: string;
  written_off_on?: IsoDate | null;
}

export interface WriteOff {
  id: string;
  client: ClientRef | null;
  /** Set when the write-off took all the WIP of a job. */
  job_id: string | null;
  written_off_on: IsoDate;
  reason: string;
  total_wip_value: Pence;
  item_count: number;
  created_by: string | null;
  created_at: IsoDateTime;
}

export interface WriteOffFilters {
  client_id?: string;
  job_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* ---------------------------------- Ledger ---------------------------------- */

export const MOVEMENT_KINDS = [
  'write_on',
  'write_off',
  'transfer_out',
  'transfer_in',
  'credit_return',
  'credit_write_off',
  'reversal',
] as const;
export type MovementKind = (typeof MOVEMENT_KINDS)[number];

export type MovementSource = 'adjustment' | 'transfer' | 'write_off' | 'credit_note';

export interface Movement {
  id: string;
  kind: MovementKind;
  /** `amount` rows adjust a job's WIP; `items` rows are memos of what a credit note did. */
  scope: 'amount' | 'items';
  component: WipComponent;
  client: ClientRef | null;
  job: WipJobRef | null;
  /** Signed: positive adds WIP, negative removes it. */
  amount: Pence;
  effective_date: IsoDate;
  reason: string;
  actor: PersonRef | null;
  approval_state: 'not_required' | 'approved';
  approved_by: PersonRef | null;
  approved_at: IsoDateTime | null;
  reversal_of_id: string | null;
  reversed: boolean;
  source_type: MovementSource | null;
  source_id: string | null;
  item_count: number;
  created_at: IsoDateTime;
}

export interface LedgerFilters {
  client_id?: string;
  job_id?: string;
  kind?: MovementKind[];
  source_type?: MovementSource;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* ------------------------------- Historic WIP ------------------------------- */

export interface HistoricAmounts {
  minutes: number;
  hours: string;
  time_wip: Pence;
  fixed_fee_wip: Pence;
  expense_wip: Pence;
  write_ons: Pence;
  write_offs: Pence;
  total: Pence;
  ages: WipAges;
  oldest_date: IsoDate | null;
  item_count: number;
}

export interface HistoricRow extends HistoricAmounts {
  group_by: HistoricGroup;
  key: string | null;
  name: string;
  code: string | null;
  client: ClientRef | null;
  billing_type: string | null;
}

export interface SnapshotInfo {
  /** A day before today is frozen the first time it is reported: it never changes. */
  frozen: boolean;
  taken_at: IsoDateTime | null;
  source: string | null;
}

export interface HistoricReport {
  rows: HistoricRow[];
  totals: HistoricAmounts;
  filters: { as_at: IsoDate; group_by: HistoricGroup };
  snapshot: SnapshotInfo;
  notice: string;
}

export interface HistoricFilters extends WipFilters {
  as_at: IsoDate;
  group_by: HistoricGroup;
}

export type BillingType = 'hourly' | 'fixed' | 'non_billable';

export interface HistoricItem {
  kind: WipItemKind;
  id: string;
  component: WipComponent;
  date: IsoDate;
  age_days: number;
  client: ClientRef;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  billing_type: string | null;
  description: string | null;
  minutes: number;
  value: Pence;
  charge_value: Pence | null;
}

export interface HistoricItemFilters extends WipFilters {
  as_at: IsoDate;
  billing_type?: BillingType;
}

/** What a report downloads as (`format=` of `GET /reports/wip`). */
export type ExportFormat = 'csv' | 'xlsx';

/* ---------------------------------- People ---------------------------------- */

/** What the WIP screens need of `MemberRead` (`GET /members`). */
export interface Member {
  user_id: string;
  full_name: string;
  email: string;
  status: string;
}
