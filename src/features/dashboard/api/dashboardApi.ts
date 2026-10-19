import { api } from '@/services/api';

import type {
  ApprovalKind,
  BillingTrend,
  DashboardCards,
  DashboardPeriod,
  DebtorAgeing,
  MissingTimesheetsWidget,
  MyActions,
  MyTimesheet,
  PendingApprovals,
  RemindersResult,
  TopClientsByWip,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const dashboard = (organizationId: string) => `${org(organizationId)}/dashboard`;
const seg = encodeURIComponent;

/**
 * Typed wrappers over the dashboard endpoints (`docs/modules/dashboard.md` of the API), and over
 * the module endpoints the pages decide approvals and send reminders with.
 */
export const dashboardApi = {
  cards: (organizationId: string, period: DashboardPeriod, signal?: AbortSignal) =>
    api.get<DashboardCards>(`${dashboard(organizationId)}/cards`, { query: { period }, signal }),
  myActions: (organizationId: string, limit: number, signal?: AbortSignal) =>
    api.get<MyActions>(`${dashboard(organizationId)}/my-actions`, { query: { limit }, signal }),
  myTimesheet: (organizationId: string, signal?: AbortSignal) =>
    api.get<MyTimesheet>(`${dashboard(organizationId)}/my-timesheet`, { signal }),
  pendingApprovals: (
    organizationId: string,
    kind: ApprovalKind | null,
    limit: number,
    signal?: AbortSignal,
  ) =>
    api.get<PendingApprovals>(`${dashboard(organizationId)}/pending-approvals`, {
      query: { kind: kind ?? undefined, limit },
      signal,
    }),
  missingTimesheets: (organizationId: string, week: string | null, signal?: AbortSignal) =>
    api.get<MissingTimesheetsWidget>(`${dashboard(organizationId)}/missing-timesheets`, {
      query: { week_start: week ?? undefined },
      signal,
    }),
  topClients: (
    organizationId: string,
    limit: number,
    period: DashboardPeriod,
    signal?: AbortSignal,
  ) =>
    api.get<TopClientsByWip>(`${dashboard(organizationId)}/top-clients-by-wip`, {
      query: { limit, period },
      signal,
    }),
  billingTrend: (organizationId: string, months: number, signal?: AbortSignal) =>
    api.get<BillingTrend>(`${dashboard(organizationId)}/billing-trend`, {
      query: { months },
      signal,
    }),
  debtorAgeing: (
    organizationId: string,
    limit: number,
    period: DashboardPeriod,
    signal?: AbortSignal,
  ) =>
    api.get<DebtorAgeing>(`${dashboard(organizationId)}/debtor-ageing`, {
      query: { limit, period },
      signal,
    }),

  /* Decided on the modules' own endpoints (a return needs a reason there: deep link). */
  approveTimesheet: (organizationId: string, timesheetId: string) =>
    api.post<unknown>(`${org(organizationId)}/timesheets/${seg(timesheetId)}/approve`),
  approveClaim: (organizationId: string, claimId: string) =>
    api.post<unknown>(`${org(organizationId)}/expense-claims/${seg(claimId)}/approve`),
  sendReminders: (organizationId: string, weekStart: string) =>
    api.post<RemindersResult>(`${org(organizationId)}/timesheets/reminders/run`, {
      week_start: weekStart,
    }),
};
