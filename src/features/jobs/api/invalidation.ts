import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { jobKeys, isJobQuery } from './keys';

/**
 * What to refresh after a change. Everything is only marked stale and refetched when something
 * shows it, so listing the neighbours is cheap: any change to a job or a task can move the job
 * lists, budget tracking and the calendar, and shows on the dashboard and the client workspace.
 */
export function useJobInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;

  return useMemo(() => {
    const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };
    const around = [
      queryKeys.org.dashboard(id),
      queryKeys.org.clients(id),
      queryKeys.org.auditLogs(id),
    ] as const;

    return {
      /** A job or one of its tasks changed. */
      jobs: () => refresh(jobKeys.all(id), ...around),
      /**
       * A job was deleted: everything is refreshed but its own detail, tasks and budget, which
       * the page still showing it would ask for again and be answered 404.
       */
      deleted: (jobId: string) => {
        void queryClient.invalidateQueries({
          queryKey: jobKeys.all(id),
          predicate: (query) => !isJobQuery(query.queryKey, jobId),
        });
        refresh(...around);
      },
      /** Only the cached people changed. */
      members: () => refresh(jobKeys.members(id)),
    };
  }, [queryClient, id]);
}
