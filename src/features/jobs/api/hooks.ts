import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useMemo } from 'react';

import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';

import type {
  BudgetFilters,
  CalendarFilters,
  Job,
  JobCopyInput,
  JobFilters,
  JobBulkRequest,
  JobInput,
  JobStatus,
  JobUpdate,
  TaskFilters,
  TaskInput,
  TaskStatus,
  TaskUpdate,
} from '../types';
import { useJobInvalidation } from './invalidation';
import { jobsApi } from './jobsApi';
import { jobKeys } from './keys';
import { fetchEverything, nextCursor } from './pages';

interface QueryOptions {
  enabled?: boolean;
}

/* ----------------------------------- Reads ----------------------------------- */

/** The job list: previous rows stay visible while a new filter or search loads. */
export function useJobList(filters: JobFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: jobKeys.list(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      jobsApi.listJobs(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One job with its assignees and actuals. */
export function useJob(jobId: string | undefined, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: jobKeys.detail(organization.id, jobId ?? ''),
    queryFn: ({ signal }) => jobsApi.getJob(organization.id, jobId ?? '', signal),
    enabled: Boolean(jobId) && (options.enabled ?? true),
  });
}

/** The tasks of one job in their order (not paginated: a job has at most 500). */
export function useJobTasks(jobId: string | undefined, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: jobKeys.jobTasks(organization.id, jobId ?? ''),
    queryFn: ({ signal }) => jobsApi.listJobTasks(organization.id, jobId ?? '', signal),
    enabled: Boolean(jobId) && (options.enabled ?? true),
  });
}

/** The tasks of every live job (the Tasks page). */
export function useTaskList(filters: TaskFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: jobKeys.taskList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      jobsApi.listTasks(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Budget tracking: rows and the totals over every job the filters select. */
export function useBudgetList(filters: BudgetFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: jobKeys.budgetList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      jobsApi.listBudgets(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One job's budget against actual, by task and by person. */
export function useJobBudget(jobId: string | undefined, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: jobKeys.budget(organization.id, jobId ?? ''),
    queryFn: ({ signal }) => jobsApi.getBudget(organization.id, jobId ?? '', signal),
    enabled: Boolean(jobId) && (options.enabled ?? true),
  });
}

/** The jobs that overlap a range and the tasks due in it. */
export function useJobCalendar(filters: CalendarFilters, options: QueryOptions = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: jobKeys.calendar(organization.id, filters),
    queryFn: ({ signal }) => jobsApi.calendar(organization.id, filters, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Every active member (the pickers and the names of managers, partners and assignees). */
export function useMembers() {
  const { organization, can } = useOrg();
  return useQuery({
    queryKey: jobKeys.members(organization.id),
    queryFn: ({ signal }) =>
      fetchEverything((cursor) => jobsApi.listMembers(organization.id, cursor, signal)),
    enabled: can(PERMISSIONS.memberRead),
    staleTime: 5 * 60_000,
  });
}

/** A name for a user id, null while the people load or when the person is not an active member. */
export function useMemberNames() {
  const members = useMembers();
  return useMemo(() => {
    const names = new Map((members.data ?? []).map((member) => [member.user_id, member.full_name]));
    return (userId: string | null | undefined) => (userId ? (names.get(userId) ?? null) : null);
  }, [members.data]);
}

/* --------------------------------- Mutations --------------------------------- */

/** What every job-changing call does with its answer: the job is the fresh detail. */
function useKeepJob() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return (job: Job) => {
    queryClient.setQueryData(jobKeys.detail(organization.id, job.id), job);
  };
}

export function useCreateJob() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  const keep = useKeepJob();
  return useMutation({
    mutationFn: (body: JobInput) => jobsApi.createJob(organization.id, body),
    onSuccess: keep,
    onSettled: invalidate.jobs,
  });
}

export function useUpdateJob() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  const keep = useKeepJob();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: JobUpdate }) =>
      jobsApi.updateJob(organization.id, jobId, body),
    onSuccess: keep,
    onSettled: invalidate.jobs,
  });
}

export function useDeleteJob() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: (jobId: string) => jobsApi.deleteJob(organization.id, jobId),
    onSettled: (_data, _error, jobId) => {
      invalidate.deleted(jobId);
    },
  });
}

/** One action on the selected jobs: all or nothing (`POST /jobs/bulk`). */
export function useBulkJobs() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: (body: JobBulkRequest) => jobsApi.bulk(organization.id, body),
    onSettled: () => invalidate.jobs(),
  });
}

export function useChangeJobStatus() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  const keep = useKeepJob();
  return useMutation({
    mutationFn: ({ jobId, status }: { jobId: string; status: JobStatus }) =>
      jobsApi.changeStatus(organization.id, jobId, status),
    onSuccess: keep,
    onSettled: invalidate.jobs,
  });
}

export function useCopyJob() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  const keep = useKeepJob();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: JobCopyInput }) =>
      jobsApi.copyJob(organization.id, jobId, body),
    onSuccess: keep,
    onSettled: invalidate.jobs,
  });
}

export function useSetJobAssignees() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  const keep = useKeepJob();
  return useMutation({
    mutationFn: ({ jobId, userIds }: { jobId: string; userIds: string[] }) =>
      jobsApi.setAssignees(organization.id, jobId, userIds),
    onSuccess: keep,
    onSettled: invalidate.jobs,
  });
}

export function useCreateTask() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({ jobId, body }: { jobId: string; body: TaskInput }) =>
      jobsApi.createTask(organization.id, jobId, body),
    onSettled: invalidate.jobs,
  });
}

export function useUpdateTask() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({ jobId, taskId, body }: { jobId: string; taskId: string; body: TaskUpdate }) =>
      jobsApi.updateTask(organization.id, jobId, taskId, body),
    onSettled: invalidate.jobs,
  });
}

export function useDeleteTask() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({ jobId, taskId }: { jobId: string; taskId: string }) =>
      jobsApi.deleteTask(organization.id, jobId, taskId),
    onSettled: invalidate.jobs,
  });
}

export function useChangeTaskStatus() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({
      jobId,
      taskId,
      status,
    }: {
      jobId: string;
      taskId: string;
      status: TaskStatus;
    }) => jobsApi.changeTaskStatus(organization.id, jobId, taskId, status),
    onSettled: invalidate.jobs,
  });
}

export function useSetTaskAssignees() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: ({
      jobId,
      taskId,
      userIds,
    }: {
      jobId: string;
      taskId: string;
      userIds: string[];
    }) => jobsApi.setTaskAssignees(organization.id, jobId, taskId, userIds),
    onSettled: invalidate.jobs,
  });
}

/** Re-evaluates the budget alerts of a job (they also follow every time and expense write). */
export function useEvaluateBudget() {
  const { organization } = useOrg();
  const invalidate = useJobInvalidation();
  return useMutation({
    mutationFn: (jobId: string) => jobsApi.evaluateBudget(organization.id, jobId),
    onSettled: invalidate.jobs,
  });
}
