/**
 * Shapes of the time endpoints (`app/schemas/{time,time_views,reports}.py`, documented in
 * `docs/modules/time.md` and `docs/modules/reports.md` of the API). Money is pence, durations
 * whole minutes, percentages basis points, dates `YYYY-MM-DD` in the practice's time zone and
 * timestamps UTC.
 */
import type { BasisPoints, IsoDate, IsoDateTime, Minutes, Pence } from '@/types/api';

export type TimesheetStatus = 'open' | 'submitted' | 'approved' | 'rejected';
export type BillingStatus = 'unbilled' | 'in_draft' | 'billed' | 'written_off';

/* -------------------------------- Time entries ------------------------------- */

/** `TimeEntryRead`. Cost fields are null without `rate.read`, the note is hidden from others. */
export interface TimeEntry {
  id: string;
  user_id: string;
  timesheet_id: string;
  timesheet_status: TimesheetStatus;
  entry_date: IsoDate;
  minutes: Minutes;
  client_id: string | null;
  client_code: string | null;
  client_name: string | null;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  /** The service of the job: an entry has none of its own. */
  service_id: string | null;
  service_name: string | null;
  activity_code_id: string | null;
  activity_code: string | null;
  activity_name: string | null;
  description: string | null;
  internal_note: string | null;
  is_billable: boolean;
  /** Overtime: `charge_rate` and `cost_rate` already include the multiplier. Absent: not overtime. */
  is_overtime?: boolean;
  charge_rate: Pence;
  charge_value: Pence;
  cost_rate: Pence | null;
  cost_value: Pence | null;
  rate_source: string | null;
  billing_status: BillingStatus;
  /** The sheet is submitted or approved, or the entry is no longer unbilled. */
  is_locked: boolean;
  /**
   * The last day of the locked period the entry's date lies in (Settings > Period Lock): it cannot
   * be edited or deleted until the period is unlocked. Null or absent: the date is open.
   */
  period_locked_through?: IsoDate | null;
  created_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** Present once the API links time to a job task. */
  task_id?: string | null;
  task_name?: string | null;
}

/** Body of `POST /time-entries` (and one item of `/bulk`). */
export interface TimeEntryCreate {
  user_id?: string;
  entry_date: IsoDate;
  minutes: Minutes;
  client_id?: string | null;
  job_id?: string | null;
  activity_code_id?: string | null;
  description?: string | null;
  internal_note?: string | null;
  is_billable?: boolean;
  /** Needs overtime switched on for the practice. */
  is_overtime?: boolean;
}

/** Body of `PATCH /time-entries/{id}`: only what changes. */
export interface TimeEntryUpdate {
  entry_date?: IsoDate;
  minutes?: Minutes;
  client_id?: string | null;
  job_id?: string | null;
  activity_code_id?: string | null;
  description?: string | null;
  internal_note?: string | null;
  is_billable?: boolean | null;
  /** Needs overtime switched on for the practice. */
  is_overtime?: boolean;
}

/** Body of `POST /time-entries/{id}/correct`. */
export interface TimeCorrection {
  reason: string;
  date?: IsoDate;
  minutes?: Minutes;
  client_id?: string | null;
  job_id?: string | null;
  activity_code_id?: string | null;
  description?: string | null;
  internal_note?: string | null;
  billable?: boolean;
}

/** Query of `GET /time-entries` (`user_id` is `me`, an id or `all`). */
export interface TimeEntryFilters {
  user_id?: string;
  date_from?: IsoDate;
  date_to?: IsoDate;
  client_id?: string;
  job_id?: string;
  billable?: boolean;
  billing_status?: BillingStatus[];
  timesheet_status?: TimesheetStatus[];
}

/** One correction of an approved entry (`GET /time-entries/{id}/history`). */
export interface TimeEntryHistory {
  id: string;
  time_entry_id: string;
  user_id: string;
  user_name: string | null;
  corrected_by: string;
  corrected_by_name: string | null;
  reason: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  /** `{field: [before, after]}` of every field that changed. */
  changes: Record<string, [unknown, unknown]>;
  created_at: IsoDateTime;
}

/* ------------------------------ Week, day, calendar --------------------------- */

