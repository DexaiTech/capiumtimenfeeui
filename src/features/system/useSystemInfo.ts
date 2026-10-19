import { useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { isApiError } from '@/services/api';

import { systemApi } from './api/systemApi';
import type { SystemOrganization } from './types';

export interface SystemInfoState {
  /**
   * False until the deployment mode is known. Anything that depends on the mode (a register
   * link, the organization switcher) waits for it, so nothing flashes and then disappears.
   */
  ready: boolean;
  /** True when this is a closed deployment: one organization, accounts made by an administrator. */
  closed: boolean;
  /** The single organization of a closed deployment, otherwise null. */
  organization: SystemOrganization | null;
  /** True when sign-up, onboarding and invitations are available: known, and not closed. */
  openRegistration: boolean;
}

/**
 * The deployment mode, fetched once at startup (public, no session). An API without the
 * endpoint (404: an older version) is treated as an open deployment, as the application
 * behaved before the mode existed. An API that is down (502, 503, no connection) is treated as
 * closed: sign-up and password reset must not be offered while nothing can answer them.
 */
export function useSystemInfo(): SystemInfoState {
  const { data, error, isPending } = useQuery({
    queryKey: queryKeys.system(),
    queryFn: ({ signal }) => systemApi.get(signal),
    // The mode only changes with a restart of the API.
    staleTime: Infinity,
    retry: false,
  });
  const unreachable = error !== null && !(isApiError(error) && error.status === 404);
  const closed = data?.closed_deployment === true || unreachable;
  return {
    ready: !isPending,
    closed,
    organization: closed ? (data?.organization ?? null) : null,
    openRegistration: !isPending && !closed,
  };
}
