/**
 * Shapes of the Team & Rates endpoints (`app/schemas/{staff,grades,rate_rules,settings}.py`,
 * documented in `docs/modules/team-rates.md` of the API). Money is pence (rates are pence per
 * hour), percentages are basis points, dates `YYYY-MM-DD`, timestamps UTC.
 */
import type { RoleSummary } from '@/features/organizations';
import type { BasisPoints, IsoDate, IsoDateTime, Pence } from '@/types/api';

export type SortOrder = 'asc' | 'desc';

/** A named record: a grade, a client or a service (`code` is null in the history). */
export interface RefRead {
  id: string;
  code: string | null;
  name: string;
}

export interface StaffRef {
  id: string;
  code: string | null;
  full_name: string;
}

/** What `DELETE` did: removed the record, or kept it deactivated because it is used. */
export interface DeleteOutcome {
  outcome: 'deleted' | 'deactivated' | 'archived';
  id: string;
}

/* ----------------------------------- Staff ----------------------------------- */

export type StaffStatus = 'active' | 'inactive' | 'left';
export type LoginStatus = 'none' | 'invited' | 'active';
export type StaffSort =
  'name' | 'code' | 'email' | 'grade' | 'status' | 'start_date' | 'leaving_date';

export interface Approver {
  id: string;
  full_name: string;
}

