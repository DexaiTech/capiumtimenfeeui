import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type {
  BudgetEvaluation,
  BudgetFilters,
  CalendarFilters,
  Job,
  JobBudgetDetail,
  JobBudgetList,
  JobCalendar,
  JobCopyInput,
  JobFilters,
  JobInput,
  JobStatus,
  JobUpdate,
  Member,
  Task,
  TaskFilters,
  TaskInput,
  TaskListItem,
  TaskStatus,
  TaskUpdate,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** A blank search is left out: the API ignores it anyway. */
const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/**
 * Typed wrappers over the job endpoints (`/jobs`, `/jobs/{id}/tasks`, `/tasks`, `/jobs/budgets`,
 * `/jobs/calendar`). Query values that are empty are left out by the client; a repeated value
 * (`status`) is sent once per item.
 */
export const jobsApi = {
  /* ---------------------------------- Jobs ---------------------------------- */
  listJobs: (organizationId: string, filters: JobFilters, page: PageRequest = {}) =>
    api.list<Job>(`${org(organizationId)}/jobs`, {
      query: {
        status: filters.status,
        client_id: filters.client_id,
        manager_user_id: filters.manager_user_id,
        partner_user_id: filters.partner_user_id,
        assignee: filters.assignee,
        service_id: filters.service_id,
        due_from: filters.due_from,
        due_to: filters.due_to,
        q: text(filters.q),
        sort: filters.sort,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  getJob: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<Job>(`${org(organizationId)}/jobs/${seg(jobId)}`, { signal }),
  createJob: (organizationId: string, body: JobInput) =>
    api.post<Job>(`${org(organizationId)}/jobs`, body),
  updateJob: (organizationId: string, jobId: string, body: JobUpdate) =>
    api.patch<Job>(`${org(organizationId)}/jobs/${seg(jobId)}`, body),
  deleteJob: (organizationId: string, jobId: string) =>
    api.delete<null>(`${org(organizationId)}/jobs/${seg(jobId)}`),
  changeStatus: (organizationId: string, jobId: string, status: JobStatus) =>
    api.post<Job>(`${org(organizationId)}/jobs/${seg(jobId)}/status`, { status }),
  copyJob: (organizationId: string, jobId: string, body: JobCopyInput) =>
    api.post<Job>(`${org(organizationId)}/jobs/${seg(jobId)}/copy`, body),
  setAssignees: (organizationId: string, jobId: string, userIds: string[]) =>
    api.put<Job>(`${org(organizationId)}/jobs/${seg(jobId)}/assignees`, { user_ids: userIds }),

  /* ---------------------------------- Tasks ---------------------------------- */
  listJobTasks: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<Task[]>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks`, { signal }),
  createTask: (organizationId: string, jobId: string, body: TaskInput) =>
    api.post<Task>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks`, body),
  updateTask: (organizationId: string, jobId: string, taskId: string, body: TaskUpdate) =>
    api.patch<Task>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks/${seg(taskId)}`, body),
  deleteTask: (organizationId: string, jobId: string, taskId: string) =>
    api.delete<null>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks/${seg(taskId)}`),
  changeTaskStatus: (organizationId: string, jobId: string, taskId: string, status: TaskStatus) =>
    api.post<Task>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks/${seg(taskId)}/status`, {
      status,
    }),
  setTaskAssignees: (organizationId: string, jobId: string, taskId: string, userIds: string[]) =>
    api.put<Task>(`${org(organizationId)}/jobs/${seg(jobId)}/tasks/${seg(taskId)}/assignees`, {
      user_ids: userIds,
    }),
  listTasks: (organizationId: string, filters: TaskFilters, page: PageRequest = {}) =>
    api.list<TaskListItem>(`${org(organizationId)}/tasks`, {
      query: {
        assignee_user_id: filters.assignee_user_id,
        status: filters.status,
        job_id: filters.job_id,
        client_id: filters.client_id,
        due_from: filters.due_from,
        due_to: filters.due_to,
        q: text(filters.q),
        sort: filters.sort,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),

  /* --------------------------------- Budgets --------------------------------- */
  /** Rows and totals in one object, paged with the cursor of `meta`. */
  listBudgets: (organizationId: string, filters: BudgetFilters, page: PageRequest = {}) =>
    api.withMessage<JobBudgetList>(`${org(organizationId)}/jobs/budgets`, {
      query: {
        status: filters.status,
        client_id: filters.client_id,
        manager_user_id: filters.manager_user_id,
        partner_user_id: filters.partner_user_id,
        service_id: filters.service_id,
        used_from_bp: filters.used_from_bp,
        used_to_bp: filters.used_to_bp,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  getBudget: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<JobBudgetDetail>(`${org(organizationId)}/jobs/${seg(jobId)}/budget`, { signal }),
  evaluateBudget: (organizationId: string, jobId: string) =>
    api.post<BudgetEvaluation>(`${org(organizationId)}/jobs/${seg(jobId)}/budget/evaluate`),

  /* --------------------------------- Calendar --------------------------------- */
  calendar: (organizationId: string, filters: CalendarFilters, signal?: AbortSignal) =>
    api.get<JobCalendar>(`${org(organizationId)}/jobs/calendar`, {
      query: {
        from: filters.from,
        to: filters.to,
        client_id: filters.client_id,
        manager_user_id: filters.manager_user_id,
        assignee_user_id: filters.assignee_user_id,
        status: filters.status,
      },
      signal,
    }),

  /* ---------------------------------- People ---------------------------------- */
  listMembers: (organizationId: string, cursor: string | undefined, signal?: AbortSignal) =>
    api.list<Member>(`${org(organizationId)}/members`, {
      query: { status: ['active'], limit: 100, cursor },
      signal,
    }),
};