export interface WeekGridRow {
  client_id: string | null;
  client_code: string | null;
  client_name: string | null;
  job_id: string | null;
  job_number: string | null;
  job_name: string | null;
  activity_code_id: string | null;
  activity_code: string | null;
  activity_name: string | null;
  is_billable: boolean;
  /** Minutes per day, in the order of `days`. */
  minutes: Minutes[];
  total_minutes: Minutes;
  entry_ids: string[];
}

export interface WeekTargets {
  /** Target minutes of every day of the week; 0 on a day off. */
  daily_minutes: Record<IsoDate, Minutes>;
  weekly_minutes: Minutes;
}

/** `GET /time-entries/week`. */
export interface WeekGrid {
  user_id: string;
  week_start: IsoDate;
  week_end: IsoDate;
  days: IsoDate[];
  timesheet_id: string | null;
  timesheet_status: TimesheetStatus;
  rows: WeekGridRow[];
  day_totals: Minutes[];
  total_minutes: Minutes;
  chargeable_minutes: Minutes;
  non_chargeable_minutes: Minutes;
  today: IsoDate | null;
  targets: WeekTargets | null;
  working_days: IsoDate[];
  missing_days: IsoDate[];
  /** Logged minus target, per day. */
  day_variance: Minutes[];
}

/** `GET /time-entries/day`. */
export interface TimeDay {
  user_id: string;
  date: IsoDate;
  week_start: IsoDate;
  timesheet_id: string | null;
  timesheet_status: TimesheetStatus;
  is_working_day: boolean;
  entries: TimeEntry[];
  total_minutes: Minutes;
  billable_minutes: Minutes;
  non_billable_minutes: Minutes;
  target_minutes: Minutes;
  remaining_minutes: Minutes;
  variance_minutes: Minutes;
  timer: Timer | null;
}

export interface CalendarDay {
  date: IsoDate;
  week_start: IsoDate;
  entry_count: number;
  total_minutes: Minutes;
  billable_minutes: Minutes;
  target_minutes: Minutes;
  is_working_day: boolean;
  timesheet_status: TimesheetStatus;
}

/** `GET /time-entries/calendar` (at most 62 days). */
export interface TimeCalendar {
  user_id: string;
  date_from: IsoDate;
  date_to: IsoDate;
  days: CalendarDay[];
  total_minutes: Minutes;
  billable_minutes: Minutes;
  target_minutes: Minutes;
}

/* ----------------------------------- Copying ---------------------------------- */

export interface CopyWeekRequest {
  from_week_start: IsoDate;
  to_week_start: IsoDate;
  user_id?: string;
  entry_ids?: string[];
  include_notes?: boolean;
}

export interface CopySkipped {
  source_entry_id: string;
  /** The code the same entry would get when created by hand, e.g. `JOB_CLOSED`. */
  code: string;
  message: string;
}

export interface CopyWeekResult {
  from_week_start: IsoDate;
  to_week_start: IsoDate;
  created: TimeEntry[];
  skipped: CopySkipped[];
}

export interface CopyEntryRequest {
  date: IsoDate;
  include_notes?: boolean;
}

/* ------------------------------------ Timer ----------------------------------- */

export interface Timer {
  id: string;
  user_id: string;
  client_id: string | null;
  job_id: string | null;
  activity_code_id: string | null;
  description: string | null;
  is_billable: boolean;
  is_running: boolean;
  started_at: IsoDateTime | null;
  accumulated_seconds: number;
  elapsed_seconds: number;
  started_on: IsoDate;
  created_at: IsoDateTime;
}

export interface TimerStart {
  client_id?: string | null;
  job_id?: string | null;
  activity_code_id?: string | null;
  description?: string | null;
  is_billable?: boolean;
  replace?: boolean;
}

/* ---------------------------------- Timesheets -------------------------------- */

