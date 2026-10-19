import type { BadgeTone } from '@/components/ui';

import type { BillingBasis, JobSort, JobStatus, Rag, TaskStatus } from './types';

export interface StatusMeta {
  label: string;
  tone: BadgeTone;
}

/** Text and colour of a job status: never colour alone, the label is always shown. */
export const JOB_STATUS_META: Record<JobStatus, StatusMeta> = {
  planned: { label: 'Not started', tone: 'grey' },
  in_progress: { label: 'In progress', tone: 'blue' },
  on_hold: { label: 'On hold', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  closed: { label: 'Closed', tone: 'violet' },
  cancelled: { label: 'Cancelled', tone: 'red' },
};

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta> = {
  not_started: { label: 'Not started', tone: 'grey' },
  in_progress: { label: 'In progress', tone: 'blue' },
  on_hold: { label: 'On hold', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
};

export const BILLING_BASIS_LABEL: Record<BillingBasis, string> = {
  hourly: 'Hourly',
  fixed: 'Fixed fee',
  non_billable: 'Non-billable',
};

export const RAG_META: Record<Rag, StatusMeta> = {
  green: { label: 'On budget', tone: 'green' },
  amber: { label: 'Nearing budget', tone: 'amber' },
  red: { label: 'Over budget', tone: 'red' },
};

export interface JobTransition {
  to: JobStatus;
  label: string;
  danger?: boolean;
}

/** What each status may move to (`POST /jobs/{id}/status`); cancelled is final. */
export const JOB_TRANSITIONS: Record<JobStatus, ReadonlyArray<JobTransition>> = {
  planned: [
    { to: 'in_progress', label: 'Start work' },
    { to: 'on_hold', label: 'Put on hold' },
    { to: 'closed', label: 'Close' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  in_progress: [
    { to: 'completed', label: 'Mark completed' },
    { to: 'on_hold', label: 'Put on hold' },
    { to: 'closed', label: 'Close' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  on_hold: [
    { to: 'in_progress', label: 'Resume' },
    { to: 'closed', label: 'Close' },
    { to: 'cancelled', label: 'Cancel', danger: true },
  ],
  completed: [
    { to: 'in_progress', label: 'Reopen' },
    { to: 'closed', label: 'Close' },
  ],
  closed: [{ to: 'in_progress', label: 'Reopen' }],
  cancelled: [],
};

/** Open jobs take time; completed, closed and cancelled ones do not (409 `JOB_CLOSED`). */
export const OPEN_JOB_STATUSES: ReadonlyArray<JobStatus> = ['planned', 'in_progress', 'on_hold'];

export const isOpenJob = (status: JobStatus) => OPEN_JOB_STATUSES.includes(status);

/** A closed or cancelled job's tasks cannot be changed until it is reopened. */
export const jobLocksTasks = (status: JobStatus) => status === 'closed' || status === 'cancelled';

/** The sort of the job list: the column it belongs to and which way it starts. */
export const JOB_SORT_LABEL: Record<JobSort, string> = {
  due_date: 'Due date',
  '-due_date': 'Due date (latest first)',
  number: 'Number',
  '-number': 'Number (newest first)',
  created_at: 'Created (oldest first)',
  '-created_at': 'Created (newest first)',
};

/** `docs/modules/time.md` and the job schemas: field limits. */
export const LIMITS = {
  jobName: 200,
  jobDescription: 5000,
  taskTitle: 200,
  taskDescription: 2000,
} as const;

/** A job holds at most this many tasks (409 `TASK_LIMIT_REACHED`). */
export const MAX_TASKS_PER_JOB = 500;

/** Budget thresholds in basis points: amber from 80%, red from 100%. */
export const AMBER_BP = 8000;
export const RED_BP = 10000;
