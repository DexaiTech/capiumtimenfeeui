import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

import type {
  Mappings,
  MappingsWrite,
  IntegrationKey,
  IntegrationUpdate,
  Onboarding,
  PeriodLockCreate,
  PeriodLockReopen,
  StepState,
  SyncItemFilters,
  SyncLogFilters,
} from '../adminTypes';
import { adminApi } from './adminApi';

/** Keys of the period lock, onboarding and integration data, all under `['org', organizationId, …]`. */
export const adminKeys = {
  periodLock: (organizationId: string) =>
    [...queryKeys.org.periodLock(organizationId), 'current'] as const,
  periodLockHistory: (organizationId: string) =>
    [...queryKeys.org.periodLock(organizationId), 'history'] as const,
  onboarding: (organizationId: string) => queryKeys.org.onboarding(organizationId),
  integrations: (organizationId: string) =>
    [...queryKeys.org.settings(organizationId), 'integrations'] as const,
  cards: (organizationId: string) =>
    [...queryKeys.org.settings(organizationId), 'integrations', 'cards'] as const,
  syncItems: (organizationId: string, filters: SyncItemFilters) =>
    [...queryKeys.org.settings(organizationId), 'integrations', 'sync-items', filters] as const,
  syncLogs: (organizationId: string, filters: SyncLogFilters) =>
    [...queryKeys.org.settings(organizationId), 'integrations', 'sync-logs', filters] as const,
  mappings: (organizationId: string) =>
    [...queryKeys.org.settings(organizationId), 'integrations', 'mappings'] as const,
};

type Page<TItem> = ApiResult<TItem[], PageMeta>;
type KeyRoot = (organizationId: string) => readonly unknown[];

const nextCursor = <TItem>(last: Page<TItem>) => last.meta?.next_cursor ?? undefined;

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: InfiniteData<Page<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** Marks the data under each key root stale; only what is on screen is fetched again. */
function useRefresh(...roots: KeyRoot[]) {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => {
    for (const root of roots) {
      void queryClient.invalidateQueries({ queryKey: root(organization.id) });
    }
  };
}

/* -------------------------------- Period lock -------------------------------- */

export function usePeriodLock(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: adminKeys.periodLock(organization.id),
    queryFn: ({ signal }) => adminApi.getPeriodLock(organization.id, signal),
    enabled: options.enabled ?? true,
  });
}

export function usePeriodLockHistory(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: adminKeys.periodLockHistory(organization.id),
    queryFn: ({ pageParam, signal }) =>
      adminApi.listPeriodLockHistory(organization.id, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: options.enabled ?? true,
  });
}

/** Both changes answer with the new lock; the history and the audit log gain an entry. */
function usePeriodLockChange<TBody>(
  send: (organizationId: string, body: TBody) => Promise<unknown>,
) {
  const { organization } = useOrg();
  const refresh = useRefresh(queryKeys.org.periodLock, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: (body: TBody) => send(organization.id, body),
    onSettled: refresh,
  });
}

export const useLockPeriod = () =>
  usePeriodLockChange<PeriodLockCreate>((organizationId, body) =>
    adminApi.lockPeriod(organizationId, body),
  );

export const useReopenPeriod = () =>
  usePeriodLockChange<PeriodLockReopen>((organizationId, body) =>
    adminApi.reopenPeriod(organizationId, body),
  );

/* -------------------------------- Onboarding -------------------------------- */

export function useOnboarding() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: adminKeys.onboarding(organization.id),
    queryFn: ({ signal }) => adminApi.getOnboarding(organization.id, signal),
  });
}

/** Marks a step; the answer is the whole checklist, so it replaces what is shown. */
export function useSetOnboardingStep() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const refresh = useRefresh(queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: ({ key, state }: { key: string; state: StepState }) =>
      adminApi.setOnboardingStep(organization.id, key, state),
    onSuccess: (checklist) => {
      queryClient.setQueryData<Onboarding>(adminKeys.onboarding(organization.id), checklist);
    },
    onSettled: refresh,
  });
}

/* ------------------------------- Integrations ------------------------------- */

export function useIntegrations(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: adminKeys.cards(organization.id),
    queryFn: ({ signal }) => adminApi.listIntegrations(organization.id, signal),
    enabled: options.enabled ?? true,
  });
}

/** A run changes what the other screens list: clients, jobs, staff and the billing documents. */
function useRunRefresh() {
  return useRefresh(
    adminKeys.integrations,
    queryKeys.org.clients,
    queryKeys.org.jobs,
    queryKeys.org.staff,
    queryKeys.org.members,
    queryKeys.org.invoices,
    queryKeys.org.creditNotes,
    queryKeys.org.auditLogs,
  );
}

export function useUpdateIntegration() {
  const { organization } = useOrg();
  const refresh = useRefresh(adminKeys.integrations, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: ({ key, body }: { key: IntegrationKey; body: IntegrationUpdate }) =>
      adminApi.updateIntegration(organization.id, key, body),
    onSettled: refresh,
  });
}

export function useRunIntegration() {
  const { organization } = useOrg();
  const refresh = useRunRefresh();
  return useMutation({
    mutationFn: (key: IntegrationKey) => adminApi.runIntegration(organization.id, key),
    onSettled: refresh,
  });
}

export function useRetryFailed() {
  const { organization } = useOrg();
  const refresh = useRunRefresh();
  return useMutation({
    mutationFn: (key: IntegrationKey) => adminApi.retryFailed(organization.id, key),
    onSettled: refresh,
  });
}

export function useSetMockAvailability() {
  const { organization } = useOrg();
  const refresh = useRefresh(adminKeys.integrations);
  return useMutation({
    mutationFn: ({ key, available }: { key: IntegrationKey; available: boolean }) =>
      adminApi.setMockAvailability(organization.id, key, available),
    onSettled: refresh,
  });
}

export function useSyncItems(filters: SyncItemFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: adminKeys.syncItems(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      adminApi.listSyncItems(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useRetrySyncItem() {
  const { organization } = useOrg();
  const refresh = useRunRefresh();
  return useMutation({
    mutationFn: (itemId: string) => adminApi.retrySyncItem(organization.id, itemId),
    onSettled: refresh,
  });
}

export function useSyncLogs(filters: SyncLogFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: adminKeys.syncLogs(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      adminApi.listSyncLogs(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useMappings(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: adminKeys.mappings(organization.id),
    queryFn: ({ signal }) => adminApi.getMappings(organization.id, signal),
    enabled: options.enabled ?? true,
  });
}

export function usePutMappings() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const refresh = useRefresh(adminKeys.integrations, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: (body: MappingsWrite) => adminApi.putMappings(organization.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<Mappings>(adminKeys.mappings(organization.id), saved);
    },
    onSettled: refresh,
  });
}

/* ----------------------------- Import and export ----------------------------- */

export function useExportClients() {
  const { organization } = useOrg();
  return useMutation({ mutationFn: () => adminApi.exportClients(organization.id) });
}

export function useImportClients() {
  const { organization } = useOrg();
  const refresh = useRefresh(
    queryKeys.org.clients,
    queryKeys.org.onboarding,
    queryKeys.org.auditLogs,
  );
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) =>
      adminApi.importClients(organization.id, file, dryRun),
    onSuccess: (result) => {
      if (!result.dry_run) refresh();
    },
  });
}