/** `StaffRead`: one row of the staff list. The rate fields are null without `rate.read`. */
export interface StaffMember {
  /** The staff id is also the user id: it is what rates, jobs and time entries refer to. */
  id: string;
  code: string;
  full_name: string;
  /** The work email. */
  email: string | null;
  has_login: boolean;
  /** The sign-in address; null without a login. */
  login_email: string | null;
  login_status: LoginStatus;
  invited_at: IsoDateTime | null;
  status: StaffStatus;
  /** Active and not past the leaving date: time can be recorded for them. */
  is_selectable: boolean;
  grade: RefRead | null;
  approver: Approver | null;
  role: RoleSummary;
  job_title: string | null;
  initials: string | null;
  working_minutes_per_day: number;
  /** ISO weekdays, 1 = Monday. */
  working_days: number[];
  weekly_capacity_minutes: number;
  chargeable_target_bp: BasisPoints;
  start_date: IsoDate | null;
  leaving_date: IsoDate | null;
  charge_rate: Pence | null;
  charge_rate_source: string | null;
  cost_rate: Pence | null;
  cost_rate_source: string | null;
  joined_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** What refers to a person (time, expenses, invoices, …): why they cannot be deleted. */
export interface StaffUsage {
  kind: string;
  label: string;
  count: number;
}

/** `GET {org}/members/{id}/permissions`: a person's permissions on top of their role. */
export interface MemberPermissions {
  user_id: string;
  role: RoleSummary;
  /** What the person's role gives them. */
  role_permissions: string[];
  /** Given to this person although their role does not give them. */
  grants: string[];
  /** Taken from this person although their role gives them. */
  denies: string[];
  /** What they can do: the role's, plus the grants, less the denials. */
  effective: string[];
}

export interface MemberPermissionsUpdate {
  grants: string[];
  denies: string[];
}

export interface StaffDetail extends StaffMember {
  usage: StaffUsage[];
  can_delete: boolean;
}

/** Query of `GET {org}/staff`. `status` undefined means active and inactive. */
export interface StaffFilters {
  q?: string;
  status?: StaffStatus[];
  grade_id?: string;
  approver_id?: string;
  role_id?: string;
  has_login?: boolean;
  selectable?: boolean;
  sort?: StaffSort;
  order?: SortOrder;
}

/** Body of `POST {org}/staff`: a staff member without a login. */
export interface StaffCreate {
  full_name: string;
  grade_id: string;
  start_date: IsoDate;
  code?: string;
  email?: string;
  approver_id?: string;
  job_title?: string;
  initials?: string;
  working_minutes_per_day?: number;
  working_days?: number[];
  chargeable_target_bp?: BasisPoints;
  leaving_date?: IsoDate;
  role_id?: string;
  /** Pence per hour: also sets the person's own cost rate (needs `rate.manage`). */
  cost_rate?: Pence;
  /** Pence per hour: also sets the person's own charge-out rate (needs `rate.manage`). */
  charge_rate?: Pence;
  /** When the rates start; the start date when absent. */
  rate_effective_from?: IsoDate;
}

/** Body of `PATCH {org}/staff/{id}`: only what changes; null clears the nullable fields. */
export interface StaffUpdate {
  full_name?: string;
  code?: string;
  email?: string | null;
  grade_id?: string;
  approver_id?: string | null;
  job_title?: string | null;
  initials?: string | null;
  working_minutes_per_day?: number;
  working_days?: number[];
  chargeable_target_bp?: BasisPoints;
  start_date?: IsoDate | null;
  leaving_date?: IsoDate | null;
}

/** Body of `POST {org}/staff/bulk`: one action on up to 200 people, all or nothing. */
export interface StaffBulkRequest {
  staff_ids: string[];
  action: 'set_grade' | 'set_approver' | 'clear_approver' | 'deactivate' | 'reactivate' | 'delete';
  /** A grade id, an approver's staff id, or for `deactivate` `inactive` (default) or `left`. */
  value?: string;
  /** For `deactivate` with `left`: the leaving date (default today). */
  leaving_date?: IsoDate;
}

export interface StaffDeactivate {
  status: 'inactive' | 'left';
  leaving_date?: IsoDate;
}

export interface StaffInvite {
  email?: string;
  role_id?: string;
}

export interface StaffInvited {
  staff: StaffDetail;
  invited_at: IsoDateTime;
  expires_at: IsoDateTime;
  resent: boolean;
}

export type LinkLoginMode = 'create_account' | 'existing_user';

export interface StaffLinkLogin {
  mode: LinkLoginMode;
  email?: string;
  role_id?: string;
  send_email?: boolean;
}

/** Response of `link-login`. The temporary password is in this response only. */
export interface StaffLinked {
  staff: StaffDetail;
  temporary_password: string | null;
  email_sent: boolean;
  /** `existing_user`: the id the merged record had (the staff id is now the login member's). */
  merged_from: string | null;
}

/** Body of `PATCH {org}/members/{user_id}` (V1): the role of a person with a login. */
export interface MemberRoleChange {
  role_id: string;
}

/* ----------------------------------- Grades ---------------------------------- */

export type GradeSort = 'sort_order' | 'name' | 'code';

export interface Grade {
  id: string;
  code: string;
  name: string;
  description: string | null;
  /** Null when the grade sets none, and without `rate.read`. */
  default_cost_rate: Pence | null;
  default_charge_rate: Pence | null;
  default_chargeable_target_bp: BasisPoints | null;
  is_active: boolean;
  sort_order: number;
  /** Staff who have not left holding the grade. */
  staff_count: number;
  /** False once staff or rates refer to the grade: DELETE then deactivates it. */
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface GradeFilters {
  q?: string;
  is_active?: boolean;
  sort?: GradeSort;
  order?: SortOrder;
}

export interface GradeCreate {
  code: string;
  name: string;
  description?: string;
  default_cost_rate?: Pence;
  default_charge_rate?: Pence;
  default_chargeable_target_bp?: BasisPoints;
  sort_order?: number;
  is_active?: boolean;
}

/** Null clears `description` and the three defaults. */
export interface GradeUpdate {
  code?: string;
  name?: string;
  description?: string | null;
  default_cost_rate?: Pence | null;
  default_charge_rate?: Pence | null;
  default_chargeable_target_bp?: BasisPoints | null;
  sort_order?: number;
  is_active?: boolean;
}

/* ----------------------------------- Rates ----------------------------------- */

export type RateKind = 'charge' | 'cost';
export type RateLevel =
  | 'client_service_staff'
  | 'client_service'
  | 'client_staff'
  | 'client'
  | 'service_grade'
  | 'staff'
  | 'grade';
export type RuleStatus = 'current' | 'future' | 'ended';
export type RuleSort = 'effective_from' | 'rate' | 'created_at';

/** `RateRuleRead`: a dated rate for a scope. `rate` is null for a cost rule without `rate.read`. */
export interface RateRule {
  id: string;
  kind: RateKind;
  level: RateLevel;
  level_label: string;
  /** Position in the charge-out ladder (1 = most specific); the job rate is 4. */
  precedence: number;
  client: RefRead | null;
  service: RefRead | null;
  staff: StaffRef | null;
  grade: RefRead | null;
  rate: Pence | null;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
  status: RuleStatus;
  /** True once time falls inside the rule's scope and period: end-date it, do not delete it. */
  is_used: boolean;
  can_delete: boolean;
  created_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface RateRuleFilters {
  kind?: RateKind;
  level?: RateLevel[];
  client_id?: string;
  service_id?: string;
  user_id?: string;
  grade_id?: string;
  on_date?: IsoDate;
  status?: RuleStatus;
  q?: string;
  sort?: RuleSort;
  order?: SortOrder;
}

/** Which of the four are sent decides the level. */
export interface RateRuleCreate {
  kind: RateKind;
  client_id?: string;
  service_id?: string;
  user_id?: string;
  grade_id?: string;
  rate: Pence;
  effective_from: IsoDate;
  effective_to?: IsoDate | null;
  close_previous?: boolean;
}

/** Kind and scope never change; null `effective_to` makes the rule open-ended again. */
export interface RateRuleUpdate {
  rate?: Pence;
  effective_from?: IsoDate;
  effective_to?: IsoDate | null;
}

/** One rule in the way of a new one (`details.conflicts` of 409 `RATE_OVERLAP`). */
export interface RateConflict {
  id: string;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
}

export interface LadderRule {
  id: string;
  effective_from: IsoDate;
  effective_to: IsoDate | null;
}

/** One level of the ladder, with whether it exists for this query and whether it won. */
export interface LadderStep {
  /** 1–7 for the charge-out levels; null for the practice default and the cost steps. */
  level: number | null;
  source: string;
  label: string;
  /** False when the query lacks what the level needs (see `reason`). */
  applicable: boolean;
  reason: string | null;
  exists: boolean;
  rate: Pence | null;
  /** rule | job | grade_default | practice_default | none */
  origin: string | null;
  rule: LadderRule | null;
  selected: boolean;
}

/** `GET {org}/rates/resolve`: the rate a person would get, and why. */
export interface RateResolution {
  on_date: IsoDate;
  staff: StaffRef;
  client: RefRead | null;
  service: RefRead | null;
  job_id: string | null;
  grade: RefRead | null;
  charge_rate: Pence;
  charge_source: string;
  charge_rule_id: string | null;
  cost_rate: Pence | null;
  cost_source: string;
  cost_rule_id: string | null;
  charge_ladder: LadderStep[];
  cost_ladder: LadderStep[];
}

export interface ResolveQuery {
  user_id: string;
  date?: IsoDate;
  client_id?: string;
  job_id?: string;
  service_id?: string;
}

/* ------------------------------- Rate history -------------------------------- */

export type ChangeAction = 'created' | 'updated' | 'end_dated' | 'deleted';

/** The rate and period of a rule before or after a change (a grade default has `default`). */
export interface RateSnapshot {
  rate?: Pence | null;
  effective_from?: IsoDate | null;
  effective_to?: IsoDate | null;
  default?: boolean;
}

export interface RateChange {
  id: string;
  at: IsoDateTime;
  action: ChangeAction;
  kind: RateKind;
  level: string;
  level_label: string;
  rule_id: string | null;
  client: RefRead | null;
  service: RefRead | null;
  staff: StaffRef | null;
  grade: RefRead | null;
  old: RateSnapshot | null;
  new: RateSnapshot | null;
  actor_id: string | null;
  actor_name: string | null;
  /** rates | staff_rates | client_rates | grade_default */
  source: string;
}

export interface RateHistoryFilters {
  user_id?: string;
  grade_id?: string;
  client_id?: string;
  service_id?: string;
  kind?: RateKind;
  action?: ChangeAction;
  date_from?: IsoDate;
  date_to?: IsoDate;
}

/* -------------------------------- Re-rating ---------------------------------- */

export interface RerateScope {
  client_ids: string[];
  job_ids: string[];
  user_ids: string[];
  date_from: IsoDate | null;
  date_to: IsoDate | null;
}

export interface RerateRequest {
  scope: RerateScope;
  item_limit?: number;
  include_unchanged?: boolean;
}

export interface RerateApply {
  scope: RerateScope;
  preview_token: string;
  note?: string;
}

/** Cost values are null without `rate.read`. */
export interface RerateValues {
  charge_rate: Pence;
  charge_value: Pence;
  cost_rate: Pence | null;
  cost_value: Pence | null;
  source: string | null;
}

export interface RerateEntry {
  entry_id: string;
  entry_date: IsoDate;
  minutes: number;
  staff: StaffRef | null;
  client: RefRead | null;
  job: RefRead | null;
  /** change | unchanged | skipped */
  outcome: string;
  skip_reason: string | null;
  old: RerateValues;
  new: RerateValues;
}

export interface RerateTotals {
  entries_examined: number;
  entries_to_change: number;
  entries_unchanged: number;
  entries_skipped: number;
  charge_value_before: Pence;
  charge_value_after: Pence;
  charge_value_delta: Pence;
  cost_value_before: Pence | null;
  cost_value_after: Pence | null;
  cost_value_delta: Pence | null;
}

/** Entries in scope that are left alone, by reason. */
export interface RerateSkipped {
  billed: number;
  in_draft: number;
  written_off: number;
  period_locked: number;
}

export interface ReratePreview {
  preview_token: string;
  expires_at: IsoDateTime;
  scope: RerateScope;
  totals: RerateTotals;
  skipped: RerateSkipped;
  items: RerateEntry[];
  items_truncated: boolean;
}

/** One re-rating run: a preview-and-apply, or a V1 `revalue` call. */
export interface Rerun {
  id: string;
  created_at: IsoDateTime;
  /** rerate | revalue */
  source: string;
  scope: Record<string, unknown>;
  entries_examined: number;
  entries_changed: number;
  entries_skipped: number;
  charge_value_before: Pence;
  charge_value_after: Pence;
  charge_value_delta: Pence;
  cost_value_before: Pence | null;
  cost_value_after: Pence | null;
  cost_value_delta: Pence | null;
  requested_by: string | null;
  requested_by_name: string | null;
  note: string | null;
}

export interface RerunItem {
  id: string;
  entry_id: string;
  entry_date: IsoDate;
  minutes: number;
  staff: StaffRef | null;
  client: RefRead | null;
  job: RefRead | null;
  /** changed | skipped */
  outcome: string;
  skip_reason: string | null;
  old: RerateValues;
  new: RerateValues;
}

export type RerunItemOutcome = 'changed' | 'skipped';

/* ------------------------- Services and activity types ------------------------ */

export type BillingBasis = 'hourly' | 'fixed';
export type EntityStatus = 'active' | 'inactive';

export interface Service {
  id: string;
  code: string;
  name: string;
  description: string | null;
  billing_basis: string;
  default_fee: Pence | null;
  default_billable: boolean;
  vat_rate_id: string | null;
  invoice_description: string | null;
  is_active: boolean;
  status: EntityStatus;
  sort_order: number;
  /** The activity types time on this service's jobs is limited to; empty means every type. */
  activity_code_ids: string[];
  /** How many default tasks a new job of this service can start with. */
  task_template_count: number;
  is_used: boolean;
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ServiceCreate {
  code: string;
  name: string;
  description?: string;
  billing_basis?: BillingBasis;
  default_fee?: Pence;
  default_billable?: boolean;
  vat_rate_id?: string;
  invoice_description?: string;
  sort_order?: number;
  is_active?: boolean;
}

/** Null clears `description`, `default_fee`, `vat_rate_id` and `invoice_description`. */
export interface ServiceUpdate {
  code?: string;
  name?: string;
  description?: string | null;
  billing_basis?: BillingBasis;
  default_fee?: Pence | null;
  default_billable?: boolean;
  vat_rate_id?: string | null;
  invoice_description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface ActivityType {
  id: string;
  code: string;
  name: string;
  /** The default billable status of time recorded against the type. */
  is_chargeable: boolean;
  vat_rate_id: string | null;
  invoice_description: string | null;
  is_active: boolean;
  status: EntityStatus;
  is_used: boolean;
  can_delete: boolean;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ActivityTypeCreate {
  code: string;
  name: string;
  is_chargeable?: boolean;
  vat_rate_id?: string;
  invoice_description?: string;
  is_active?: boolean;
}

export interface ActivityTypeUpdate {
  code?: string;
  name?: string;
  is_chargeable?: boolean;
  vat_rate_id?: string | null;
  invoice_description?: string | null;
  is_active?: boolean;
}

/** One default task of a service (`GET {org}/services/{id}/task-templates`), in list order. */
export interface TaskTemplate {
  id: string;
  title: string;
  description: string | null;
  budget_minutes: number | null;
  /** Days after the job's start date the task is due; null for no due date. */
  due_offset_days: number | null;
  sort_order: number;
}

/** One entry of the list `PUT {org}/services/{id}/task-templates` replaces the templates with. */
export interface TaskTemplateInput {
  title: string;
  description?: string | null;
  budget_minutes?: number | null;
  due_offset_days?: number | null;
}

export interface ServiceActivityTypes {
  service_id: string;
  restricted: boolean;
  activity_codes: ActivityType[];
}

/** The VAT codes of the practice (`GET {org}/vat-rates`), for the VAT select of a form. */
export interface VatCode {
  id: string;
  name: string;
  code: string;
  rate_bp: BasisPoints;
  is_default: boolean;
  is_archived: boolean;
}

/* ----------------------------------- Lookups --------------------------------- */

/** A client in a picker (`GET {org}/clients`). */
export interface ClientOption {
  id: string;
  code: string;
  name: string;
}

/** A job in a picker (`GET {org}/jobs`). */
export interface JobOption {
  id: string;
  number: string;
  name: string;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

/** What a combobox shows and remembers about a chosen record. */
export interface PickerItem {
  id: string;
  label: string;
  /** A second line: a code, an email address. */
  detail?: string;
}