/** `TimesheetRead`: one row of the lists and of the approvals queue. */
export interface Timesheet {
  id: string;
  user_id: string;
  user_name: string | null;
  week_start: IsoDate;
  week_end: IsoDate;
  status: TimesheetStatus;
  submitted_at: IsoDateTime | null;
  decided_by: string | null;
  decided_at: IsoDateTime | null;
  decision_note: string | null;
  entry_count: number;
  total_minutes: Minutes;
  billable_minutes: Minutes;
  non_billable_minutes: Minutes;
  billable_value: Pence;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface DayTotal {
  day: IsoDate;
  minutes: Minutes;
}

/** `TimesheetDetail`: the sheet with its entries. */
export interface TimesheetDetail extends Timesheet {
  entries: TimeEntry[];
  day_totals: DayTotal[];
}

export interface TimesheetFilters {
  /** `me`, a user id or `all`. */
  user_id?: string;
  from?: IsoDate;
  to?: IsoDate;
  status?: TimesheetStatus[];
}

export type MissingStatus = 'none' | 'open' | 'rejected';

/** `GET /timesheets/missing`. */
export interface MissingTimesheet {
  user_id: string;
  name: string;
  week_start: IsoDate;
  status: MissingStatus;
  timesheet_id: string | null;
  logged_minutes: Minutes;
  expected_minutes: Minutes;
  missing_days: IsoDate[];
  last_reminded_at: IsoDateTime | null;
  /** False: nobody can sign in as them, so they cannot be reminded. */
  has_login: boolean;
}

export interface MissingFilters {
  week_start?: IsoDate;
  user_id?: string;
  manager_user_id?: string;
}

/** `POST /timesheets/reminders/run`. */
export interface RemindersResult {
  week_start: IsoDate;
  missing: number;
  reminded: number;
  already_reminded: number;
  unreachable: number;
  sheets_waiting: number;
  approvers_reminded: number;
  approvers_already_reminded: number;
  disabled: string[];
}

/* ------------------------------------ Lookups --------------------------------- */

/** The people the Team page lists: the staff list's subset the time screens read. */
export interface StaffPerson {
  id: string;
  code: string;
  full_name: string;
  status: 'active' | 'inactive' | 'left';
  has_login: boolean;
  approver: { id: string; full_name: string } | null;
  weekly_capacity_minutes: Minutes;
  working_days: number[];
  start_date: IsoDate | null;
  leaving_date: IsoDate | null;
}

export type JobStatus =
  'planned' | 'in_progress' | 'on_hold' | 'completed' | 'closed' | 'cancelled';

/** What a timesheet row needs of its job: whether it still takes time and its service. */
export interface JobRef {
  id: string;
  number: string;
  name: string;
  status: JobStatus;
  billing_basis: 'hourly' | 'fixed' | 'non_billable';
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
}

export interface ClientRef {
  id: string;
  code: string;
  name: string;
}

/* ------------------------------------ Reports --------------------------------- */

export type TimeGroupBy =
  'person' | 'client' | 'job' | 'activity' | 'service' | 'day' | 'week' | 'month';

/** The files a report downloads as (`format=` of `docs/modules/reports.md`). */
export type ExportFormat = 'csv' | 'xlsx' | 'pdf';

export interface TimeSummaryFilters {
  date_from?: IsoDate;
  date_to?: IsoDate;
  group_by: TimeGroupBy;
  client_id?: string;
  job_id?: string;
  user_id?: string;
  service_id?: string;
  activity_code_id?: string;
}

export interface TimeAmounts {
  entry_count: number;
  total_minutes: Minutes;
  chargeable_minutes: Minutes;
  non_chargeable_minutes: Minutes;
  chargeable_bp: BasisPoints | null;
  charge_value: Pence;
  /** Null without `rate.read`. */
  cost_value: Pence | null;
}

export interface TimeSummaryRow extends TimeAmounts {
  /** An id, or the ISO date that starts a day, week or month; null for time without one. */
  key: string | null;
  code: string | null;
  name: string;
  client_name: string | null;
}

export interface ReportFilters {
  date_from: IsoDate | null;
  date_to: IsoDate | null;
  group_by: string | null;
}

export interface TimeSummary {
  rows: TimeSummaryRow[];
  totals: TimeAmounts;
  filters: ReportFilters;
}

export interface UtilisationFilters {
  date_from?: IsoDate;
  date_to?: IsoDate;
  user_id?: string;
}

export interface UtilisationRow {
  user_id: string;
  full_name: string;
  initials: string | null;
  status: string;
  capacity_minutes: Minutes;
  total_minutes: Minutes;
  chargeable_minutes: Minutes;
  non_chargeable_minutes: Minutes;
  utilisation_bp: BasisPoints | null;
  target_bp: BasisPoints | null;
  variance_bp: BasisPoints | null;
}

export interface UtilisationTotals extends Omit<
  UtilisationRow,
  'user_id' | 'full_name' | 'initials' | 'status'
> {
  working_days: number;
}

export interface Utilisation {
  rows: UtilisationRow[];
  totals: UtilisationTotals;
}
