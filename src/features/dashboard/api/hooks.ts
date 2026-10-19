import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import type { ApprovalKind, DashboardPeriod } from '../types';
import { dashboardApi } from './dashboardApi';
import { dashboardKeys } from './keys';

/*
 * One hook per widget. Each widget loads, refreshes and fails on its own: its own key, its own
 * request, its own `isPending` / `isError`. A change of period or week keeps the previous figures
 * on screen until the new ones arrive.
 */

export function useDashboardCards(period: DashboardPeriod) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.cards(organization.id, period),
    queryFn: ({ signal }) => dashboardApi.cards(organization.id, period, signal),
    placeholderData: keepPreviousData,
  });
}

export function useMyActions(limit: number) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.myActions(organization.id, limit),
    queryFn: ({ signal }) => dashboardApi.myActions(organization.id, limit, signal),
  });
}

export function useMyTimesheet() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.myTimesheet(organization.id),
    queryFn: ({ signal }) => dashboardApi.myTimesheet(organization.id, signal),
  });
}

export function usePendingApprovals(kind: ApprovalKind | null, limit: number) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.pendingApprovals(organization.id, kind, limit),
    queryFn: ({ signal }) => dashboardApi.pendingApprovals(organization.id, kind, limit, signal),
    placeholderData: keepPreviousData,
  });
}

/** `week` is any day of the week to list; null is the last completed week. */
export function useMissingTimesheets(week: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.missingTimesheets(organization.id, week),
    queryFn: ({ signal }) => dashboardApi.missingTimesheets(organization.id, week, signal),
    placeholderData: keepPreviousData,
  });
}

export function useTopClientsByWip(limit: number, period: DashboardPeriod) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.topClients(organization.id, limit, period),
    queryFn: ({ signal }) => dashboardApi.topClients(organization.id, limit, period, signal),
    placeholderData: keepPreviousData,
  });
}

export function useBillingTrend(months: number) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.billingTrend(organization.id, months),
    queryFn: ({ signal }) => dashboardApi.billingTrend(organization.id, months, signal),
    placeholderData: keepPreviousData,
  });
}

export function useDebtorAgeing(limit: number, period: DashboardPeriod) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: dashboardKeys.debtorAgeing(organization.id, limit, period),
    queryFn: ({ signal }) => dashboardApi.debtorAgeing(organization.id, limit, period, signal),
    placeholderData: keepPreviousData,
  });
}

/** Refetches every widget on screen (the overview's "Refresh all"). */
export function useRefreshDashboard() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => queryClient.invalidateQueries({ queryKey: dashboardKeys.all(organization.id) });
}

/** What a decision changes elsewhere: the module's lists, WIP (approved time becomes WIP). */
function refreshAfterDecision(queryClient: QueryClient, organizationId: string) {
  const keys = [
    dashboardKeys.all(organizationId),
    queryKeys.org.time(organizationId),
    queryKeys.org.timesheets(organizationId),
    queryKeys.org.wip(organizationId),
    queryKeys.org.reports(organizationId),
  ];
  for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  // The expenses module keeps its own keys: everything of the practice that names expenses.
  void queryClient.invalidateQueries({
    queryKey: queryKeys.org.all(organizationId),
    predicate: (query) => query.queryKey.some((part) => String(part).startsWith('expense')),
  });
}

export function useApproveTimesheet() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (timesheetId: string) => dashboardApi.approveTimesheet(organization.id, timesheetId),
    onSuccess: () => refreshAfterDecision(queryClient, organization.id),
  });
}

export function useApproveExpenseClaim() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (claimId: string) => dashboardApi.approveClaim(organization.id, claimId),
    onSuccess: () => refreshAfterDecision(queryClient, organization.id),
  });
}

export function useSendTimesheetReminders() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (weekStart: string) => dashboardApi.sendReminders(organization.id, weekStart),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [...dashboardKeys.all(organization.id), 'missing-timesheets'],
      }),
  });
}
