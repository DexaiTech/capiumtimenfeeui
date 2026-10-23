/**
 * Shapes of the clients API (`app/schemas/clients.py`, `app/schemas/rates.py`
 * `ClientRateRead`, `app/schemas/settings.py` `ServiceRead`, `app/schemas/organization.py`
 * `MemberRead`). Field names mirror the Pydantic models exactly. Money is integer pence.
 * The central client service and the Client 360 figures have their own files
 * (`central/types.ts`, `workspace/types.ts`).
 */
import type { IsoDate, IsoDateTime, Pence } from '@/types/api';

export const CLIENT_TYPES = [
  'individual',
  'sole_trader',
  'partnership',
  'llp',
  'limited_company',
  'trust',
  'charity',
  'other',
] as const;
export type ClientType = (typeof CLIENT_TYPES)[number];

export const CLIENT_STATUSES = ['prospect', 'active', 'inactive', 'archived'] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const AML_STATUSES = ['not_started', 'pending', 'clear', 'review', 'failed'] as const;
export type AmlStatus = (typeof AML_STATUSES)[number];

export const ACCOUNTING_SOFTWARE = ['xero', 'quickbooks', 'sage', 'freeagent', 'other'] as const;
export type AccountingSoftware = (typeof ACCOUNTING_SOFTWARE)[number];

export const FREQUENCIES = ['one_off', 'monthly', 'quarterly', 'annually'] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const CLIENT_SORTS = [
  'name',
  'code',
  'segment',
  'health_score',
  'aml_status',
  'created_at',
  'last_activity_at',
] as const;
export type ClientSort = (typeof CLIENT_SORTS)[number];
export type SortOrder = 'asc' | 'desc';

export type DeadlineStatus = 'overdue' | 'due_today' | 'due_soon' | 'on_track' | 'none';

/** `local` (created here), `synced`, `stale` (central unavailable) or `failed` (not found there). */
export const CENTRAL_SYNC_STATES = ['local', 'synced', 'stale', 'failed'] as const;
export type CentralSyncState = (typeof CENTRAL_SYNC_STATES)[number];

/** The list filter: clients enabled from the central service, or created in this practice. */
export type CentralFilter = 'linked' | 'local';

/* --------------------------------- Contacts --------------------------------- */

