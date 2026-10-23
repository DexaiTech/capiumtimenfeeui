import type { IsoDate, IsoDateTime, Minutes, Pence } from '@/types/api';

/** Shapes of the job endpoints (`/jobs`, `/jobs/{id}/tasks`, `/tasks`, `/jobs/budgets`, `/jobs/calendar`). */

export const JOB_STATUSES = [
  'planned',
  'in_progress',
  'on_hold',
  'completed',
  'closed',
  'cancelled',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const BILLING_BASES = ['hourly', 'fixed', 'non_billable'] as const;
export type BillingBasis = (typeof BILLING_BASES)[number];

export const TASK_STATUSES = ['not_started', 'in_progress', 'on_hold', 'completed'] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type SortOrder = 'asc' | 'desc';

export interface TaskCounts {
  total: number;
  completed: number;
}

/** `JobRead`: a job with its assignees and actuals (money in pence, time in minutes). */
export interface Job {
  id: string;
  number: string;
  name: string;
  description: string | null;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
  status: JobStatus;
  billing_basis: BillingBasis;
  fixed_fee: Pence | null;
  hourly_rate: Pence | null;
  budget_minutes: Minutes | null;
  budget_fee: Pence | null;
  period_start: IsoDate | null;
  period_end: IsoDate | null;
  start_date: IsoDate | null;
  due_date: IsoDate | null;
  partner_user_id: string | null;
  manager_user_id: string | null;
  assignee_user_ids: string[];
  completed_at: IsoDateTime | null;
  closed_at: IsoDateTime | null;
  /** The practice management job this job is linked to; its own fields are managed there. */
  pm_job_id: string | null;
  pm_linked_at: IsoDateTime | null;
  task_counts: TaskCounts;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  logged_minutes: Minutes;
  billable_minutes: Minutes;
  time_value: Pence;
  wip_value: Pence;
  billed_value: Pence;
  written_off_value: Pence;
  budget_minutes_used_bp: number | null;
  budget_fee_used_bp: number | null;
}

/** `JobCreate`: what `POST /jobs` takes. */
export interface JobInput {
  client_id: string;
  name: string;
  description?: string | null;
  service_id?: string | null;
  billing_basis?: BillingBasis;
  fixed_fee?: Pence | null;
  hourly_rate?: Pence | null;
  budget_minutes?: Minutes | null;
  budget_fee?: Pence | null;
  period_start?: IsoDate | null;
  period_end?: IsoDate | null;
  start_date?: IsoDate | null;
  due_date?: IsoDate | null;
  partner_user_id?: string | null;
  manager_user_id?: string | null;
  status?: 'planned' | 'in_progress';
  assignee_user_ids?: string[];
}

/** `JobUpdate`: every field optional; the client and the status have no place here. */
export type JobUpdate = Partial<Omit<JobInput, 'client_id' | 'status' | 'assignee_user_ids'>>;

/**
 * `POST /jobs/bulk`: one action on 1-200 jobs, all or nothing. `set_manager` and `set_due_date`
 * take null to clear; `delete` takes no value.
 */
export type JobBulkRequest = { job_ids: string[] } & (
  | { action: 'set_status'; value: JobStatus }
  | { action: 'set_manager'; value: string | null }
  | { action: 'set_due_date'; value: IsoDate | null }
  | { action: 'delete' }
);

/** `JobCopy`: what a copy changes; a field left out is copied from the source job. */
export interface JobCopyInput {
  name?: string;
  client_id?: string;
  service_id?: string | null;
  start_date?: IsoDate | null;
  due_date?: IsoDate | null;
  copy_tasks?: boolean;
  copy_assignees?: boolean;
}

/* ---------------------------------- Tasks ---------------------------------- */

export interface Assignee {
  user_id: string;
  full_name: string | null;
}

export interface Task {
  id: string;
  job_id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  budget_minutes: Minutes | null;
  logged_minutes: Minutes;
  budget_used_bp: number | null;
  due_date: IsoDate | null;
  is_overdue: boolean;
  sort_order: number;
  completed_at: IsoDateTime | null;
  pm_task_id: string | null;
  assignees: Assignee[];
  created_by: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A task with the job and client it belongs to (`GET /tasks`). */
export interface TaskListItem extends Task {
  job_number: string;
  job_name: string;
  job_status: JobStatus;
  client_id: string;
  client_name: string;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  status?: TaskStatus;
  budget_minutes?: Minutes | null;
  due_date?: IsoDate | null;
  assignee_user_ids?: string[];
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  budget_minutes?: Minutes | null;
  due_date?: IsoDate | null;
}

/* --------------------------------- Budgets --------------------------------- */

export type Rag = 'green' | 'amber' | 'red';

export interface BudgetAlert {
  kind: 'minutes' | 'fee';
  threshold: 80 | 100;
  triggered_at: IsoDateTime;
  usage_bp: number;
}

/** Budget against actual; cost and margin are null without `rate.read`. */
export interface BudgetFigures {
  budget_minutes: Minutes | null;
  logged_minutes: Minutes;
  billable_minutes: Minutes;
  budget_minutes_used_bp: number | null;
  budget_fee: Pence | null;
  time_value: Pence;
  wip_value: Pence;
  budget_fee_used_bp: number | null;
  /** The worse of the hours and the fee usage. */
  used_bp: number | null;
  rag: Rag | null;
  cost_value: Pence | null;
  margin_value: Pence | null;
  margin_bp: number | null;
}

export interface JobBudgetRow extends BudgetFigures {
  job_id: string;
  number: string;
  name: string;
  status: JobStatus;
  billing_basis: BillingBasis;
  client_id: string;
  client_code: string;
  client_name: string;
  service_id: string | null;
  service_name: string | null;
  manager_user_id: string | null;
  manager_name: string | null;
  partner_user_id: string | null;
  partner_name: string | null;
  start_date: IsoDate | null;
  due_date: IsoDate | null;
  alerts: BudgetAlert[];
}

/** Over every job the filters select, not only the page. */
export interface BudgetTotals {
  jobs: number;
  green: number;
  amber: number;
  red: number;
  budget_minutes: Minutes;
  logged_minutes: Minutes;
  budget_minutes_used_bp: number | null;
  budget_fee: Pence;
  time_value: Pence;
  wip_value: Pence;
  budget_fee_used_bp: number | null;
  cost_value: Pence | null;
  margin_value: Pence | null;
  margin_bp: number | null;
}

export interface JobBudgetList {
  rows: JobBudgetRow[];
  totals: BudgetTotals;
}

export interface BudgetPersonRow {
  user_id: string;
  full_name: string;
  minutes: Minutes;
  billable_minutes: Minutes;
  value: Pence;
  cost_value: Pence | null;
}

export interface BudgetTaskRow {
  /** Null for time that is not linked to a task. */
  task_id: string | null;
  title: string | null;
  status: string | null;
  budget_minutes: Minutes | null;
  minutes: Minutes;
  used_bp: number | null;
  value: Pence;
  cost_value: Pence | null;
}

export interface JobBudgetDetail extends BudgetFigures {
  job_id: string;
  number: string;
  name: string;
  status: JobStatus;
  billing_basis: BillingBasis;
  client_id: string;
  client_name: string;
  due_date: IsoDate | null;
  billed_value: Pence;
  written_off_value: Pence;
  remaining_minutes: Minutes | null;
  remaining_fee: Pence | null;
  by_task: BudgetTaskRow[];
  by_person: BudgetPersonRow[];
  alerts: BudgetAlert[];
}

export interface BudgetEvaluation {
  job_id: string;
  used_bp: number | null;
  rag: Rag | null;
  triggered: Array<{ kind: 'minutes' | 'fee'; threshold: 80 | 100; usage_bp: number | null }>;
  cleared: Array<{ kind: 'minutes' | 'fee'; threshold: 80 | 100; usage_bp: number | null }>;
  alerts: BudgetAlert[];
}

/* --------------------------------- Calendar --------------------------------- */

export type CalendarStatus = JobStatus | TaskStatus;

export interface CalendarEvent {
  type: 'job' | 'task';
  id: string;
  job_id: string;
  job_number: string;
  /** The job's name, or the task's title. */
  title: string;
  client_id: string;
  client_name: string;
  /** First day to draw. */
  start: IsoDate;
  /** Last day to draw; null for an open job with a start date and no due date (it runs on). */
  end: IsoDate | null;
  status: CalendarStatus;
  due: IsoDate | null;
  assignees: Assignee[];
  budget_used_bp: number | null;
}

export interface JobCalendar {
  from: IsoDate;
  to: IsoDate;
  events: CalendarEvent[];
}

/* ---------------------------------- People ---------------------------------- */

/** What the jobs screens need of `MemberRead` (`GET /members`). */
export interface Member {
  user_id: string;
  full_name: string;
  email: string;
  initials: string | null;
  status: string;
}

/* ---------------------------------- Filters ---------------------------------- */

export const JOB_SORTS = [
  'due_date',
  '-due_date',
  'number',
  '-number',
  'created_at',
  '-created_at',
] as const;
export type JobSort = (typeof JOB_SORTS)[number];

/** The list filters, as the API's query parameters understand them. */
export interface JobFilters {
  status?: JobStatus[];
  client_id?: string;
  /** A user id or `me`. */
  manager_user_id?: string;
  partner_user_id?: string;
  assignee?: string;
  service_id?: string;
  due_from?: IsoDate;
  due_to?: IsoDate;
  q?: string;
  sort?: JobSort;
}

export const TASK_SORTS = [
  'due_date',
  '-due_date',
  'title',
  '-title',
  'job',
  '-job',
  'status',
  '-status',
] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

export interface TaskFilters {
  assignee_user_id?: string;
  status?: TaskStatus[];
  job_id?: string;
  client_id?: string;
  due_from?: IsoDate;
  due_to?: IsoDate;
  q?: string;
  sort?: TaskSort;
}

export const BUDGET_SORTS = [
  'used',
  'number',
  'name',
  'client',
  'due_date',
  'logged_minutes',
  'time_value',
] as const;
export type BudgetSort = (typeof BUDGET_SORTS)[number];

export interface BudgetFilters {
  status?: JobStatus[];
  client_id?: string;
  manager_user_id?: string;
  partner_user_id?: string;
  service_id?: string;
  used_from_bp?: number;
  used_to_bp?: number;
  q?: string;
  sort?: BudgetSort;
  order?: SortOrder;
}

export interface CalendarFilters {
  from: IsoDate;
  to: IsoDate;
  client_id?: string;
  manager_user_id?: string;
  assignee_user_id?: string;
  status?: CalendarStatus[];
}
