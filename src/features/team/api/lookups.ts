import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { teamKeys } from './keys';
import { teamApi } from './teamApi';

/** Clients matching a search, for a picker. Needs `client.read`. */
export function useClientLookup(q: string, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.clientLookup(organization.id, q),
    queryFn: async ({ signal }) => (await teamApi.listClients(organization.id, q, signal)).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** One client, to name an id taken from a link. */
export function useClientOption(clientId: string | null | undefined, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.clientOption(organization.id, clientId ?? ''),
    queryFn: ({ signal }) => teamApi.getClient(organization.id, clientId ?? '', signal),
    enabled: enabled && Boolean(clientId),
    staleTime: 60_000,
  });
}

/** Jobs matching a search (of one client when given), for a picker. Needs `job.read`. */
export function useJobLookup(q: string, clientId: string | null, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.jobLookup(organization.id, q, clientId),
    queryFn: async ({ signal }) =>
      (await teamApi.listJobs(organization.id, q, clientId, signal)).data,
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useJobOption(jobId: string | null | undefined, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.jobOption(organization.id, jobId ?? ''),
    queryFn: ({ signal }) => teamApi.getJob(organization.id, jobId ?? '', signal),
    enabled: enabled && Boolean(jobId),
    staleTime: 60_000,
  });
}