export interface ContactRead {
  id: string;
  client_id: string;
  name: string;
  position: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  is_billing: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ContactCreate {
  name: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Left out: the client's first contact becomes its primary contact. */
  is_primary?: boolean | null;
  is_billing?: boolean;
}

export interface ContactUpdate {
  name?: string;
  position?: string | null;
  email?: string | null;
  phone?: string | null;
  is_primary?: boolean;
  is_billing?: boolean;
}

/* ------------------------- Engagements (client services) ------------------------- */

export interface ClientServiceRead {
  id: string;
  client_id: string;
  service_id: string;
  service_code: string;
  service_name: string;
  billing_basis: string;
  /** The agreed fee per occurrence (null: the service's default fee applies). */
  fee: Pence | null;
  effective_fee: Pence | null;
  frequency: string;
  start_date: IsoDate | null;
  end_date: IsoDate | null;
  is_active: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ClientServiceCreate {
  service_id: string;
  fee?: Pence | null;
  frequency?: Frequency;
  start_date?: IsoDate | null;
  end_date?: IsoDate | null;
  is_active?: boolean;
}

export interface ClientServiceUpdate {
  fee?: Pence | null;
  frequency?: Frequency;
  start_date?: IsoDate | null;
  end_date?: IsoDate | null;
  is_active?: boolean;
}

/* ---------------------------------- Clients ---------------------------------- */

/** Fields shared by `ClientCreate` and `ClientUpdate`. */
interface ClientWritableFields {
  code: string | null;
  name: string;
  client_type: ClientType;
  status: ClientStatus;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  company_number: string | null;
  utr: string | null;
  vat_number: string | null;
  year_end_month: number | null;
  year_end_day: number | null;
  partner_user_id: string | null;
  manager_user_id: string | null;
  payment_terms_days: number | null;
  default_vat_rate_id: string | null;
  billing_notes: string | null;
  notes: string | null;
  segment: string | null;
  aml_status: AmlStatus;
  aml_checked_on: IsoDate | null;
  health_score: number | null;
  accounting_software: AccountingSoftware | null;
  /** Where invoices are emailed (first choice of every invoice's recipients). */
  invoice_email: string | null;
  default_service_id: string | null;
  /** Null: the practice's default invoice template. */
  invoice_template_id: string | null;
}

export type ClientCreate = Partial<ClientWritableFields> & {
  name: string;
  contacts?: ContactCreate[];
};

/** PATCH body: every field optional; `code, name, client_type, status, country, aml_status` never null. */
export type ClientUpdate = Partial<ClientWritableFields>;

/**
 * `POST /clients/bulk`: one action on 1-200 clients, all or nothing. `set_manager`, `set_partner`
 * and `set_segment` take null to clear; `delete` takes no value. `set_status` with `archived`
 * archives (there is no separate archive action).
 */
export type ClientBulkRequest = { client_ids: string[] } & (
  | { action: 'set_status'; value: ClientStatus }
  | { action: 'set_manager' | 'set_partner'; value: string | null }
  | { action: 'set_segment'; value: string | null }
  | { action: 'delete' }
);

export interface ClientRead {
  id: string;
  code: string;
  name: string;
  initials: string;
  client_type: string;
  status: string;
  email: string | null;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postcode: string | null;
  country: string;
  company_number: string | null;
  utr: string | null;
  vat_number: string | null;
  year_end_month: number | null;
  year_end_day: number | null;
  partner_user_id: string | null;
  manager_user_id: string | null;
  payment_terms_days: number | null;
  default_vat_rate_id: string | null;
  billing_notes: string | null;
  notes: string | null;
  segment: string | null;
  aml_status: string;
  aml_checked_on: IsoDate | null;
  health_score: number | null;
  accounting_software: string | null;
  invoice_email: string | null;
  default_service_id: string | null;
  invoice_template_id: string | null;
  /** Id of the linked central client; null for a client created in this practice. */
  central_client_id: string | null;
  central_sync_state: CentralSyncState;
  /** When the centrally managed name and address were last confirmed. */
  central_synced_at: IsoDateTime | null;
  /** Set on a client that was merged away: the client that now holds its work. */
  merged_into_client_id: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** Derived from the client's open jobs' due dates against today in the practice zone. */
export interface Deadlines {
  open_jobs: number;
  overdue: number;
  /** Days the most overdue open job is past its due date (0 when none is overdue). */
  overdue_days: number;
  due_today: number;
  /** Due after today and within `due_soon_days` days. */
  due_soon: number;
  due_soon_days: number;
  next_due_date: IsoDate | null;
  status: DeadlineStatus;
}

export interface PrimaryContact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface ServiceTag {
  service_id: string;
  code: string;
  name: string;
}

/** One row of `GET /clients`. */
export interface ClientListItem extends ClientRead {
  primary_contact: PrimaryContact | null;
  /** The Contact column (null: the UI offers "+ Add"). */
  contact_name: string | null;
  /** Primary contact's email, else the client's own email. */
  contact_email: string | null;
  deadlines: Deadlines;
  last_activity_at: IsoDateTime;
  services: ServiceTag[];
}

/** WIP figures need `wip.read`, balances `invoice.read`, on-account `payment.read`; else null. */
export interface Financials {
  wip_time_value: Pence | null;
  wip_disbursement_value: Pence | null;
  wip_total: Pence | null;
  /** Minutes of billable unbilled time that count as WIP. */
  unbilled_minutes: number | null;
  outstanding_balance: Pence | null;
  overdue_balance: Pence | null;
  on_account: Pence | null;
}

export interface RecurringFees {
  annual_net: Pence;
  annual_vat: Pence;
  annual_gross: Pence;
  one_off_net: Pence;
}

/** A client's charge-out rate: the id is the id of the rate rule (`PATCH /rates/{id}` end-dates it). */
export interface ClientRateRead {
  id: string;
  client_id: string;
  /** Null: the rate applies to everyone working for the client. */
  user_id: string | null;
  user_name: string | null;
  /** Pence per hour. */
  hourly_rate: Pence;
  effective_from: IsoDate;
  /** Null: open-ended. */
  effective_to: IsoDate | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** `POST /clients/{id}/rates`: a person's rate, or everyone's with `user_id` null. */
export interface ClientRateCreate {
  user_id: string | null;
  hourly_rate: Pence;
  /** Left out: the rate applies to every day. */
  effective_from?: IsoDate;
  effective_to?: IsoDate | null;
}

/** A reference to a client (`ClientRef`): the id, the code and the name. */
export interface ClientRef {
  id: string;
  code: string;
  name: string;
}

export interface TemplateRef {
  id: string;
  name: string;
}

/** `GET/POST/PATCH /clients/{id}` and archive. */
export interface ClientDetail extends ClientListItem {
  contacts: ContactRead[];
  engagements: ClientServiceRead[];
  /** Null without `rate.read`. */
  rates: ClientRateRead[] | null;
  financials: Financials;
  recurring_fees: RecurringFees;
  default_service: ServiceTag | null;
  invoice_template: TemplateRef | null;
  /** The client this one was merged into. */
  merged_into: ClientRef | null;
}

export interface SegmentCount {
  segment: string | null;
  count: number;
}

export interface ClientSummary {
  total: number;
  by_status: Record<string, number>;
  by_client_type: Record<string, number>;
  by_aml_status: Record<string, number>;
  by_accounting_software: Record<string, number>;
  by_segment: SegmentCount[];
  with_overdue_deadlines: number;
  /** Clients enabled from the central service (`linked`) and created here (`local`). */
  by_central: { linked: number; local: number };
  /** Active staff members of the practice ("Users 18"). */
  users: number;
}

/* ---------------------------------- Import ---------------------------------- */

export interface ImportRowError {
  /** 1-based data row number (the header is row 0). */
  row: number;
  field: string;
  code: string;
  message: string;
}

export interface ImportedClient {
  row: number;
  code: string | null;
  name: string;
  id: string | null;
}

export interface ImportResult {
  dry_run: boolean;
  total_rows: number;
  valid_rows: number;
  created: number;
  columns: string[];
  ignored_columns: string[];
  errors: ImportRowError[];
  clients: ImportedClient[];
}

/* ---------------------------- Other modules' shapes ---------------------------- */

/** `ServiceRead` (`GET /services`). */
export interface ServiceRead {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_basis: string;
  default_fee: Pence | null;
  vat_rate_id: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface MemberRole {
  id: string;
  name: string;
  system_key: string | null;
}

/** `MemberRead` (`GET /members`). */
export interface MemberRead {
  user_id: string;
  full_name: string;
  email: string;
  role: MemberRole;
  status: string;
  manager_user_id: string | null;
  weekly_capacity_minutes: number;
  chargeable_target_bp: number;
  job_title: string | null;
  initials: string | null;
  must_change_password: boolean;
  joined_at: IsoDateTime;
}

/* ---------------------------------- UI state ---------------------------------- */

/** The list filters, as the API's query parameters understand them. */
export interface ClientFilters {
  status: ClientStatus[];
  segment: string[];
  client_type: ClientType[];
  aml_status: AmlStatus[];
  accounting_software: AccountingSoftware[];
  service_id: string | null;
  manager_user_id: string | null;
  partner_user_id: string | null;
  central: CentralFilter | null;
}

export interface ClientListParams {
  q: string;
  filters: ClientFilters;
  sort: ClientSort;
  order: SortOrder;
}
