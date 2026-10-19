import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { wipKeys } from './keys';

/**
 * What to refresh after a change to the WIP. Everything is only marked stale and refetched when
 * something shows it: the WIP views, the job figures, the client workspace and the dashboard.
 */
export function useWipInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;

  return useMemo(() => {
    const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };
    return {
      /** An adjustment, a transfer or a write-off was made, decided or reversed. */
      changed: () =>
        refresh(
          wipKeys.all(id),
          queryKeys.org.jobs(id),
          queryKeys.org.clients(id),
          queryKeys.org.dashboard(id),
          queryKeys.org.auditLogs(id),
        ),
    };
  }, [queryClient, id]);
}
