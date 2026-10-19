import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';
import { api } from '@/services/api';

import type {
  CentralEnabled,
  CentralSearchResult,
  CentralSyncAll,
  ClientSynced,
} from '../central/types';
import type { ClientDetail } from '../types';
import { clientKeys, org, seg, useInvalidateClients } from './clients';

/** Typed wrappers over the central client endpoints (`app/api/v1/central_clients.py`). */
export const centralApi = {
  /** `client.create`. A blank `q` lists the first clients by name. */
  search: (organizationId: string, q: string, signal?: AbortSignal) =>
    api.get<CentralSearchResult>(`${org(organizationId)}/central-clients`, {
      query: { q: q || undefined, limit: 20 },
      signal,
    }),
  /** `client.create`: 201 `created`, 200 `linked_existing` / `already_enabled`. */
  enable: (organizationId: string, centralId: string) =>
    api.post<CentralEnabled>(`${org(organizationId)}/central-clients/${seg(centralId)}/enable`),
  link: (organizationId: string, clientId: string, centralId: string) =>
    api.post<ClientDetail>(`${org(organizationId)}/clients/${seg(clientId)}/central-link`, {
      central_id: centralId,
    }),
  unlink: (organizationId: string, clientId: string) =>
    api.delete<ClientDetail>(`${org(organizationId)}/clients/${seg(clientId)}/central-link`),
  /** `client.update`. */
  sync: (organizationId: string, clientId: string) =>
    api.post<ClientSynced>(`${org(organizationId)}/clients/${seg(clientId)}/central-sync`),
  syncAll: (organizationId: string) =>
    api.post<CentralSyncAll>(`${org(organizationId)}/clients/central-sync`),
};

/**
 * Central clients matching `q`. A 503 `CENTRAL_UNAVAILABLE` (down, nothing cached) is not
 * retried: the dialog shows it with its own "Try again".
 */
export function useCentralSearch(q: string, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.centralSearch(organization.id, q),
    queryFn: ({ signal }) => centralApi.search(organization.id, q, signal),
    enabled,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useEnableCentralClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (centralId: string) => centralApi.enable(organization.id, centralId),
    onSuccess: invalidate,
  });
}

export function useLinkCentralClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, centralId }: { clientId: string; centralId: string }) =>
      centralApi.link(organization.id, clientId, centralId),
    onSuccess: invalidate,
  });
}

export function useUnlinkCentralClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (clientId: string) => centralApi.unlink(organization.id, clientId),
    onSuccess: invalidate,
  });
}

export function useSyncClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (clientId: string) => centralApi.sync(organization.id, clientId),
    onSuccess: invalidate,
  });
}

export function useSyncAllClients() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: () => centralApi.syncAll(organization.id),
    onSuccess: invalidate,
  });
}
