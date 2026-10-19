/**
 * The shapes of the dashboard endpoints (`docs/modules/dashboard.md` of the API). Money is pence,
 * durations whole minutes, dates `YYYY-MM-DD` in the practice time zone, timestamps UTC.
 */

export type DashboardPeriod = 'this_week' | 'this_month' | 'ytd';

/** What every widget answers: whether the caller may see it, and when it was worked out. */
export interface WidgetData {
  /** False without the permissions behind the widget: everything else is then empty. */
  visible: boolean;
  as_at: string;
  generated_at: string;
}

/* ---------------------------------- Cards ---------------------------------- */

export type CardKey =
  | 'my_hours'
  | 'missing_timesheets'
  | 'pending_approvals'
  | 'unbilled_wip'
  | 'billed'
  | 'overdue_debtors';

export type CardUnit = 'minutes' | 'count' | 'money';

export interface CardComparison {
  /** `previous_period`: the same days a period earlier; `period_start`: the day before it began. */
  basis: 'previous_period' | 'period_start';
  previous: number;
  change: number;
  /** Basis points of `previous` (1000 = +10%); null when `previous` is 0. */
  change_bp: number | null;
}

export interface CardFigure {
  key: 'target' | 'people' | 'over_90_days' | 'total_outstanding';
  value: number;
  unit: CardUnit;
}

export interface DashboardCard {
  key: CardKey;
  title: string;
  visible: boolean;
  unit: CardUnit;
  value: number | null;
  comparison: CardComparison | null;
  secondary: CardFigure | null;
  /** A path inside the practice (below `/{slug}`). */
  link: string;
}

export interface DashboardCards {
  period: DashboardPeriod;
  date_from: string;
  date_to: string;
  previous_from: string;
  previous_to: string;
  as_at: string;
  generated_at: string;
  cards: DashboardCard[];
}

/* -------------------------------- My actions -------------------------------- */

export type ActionPriority = 'high' | 'medium' | 'low';

export type ActionKind =
  | 'timesheet_returned'
  | 'expense_returned'
  | 'task_overdue'
  | 'job_overdue'
  | 'budget_exceeded'
  | 'timesheet_to_submit'
  | 'timesheet_missing'
  | 'timesheet_approvals'
  | 'expense_approvals'
  | 'invoice_approvals'
  | 'wip_adjustment_approvals'
  | 'budget_warning'
  | 'job_due_soon'
  | 'draft_invoices';

export interface MyAction {
  id: string;
  kind: ActionKind;
  priority: ActionPriority;
  title: string;
  subject: string | null;
  context: string | null;
  date: string | null;
  /** Negative when overdue. */
  days_until_due: number | null;
  count: number;
  amount: number | null;
  usage_bp: number | null;
  link: string;
}

export interface MyActions extends WidgetData {
  total: number;
  counts: Record<ActionPriority, number>;
  actions: MyAction[];
}

/* ------------------------------- My timesheet ------------------------------- */

export type TimesheetStatus = 'open' | 'submitted' | 'approved' | 'rejected';

export interface MyTimesheetDay {
  date: string;
  minutes: number;
  billable_minutes: number;
  target_minutes: number;
  is_working_day: boolean;
  is_missing: boolean;
}

export interface MyTimesheetEntry {
  id: string;
  entry_date: string;
  minutes: number;
  client_id: string | null;
  client_name: string | null;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  description: string | null;
  is_billable: boolean;
  billing_status: string;
}

export interface DashboardTimer {
  is_running: boolean;
  started_at: string | null;
  accumulated_seconds: number;
  elapsed_seconds: number;
  client_id: string | null;
  client_name: string | null;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  description: string | null;
  is_billable: boolean;
}

