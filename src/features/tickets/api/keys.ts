import { queryKeys } from '@/constants/queryKeys';

import type { DashboardRange, TicketFilters } from '../types';

/**
 * Keys of the Application Testing data, all under `['org', organizationId, …]`: the lists, one
 * ticket, its comments, the cached bytes of its files, the dashboard; the tags have their own.
 */
export const ticketKeys = {
  all: (organizationId: string) => queryKeys.org.tickets(organizationId),
  lists: (organizationId: string) => [...queryKeys.org.tickets(organizationId), 'list'] as const,
  list: (organizationId: string, filters: TicketFilters) =>
    [...queryKeys.org.tickets(organizationId), 'list', filters] as const,
  detail: (organizationId: string, ticketId: string) =>
    [...queryKeys.org.tickets(organizationId), 'detail', ticketId] as const,
  details: (organizationId: string) =>
    [...queryKeys.org.tickets(organizationId), 'detail'] as const,
  comments: (organizationId: string, ticketId: string) =>
    [...queryKeys.org.tickets(organizationId), 'comments', ticketId] as const,
  file: (organizationId: string, ticketId: string, attachmentId: string) =>
    [...queryKeys.org.tickets(organizationId), 'file', ticketId, attachmentId] as const,
  dashboards: (organizationId: string) =>
    [...queryKeys.org.tickets(organizationId), 'dashboard'] as const,
  dashboard: (organizationId: string, range: DashboardRange) =>
    [...queryKeys.org.tickets(organizationId), 'dashboard', range] as const,
  tags: (organizationId: string) => [...queryKeys.org.ticketTags(organizationId), 'list'] as const,
};
