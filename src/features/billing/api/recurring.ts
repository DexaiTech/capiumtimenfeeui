import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { LIST_PAGE_SIZE } from '../constants';
import type { Schedule, ScheduleCreate, ScheduleListFilters, ScheduleUpdate } from '../types';
import { billingApi } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { nextCursor } from './pages';

/** The schedules, soonest run first as the API orders them. */
export function useScheduleList(filters: ScheduleListFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.scheduleList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listSchedules(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** One schedule with its template lines. */
export function useSchedule(scheduleId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.schedule(organization.id, scheduleId ?? ''),
    queryFn: ({ signal }) => billingApi.getSchedule(organization.id, scheduleId ?? '', signal),
    enabled: scheduleId !== null,
  });
}

/** The runs of one schedule, newest first. */
export function useScheduleRuns(scheduleId: string | null) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.scheduleRuns(organization.id, scheduleId ?? ''),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listScheduleRuns(organization.id, scheduleId ?? '', {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: scheduleId !== null,
  });
}

/** Keeps the open schedule current with what a change returned, before the refetch lands. */
function useDetailCache() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return (schedule: Schedule) =>
    queryClient.setQueryData(billingKeys.schedule(organization.id, schedule.id), schedule);
}

export function useCreateSchedule() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: ScheduleCreate) => billingApi.createSchedule(organization.id, body),
    onSuccess: cache,
    onSettled: invalidate.recurring,
  });
}

export function useUpdateSchedule(scheduleId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: ScheduleUpdate) =>
      billingApi.updateSchedule(organization.id, scheduleId, body),
    onSuccess: cache,
    onSettled: invalidate.recurring,
  });
}

/** Deletes a schedule that never ran (else the API answers `SCHEDULE_HAS_RUNS`). */
export function useDeleteSchedule() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (scheduleId: string) => billingApi.deleteSchedule(organization.id, scheduleId),
    onSuccess: (_result, scheduleId) =>
      queryClient.removeQueries({ queryKey: billingKeys.schedule(organization.id, scheduleId) }),
    onSettled: invalidate.recurring,
  });
}

export function usePauseSchedule() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (scheduleId: string) => billingApi.pauseSchedule(organization.id, scheduleId),
    onSuccess: cache,
    onSettled: invalidate.recurring,
  });
}

export function useResumeSchedule() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (scheduleId: string) => billingApi.resumeSchedule(organization.id, scheduleId),
    onSuccess: cache,
    onSettled: invalidate.recurring,
  });
}

/** Retries a failed run. It can fail again: the caller reads the `status` of the result. */
export function useRetryRun() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (runId: string) => billingApi.retryRun(organization.id, runId),
    onSettled: invalidate.recurring,
  });
}