export interface MyTimesheet extends WidgetData {
  week_start: string;
  week_end: string;
  timesheet_id: string | null;
  timesheet_status: TimesheetStatus;
  decision_note: string | null;
  total_minutes: number;
  chargeable_minutes: number;
  non_chargeable_minutes: number;
  target_minutes: number;
  target_to_date_minutes: number;
  today_minutes: number;
  today_target_minutes: number;
  utilisation_bp: number | null;
  chargeable_target_bp: number;
  days: MyTimesheetDay[];
  missing_days: string[];
  entry_count: number;
  entries: MyTimesheetEntry[];
  timer: DashboardTimer | null;
}

/* ----------------------------- Pending approvals ---------------------------- */

export type ApprovalKind = 'timesheet' | 'expense' | 'invoice' | 'wip_adjustment';

export interface ApprovalKindSummary {
  kind: ApprovalKind;
  count: number;
  oldest_date: string | null;
  link: string;
}

export interface ApprovalItem {
  kind: ApprovalKind;
  id: string;
  title: string;
  subject: string | null;
  date: string;
  submitted_at: string | null;
  minutes: number | null;
  amount: number | null;
  link: string;
}

export interface PendingApprovals extends WidgetData {
  total: number;
  kinds: ApprovalKindSummary[];
  items: ApprovalItem[];
}

/* --------------------------- Missing timesheets ---------------------------- */

export interface MissingTimesheet {
  user_id: string;
  name: string;
  week_start: string;
  status: 'none' | 'open' | 'rejected';
  timesheet_id: string | null;
  logged_minutes: number;
  expected_minutes: number;
  missing_days: string[];
  last_reminded_at: string | null;
  has_login: boolean;
}

export interface MissingTimesheetsWidget extends WidgetData {
  scope: 'practice' | 'team' | null;
  week_start: string;
  week_end: string;
  last_completed_week_start: string;
  count: number;
  rows: MissingTimesheet[];
  can_remind: boolean;
}

export interface RemindersResult {
  week_start: string;
  missing: number;
  reminded: number;
  already_reminded: number;
  unreachable: number;
  sheets_waiting: number;
  approvers_reminded: number;
  approvers_already_reminded: number;
  disabled: string[];
}

/* ----------------------------- Top clients by WIP --------------------------- */

export interface WipClient {
  client_id: string;
  client_code: string;
  client_name: string;
  amount: number;
  time_value: number;
  disbursement_value: number;
  minutes: number;
  oldest_date: string | null;
  over_90_days: number;
  share_bp: number | null;
  previous_amount: number;
  change: number;
}

export interface TopClientsByWip extends WidgetData {
  period: DashboardPeriod;
  date_from: string;
  total: number;
  previous_total: number;
  client_count: number;
  items: WipClient[];
  others_amount: number;
}

/* ------------------------------- Billing trend ------------------------------ */

export interface BillingMonth {
  month: string;
  billed: number;
  invoice_count: number;
  credit_notes: number;
  credit_note_count: number;
  net_billed: number;
  receipts: number;
}

export interface BillingWindow {
  date_from: string;
  date_to: string;
  billed: number;
  credit_notes: number;
  net_billed: number;
  receipts: number;
}

export interface BillingTrend extends WidgetData {
  months: number;
  series: BillingMonth[];
  this_month: BillingWindow;
  last_month: BillingWindow;
  billed_comparison: CardComparison;
}

/* ------------------------------- Debtor ageing ------------------------------ */

export type BucketKey = 'current' | 'days_1_30' | 'days_31_60' | 'days_61_90' | 'days_90_plus';

export interface AgeingBucket {
  key: BucketKey;
  amount: number;
  invoice_count: number;
  share_bp: number | null;
}

export interface DebtorRow {
  client_id: string;
  client_code: string;
  client_name: string;
  invoice_count: number;
  total: number;
  overdue: number;
  oldest_due_date: string | null;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_90_plus: number;
}

export interface DebtorAgeing extends WidgetData {
  period: DashboardPeriod;
  date_from: string;
  total: number;
  overdue_total: number;
  previous_total: number;
  previous_overdue_total: number;
  invoice_count: number;
  debtor_count: number;
  buckets: AgeingBucket[];
  top_debtors: DebtorRow[];
}
