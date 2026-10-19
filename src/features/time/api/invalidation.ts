import { useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { timeKeys } from './keys';

/**
 * What to refresh after each kind of change. Everything is only marked stale and refetched when
 * something shows it. The functions answer once the recorded time and the timesheets on screen
 * have been read again (the grid waits for that before it calls a cell saved); the figures of the
 * other modules are refreshed without waiting.
 */
export function useTimeInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;
  const refresh = async (...keys: ReadonlyArray<readonly unknown[]>) => {
    await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
  };
  const alsoAudited = () =>
    void refresh(
      queryKeys.org.wip(id),
      queryKeys.org.jobs(id),
      queryKeys.org.clients(id),
      queryKeys.org.reports(id),
      queryKeys.org.dashboard(id),
      queryKeys.org.auditLogs(id),
    );

  return {
    /** An entry was created, changed, corrected, copied or deleted. */
    entries: () => {
      alsoAudited();
      return refresh(queryKeys.org.time(id), queryKeys.org.timesheets(id));
    },
    /** A timesheet was submitted, recalled, approved or returned. */
    sheets: () => {
      alsoAudited();
      return refresh(queryKeys.org.time(id), queryKeys.org.timesheets(id));
    },
    timer: () => refresh(timeKeys.timer(id)),
    /** Reminders were sent: the missing list shows when. */
    reminders: () => refresh(queryKeys.org.timesheets(id)),
  };
}
