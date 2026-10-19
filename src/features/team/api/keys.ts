import { queryKeys } from '@/constants/queryKeys';

import type {
  GradeFilters,
  RateHistoryFilters,
  RateRuleFilters,
  ResolveQuery,
  RerunItemOutcome,
  StaffFilters,
} from '../types';

/**
 * Keys of the Team & Rates data, all under `['org', organizationId, …]`. Staff keys sit under
 * `staff`; the V1 `members` keys (read by the Clients feature and the member picker) are
 * refreshed together with them by the mutations.
 */
export const teamKeys = {
  staffLists: (organizationId: string) => [...queryKeys.org.staff(organizationId), 'list'] as const,
  staffList: (organizationId: string, filters: StaffFilters) =>
    [...queryKeys.org.staff(organizationId), 'list', filters] as const,
  staffMember: (organizationId: string, staffId: string) =>
    [...queryKeys.org.staff(organizationId), 'detail', staffId] as const,
  staffLookup: (organizationId: string, filters: StaffFilters) =>
    [...queryKeys.org.staff(organizationId), 'lookup', filters] as const,

  gradeList: (organizationId: string, filters: GradeFilters) =>
    [...queryKeys.org.grades(organizationId), 'list', filters] as const,
  gradeOptions: (organizationId: string) =>
    [...queryKeys.org.grades(organizationId), 'options'] as const,

  rateRuleList: (organizationId: string, filters: RateRuleFilters) =>
    [...queryKeys.org.rateRules(organizationId), 'list', filters] as const,
  rateResolution: (organizationId: string, query: ResolveQuery) =>
    [...queryKeys.org.rateRules(organizationId), 'resolve', query] as const,
  rateHistoryList: (organizationId: string, filters: RateHistoryFilters) =>
    [...queryKeys.org.rateHistory(organizationId), 'list', filters] as const,

  rerunList: (organizationId: string) =>
    [...queryKeys.org.rateReruns(organizationId), 'list'] as const,
  rerunItems: (organizationId: string, runId: string, outcome: RerunItemOutcome | undefined) =>
    [...queryKeys.org.rateReruns(organizationId), 'items', runId, outcome ?? 'all'] as const,

  services: (organizationId: string) =>
    [...queryKeys.org.services(organizationId), 'list'] as const,
  activityTypes: (organizationId: string) =>
    [...queryKeys.org.activityCodes(organizationId), 'list'] as const,
  vatCodes: (organizationId: string) =>
    [...queryKeys.org.vatRates(organizationId), 'list'] as const,

  /** Pickers of clients and jobs sit under their own modules' keys, so those modules refresh them. */
  clientLookup: (organizationId: string, q: string) =>
    [...queryKeys.org.clients(organizationId), 'team-lookup', q] as const,
  clientOption: (organizationId: string, clientId: string) =>
    [...queryKeys.org.clients(organizationId), 'team-option', clientId] as const,
  jobLookup: (organizationId: string, q: string, clientId: string | null) =>
    [...queryKeys.org.jobs(organizationId), 'team-lookup', q, clientId] as const,
  jobOption: (organizationId: string, jobId: string) =>
    [...queryKeys.org.jobs(organizationId), 'team-option', jobId] as const,
};
