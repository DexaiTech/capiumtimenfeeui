import { queryKeys } from '@/constants/queryKeys';

import type { ApprovalKind, DashboardPeriod } from '../types';

/**
 * Keys of the dashboard widgets, all below `['org', organizationId, 'dashboard']`, the key the
 * Team module already refreshes when staff change: one key per widget and per question it was
 * asked, so refreshing one never touches the others.
 */
const root = (organizationId: string) => queryKeys.org.dashboard(organizationId);

export const dashboardKeys = {
  all: root,
  cards: (organizationId: string, period: DashboardPeriod) =>
    [...root(organizationId), 'cards', period] as const,
  myActions: (organizationId: string, limit: number) =>
    [...root(organizationId), 'my-actions', limit] as const,
  myTimesheet: (organizationId: string) => [...root(organizationId), 'my-timesheet'] as const,
  pendingApprovals: (organizationId: string, kind: ApprovalKind | null, limit: number) =>
    [...root(organizationId), 'pending-approvals', kind ?? 'all', limit] as const,
  missingTimesheets: (organizationId: string, week: string | null) =>
    [...root(organizationId), 'missing-timesheets', week ?? 'last-completed'] as const,
  topClients: (organizationId: string, limit: number, period: DashboardPeriod) =>
    [...root(organizationId), 'top-clients-by-wip', limit, period] as const,
  billingTrend: (organizationId: string, months: number) =>
    [...root(organizationId), 'billing-trend', months] as const,
  debtorAgeing: (organizationId: string, limit: number, period: DashboardPeriod) =>
    [...root(organizationId), 'debtor-ageing', limit, period] as const,
};
