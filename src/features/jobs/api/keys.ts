import { queryKeys } from '@/constants/queryKeys';

import type { BudgetFilters, CalendarFilters, JobFilters, TaskFilters } from '../types';

/**
 * Keys of the job data, all under `['org', organizationId, 'jobs', …]`: the job lists, one job,
 * the tasks of a job and the cross-job task list, budget tracking, the calendar and the people
 * the screens name.
 */
export const jobKeys = {
  all: (organizationId: string) => queryKeys.org.jobs(organizationId),
  lists: (organizationId: string) => [...queryKeys.org.jobs(organizationId), 'list'] as const,
  list: (organizationId: string, filters: JobFilters) =>
    [...queryKeys.org.jobs(organizationId), 'list', filters] as const,
  detail: (organizationId: string, jobId: string) =>
    [...queryKeys.org.jobs(organizationId), 'detail', jobId] as const,
  jobTasks: (organizationId: string, jobId: string) =>
    [...queryKeys.org.jobs(organizationId), 'job-tasks', jobId] as const,
  taskList: (organizationId: string, filters: TaskFilters) =>
    [...queryKeys.org.jobs(organizationId), 'task-list', filters] as const,
  budgetList: (organizationId: string, filters: BudgetFilters) =>
    [...queryKeys.org.jobs(organizationId), 'budgets', filters] as const,
  budget: (organizationId: string, jobId: string) =>
    [...queryKeys.org.jobs(organizationId), 'budget', jobId] as const,
  calendar: (organizationId: string, filters: CalendarFilters) =>
    [...queryKeys.org.jobs(organizationId), 'calendar', filters] as const,
  /** The active people the screens name (a staff change refreshes it with the other members). */
  members: (organizationId: string) =>
    [...queryKeys.org.members(organizationId), 'jobs-directory'] as const,
};

/** Whether a cached query holds one job's own data: its detail, its tasks or its budget. */
export const isJobQuery = (queryKey: readonly unknown[], jobId: string): boolean =>
  (queryKey[3] === 'detail' || queryKey[3] === 'job-tasks' || queryKey[3] === 'budget') &&
  queryKey[4] === jobId;
