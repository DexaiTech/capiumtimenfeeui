import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

/**
 * What to refresh after each kind of change. Everything is only marked stale and refetched when
 * something shows it, so listing the neighbours is cheap: a staff change reaches the V1 member
 * lists (Clients, pickers), a rate change the staff rate columns, a re-rate the unbilled time
 * and money screens of the other modules.
 */
export function useTeamInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;
  const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
    for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
  };
  const audit = queryKeys.org.auditLogs(id);

  return {
    staff: () =>
      refresh(
        queryKeys.org.staff(id),
        queryKeys.org.members(id),
        queryKeys.org.grades(id),
        queryKeys.org.roles(id),
        queryKeys.org.rateRules(id),
        audit,
      ),
    grades: () =>
      refresh(
        queryKeys.org.grades(id),
        queryKeys.org.staff(id),
        queryKeys.org.rateRules(id),
        queryKeys.org.rateHistory(id),
        audit,
      ),
    rates: () =>
      refresh(
        queryKeys.org.rateRules(id),
        queryKeys.org.rateHistory(id),
        queryKeys.org.staff(id),
        queryKeys.org.grades(id),
        queryKeys.org.services(id),
        audit,
      ),
    rerate: () =>
      refresh(
        queryKeys.org.rateReruns(id),
        queryKeys.org.rateRules(id),
        queryKeys.org.time(id),
        queryKeys.org.timesheets(id),
        queryKeys.org.wip(id),
        queryKeys.org.jobs(id),
        queryKeys.org.clients(id),
        queryKeys.org.reports(id),
        queryKeys.org.dashboard(id),
        audit,
      ),
    catalogue: () =>
      refresh(
        queryKeys.org.services(id),
        queryKeys.org.activityCodes(id),
        queryKeys.org.rateRules(id),
        queryKeys.org.clients(id),
        audit,
      ),
  };
}
