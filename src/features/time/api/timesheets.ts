import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { MissingFilters, TimesheetFilters } from '../types';
import { useTimeInvalidation } from './invalidation';
import { timeKeys } from './keys';
import { fetchEverything, nextCursor } from './pages';
import { timeApi } from './timeApi';

interface Enabled {
  enabled?: boolean;
}

/** One timesheet with its entries. */
export function useTimesheet(
  timesheetId: string | null | undefined,
  { enabled = true }: Enabled = {},
) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.timesheet(organization.id, timesheetId ?? ''),
    queryFn: ({ signal }) => timeApi.getTimesheet(organization.id, timesheetId ?? '', signal),
    enabled: enabled && Boolean(timesheetId),
  });
}

/** The timesheets of a range of weeks, every page of them (the Team page is one week). */
export function useTimesheetList(filters: TimesheetFilters, { enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.timesheetList(organization.id, filters),
    queryFn: ({ signal }) =>
      fetchEverything(
        (cursor) =>
          timeApi.listTimesheets(organization.id, filters, { cursor, limit: 100, signal }),
        10,
      ),
    enabled,
  });
}

/** The submitted timesheets waiting for the caller's decision, oldest week first. */
export function useApprovals({ enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: timeKeys.approvals(organization.id),
    queryFn: ({ pageParam, signal }) =>
      timeApi.listApprovals(organization.id, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled,
  });
}

/** People whose timesheet for a week is not submitted. */
export function useMissingTimesheets(filters: MissingFilters, { enabled = true }: Enabled = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.missing(organization.id, filters),
    queryFn: ({ signal }) => timeApi.listMissing(organization.id, filters, signal),
    enabled,
  });
}

export function useSubmitTimesheet() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (timesheetId: string) => timeApi.submitTimesheet(organization.id, timesheetId),
    onSettled: invalidate.sheets,
  });
}

export function useRecallTimesheet() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (timesheetId: string) => timeApi.recallTimesheet(organization.id, timesheetId),
    onSettled: invalidate.sheets,
  });
}

export function useApproveTimesheet() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ timesheetId, note }: { timesheetId: string; note?: string }) =>
      timeApi.approveTimesheet(organization.id, timesheetId, note),
    onSettled: invalidate.sheets,
  });
}

/** "Return" with the reason (the API calls it reject). */
export function useReturnTimesheet() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ timesheetId, note }: { timesheetId: string; note: string }) =>
      timeApi.rejectTimesheet(organization.id, timesheetId, note),
    onSettled: invalidate.sheets,
  });
}

export function useBulkApprove() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (timesheetIds: string[]) => timeApi.bulkApprove(organization.id, timesheetIds),
    onSettled: invalidate.sheets,
  });
}

export function useRunReminders() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (weekStart?: string) => timeApi.runReminders(organization.id, weekStart),
    onSettled: invalidate.reminders,
  });
}
