import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { DEFAULT_SORT, EMPTY_FILTERS } from '../constants';
import type { ClientStatus } from '../types';
import { clientKeys, clientsApi } from './clients';

/** Matches offered by a client lookup: enough to find one by typing, few enough to scan. */
export const LOOKUP_LIMIT = 20;

/**
 * Clients matching what was typed (`GET /clients?q=`, by name or code), by name. `statuses` limits
 * them; leave it empty for the API's default, every status except archived.
 */
export function useClientLookup(
  q: string,
  statuses: ReadonlyArray<ClientStatus>,
  enabled: boolean,
) {
  const { organization } = useOrg();
  const text = q.trim();
  return useQuery({
    queryKey: clientKeys.lookup(organization.id, text, statuses),
    queryFn: ({ signal }) =>
      clientsApi.list(
        organization.id,
        {
          q: text,
          filters: { ...EMPTY_FILTERS, status: [...statuses] },
          sort: DEFAULT_SORT,
          order: 'asc',
        },
        { signal, limit: LOOKUP_LIMIT },
      ),
    select: (page) => page.data,
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 30_000,
  });
}
