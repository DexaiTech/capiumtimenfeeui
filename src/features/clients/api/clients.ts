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
import { api, type ApiResult } from '@/services/api';
import type { BulkResult } from '@/types';
import type { PageMeta } from '@/types/api';

import { CLIENT_PAGE_SIZE } from '../constants';
import type {
  ClientBulkRequest,
  ClientCreate,
  ClientDetail,
  ClientListItem,
  ClientListParams,
  ClientServiceCreate,
  ClientServiceRead,
  ClientServiceUpdate,
  EngagementJobCreated,
  EngagementJobRun,
  ClientSummary,
  ClientUpdate,
  ContactCreate,
  ContactRead,
  ContactUpdate,
  ImportResult,
  MemberRead,
  ServiceRead,
} from '../types';

/** `/organizations/{id}`: the prefix of every practice endpoint. */
export const org = (organizationId: string) =>
  `/organizations/${encodeURIComponent(organizationId)}`;
export const seg = encodeURIComponent;

export type Page<TItem> = ApiResult<TItem[], PageMeta>;

/** The list/export query parameters of `GET /clients` (empty values are left out). */
export function listQuery(params: ClientListParams) {
  const { filters } = params;
  const q = params.q.trim();
  return {
    q: q || undefined,
    status: filters.status,
    segment: filters.segment,
    client_type: filters.client_type,
    accounting_software: filters.accounting_software,
    service_id: filters.service_id ?? undefined,
    manager_user_id: filters.manager_user_id ?? undefined,
    partner_user_id: filters.partner_user_id ?? undefined,
    central: filters.central ?? undefined,
    sort: params.sort,
    order: params.order,
  };
}

/** Typed wrappers over the clients endpoints (`app/api/v1/clients.py`). */
export const clientsApi = {
  list: (
    organizationId: string,
    params: ClientListParams,
    page: { cursor?: string; signal?: AbortSignal; limit?: number } = {},
  ) =>
    api.list<ClientListItem>(`${org(organizationId)}/clients`, {
      query: { ...listQuery(params), limit: page.limit ?? CLIENT_PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  summary: (organizationId: string, signal?: AbortSignal) =>
    api.get<ClientSummary>(`${org(organizationId)}/clients/summary`, { signal }),
  get: (organizationId: string, clientId: string, signal?: AbortSignal) =>
    api.get<ClientDetail>(`${org(organizationId)}/clients/${seg(clientId)}`, { signal }),
  create: (organizationId: string, body: ClientCreate) =>
    api.post<ClientDetail>(`${org(organizationId)}/clients`, body),
  update: (organizationId: string, clientId: string, body: ClientUpdate) =>
    api.patch<ClientDetail>(`${org(organizationId)}/clients/${seg(clientId)}`, body),
  archive: (organizationId: string, clientId: string) =>
    api.post<ClientDetail>(`${org(organizationId)}/clients/${seg(clientId)}/archive`),
  bulk: (organizationId: string, body: ClientBulkRequest) =>
    api.post<BulkResult<ClientBulkRequest['action']>>(`${org(organizationId)}/clients/bulk`, body),
  remove: (organizationId: string, clientId: string) =>
    api.delete<null>(`${org(organizationId)}/clients/${seg(clientId)}`),

  /** The CSV of every client matching the filters, read with the Bearer header. */
  exportCsv: (organizationId: string, params: ClientListParams) =>
    api.getBlob(`${org(organizationId)}/clients/export`, {
      query: { ...listQuery(params), format: 'csv' },
      accept: 'text/csv',
    }),
  importCsv: (organizationId: string, file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return api.upload<ImportResult>(`${org(organizationId)}/imports/clients`, body, {
      query: { dry_run: dryRun },
    });
  },

  createContact: (organizationId: string, clientId: string, body: ContactCreate) =>
    api.post<ContactRead>(`${org(organizationId)}/clients/${seg(clientId)}/contacts`, body),
  updateContact: (
    organizationId: string,
    clientId: string,
    contactId: string,
    body: ContactUpdate,
  ) =>
    api.patch<ContactRead>(
      `${org(organizationId)}/clients/${seg(clientId)}/contacts/${seg(contactId)}`,
      body,
    ),
  deleteContact: (organizationId: string, clientId: string, contactId: string) =>
    api.delete<null>(`${org(organizationId)}/clients/${seg(clientId)}/contacts/${seg(contactId)}`),

  createEngagement: (organizationId: string, clientId: string, body: ClientServiceCreate) =>
    api.post<ClientServiceRead>(`${org(organizationId)}/clients/${seg(clientId)}/services`, body),
  updateEngagement: (
    organizationId: string,
    clientId: string,
    engagementId: string,
    body: ClientServiceUpdate,
  ) =>
    api.patch<ClientServiceRead>(
      `${org(organizationId)}/clients/${seg(clientId)}/services/${seg(engagementId)}`,
      body,
    ),
  createEngagementJob: (organizationId: string, clientId: string, engagementId: string) =>
    api.post<EngagementJobCreated>(
      `${org(organizationId)}/clients/${seg(clientId)}/services/${seg(engagementId)}/create-job`,
    ),
  listEngagementJobRuns: (
    organizationId: string,
    clientId: string,
    engagementId: string,
    signal?: AbortSignal,
  ) =>
    api.get<EngagementJobRun[]>(
      `${org(organizationId)}/clients/${seg(clientId)}/services/${seg(engagementId)}/job-runs`,
      { signal },
    ),
  deleteEngagement: (organizationId: string, clientId: string, engagementId: string) =>
    api.delete<null>(
      `${org(organizationId)}/clients/${seg(clientId)}/services/${seg(engagementId)}`,
    ),

  /** Live services of the practice (bounded list). */
  listServices: (organizationId: string, signal?: AbortSignal) =>
    api.get<ServiceRead[]>(`${org(organizationId)}/services`, { signal }),
  listMembers: (
    organizationId: string,
    query: { q?: string; status?: string[]; cursor?: string; limit?: number },
    signal?: AbortSignal,
  ) =>
    api.list<MemberRead>(`${org(organizationId)}/members`, {
      query: { ...query, limit: query.limit ?? 100 },
      signal,
    }),
};

/* ------------------------------------ Keys ------------------------------------ */

/**
 * Every key of client data sits under `['org', organizationId, 'clients', …]` (the
 * `queryKeys.org.clients` convention), so leaving a practice drops it with the rest.
 */
export const clientKeys = {
  all: (organizationId: string) => queryKeys.org.clients(organizationId),
  lists: (organizationId: string) => [...queryKeys.org.clients(organizationId), 'list'] as const,
  list: (organizationId: string, params: ClientListParams) =>
    [...queryKeys.org.clients(organizationId), 'list', params] as const,
  summary: (organizationId: string) =>
    [...queryKeys.org.clients(organizationId), 'summary'] as const,
  detail: (organizationId: string, clientId: string) =>
    [...queryKeys.org.clients(organizationId), 'detail', clientId] as const,
  services: (organizationId: string) =>
    [...queryKeys.org.clients(organizationId), 'service-options'] as const,
  jobRuns: (organizationId: string, clientId: string, engagementId: string) =>
    [...queryKeys.org.clients(organizationId), 'job-runs', clientId, engagementId] as const,
  /** The Client 360 figures behind the tabs and the Overview. */
  overview: (organizationId: string, clientId: string) =>
    [...queryKeys.org.clients(organizationId), 'overview', clientId] as const,
  /** The client's expenses (disbursements, and later expense claims). */
  expenses: (organizationId: string, clientId: string, filters?: unknown) =>
    [...queryKeys.org.clients(organizationId), 'expenses', clientId, filters ?? null] as const,
  vatRates: (organizationId: string) =>
    [...queryKeys.org.clients(organizationId), 'vat-rates'] as const,
  invoiceTemplates: (organizationId: string) =>
    [...queryKeys.org.clients(organizationId), 'invoice-templates'] as const,
  /** The central client service: searches and the cache of what it answered. */
  central: (organizationId: string) =>
    [...queryKeys.org.clients(organizationId), 'central'] as const,
  centralSearch: (organizationId: string, q: string) =>
    [...queryKeys.org.clients(organizationId), 'central', 'search', q] as const,
  /** Under the members key, so a staff change made in settings refreshes it. */
  staff: (organizationId: string) =>
    [...queryKeys.org.members(organizationId), 'clients-directory'] as const,
  staffList: (organizationId: string, q: string) =>
    [...queryKeys.org.members(organizationId), 'clients-users-tab', q] as const,
  /** The ClientPicker's lookups (`q`, statuses) and the name of one chosen client. */
  lookup: (organizationId: string, q: string, statuses: readonly string[]) =>
    [...queryKeys.org.clients(organizationId), 'lookup', q, statuses] as const,
  option: (organizationId: string, clientId: string) =>
    [...queryKeys.org.clients(organizationId), 'option', clientId] as const,
};

/* ------------------------------------ Reads ------------------------------------ */

export function flattenPages<TItem>(data: InfiniteData<Page<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** `getNextPageParam` of every cursor list of this feature. */
export const nextCursor = <TItem>(last: Page<TItem>) =>
  last.meta?.has_more ? (last.meta.next_cursor ?? undefined) : undefined;

export function useClientList(params: ClientListParams) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: clientKeys.list(organization.id, params),
    queryFn: ({ pageParam, signal }) =>
      clientsApi.list(organization.id, params, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useClientSummary() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.summary(organization.id),
    queryFn: ({ signal }) => clientsApi.summary(organization.id, signal),
    staleTime: 30_000,
  });
}

export function useClient(clientId: string | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.detail(organization.id, clientId ?? ''),
    queryFn: ({ signal }) => clientsApi.get(organization.id, clientId ?? '', signal),
    enabled: Boolean(clientId),
  });
}

export function useServiceOptions(enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.services(organization.id),
    queryFn: ({ signal }) => clientsApi.listServices(organization.id, signal),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/** Every active member (the manager/partner pickers and name lookups), following the cursor. */
export function useStaffDirectory() {
  const { organization, can } = useOrg();
  return useQuery({
    queryKey: clientKeys.staff(organization.id),
    queryFn: async ({ signal }) => {
      const rows: MemberRead[] = [];
      let cursor: string | undefined;
      // Staff lists are small; the loop is bounded by the API's has_more.
      for (let guard = 0; guard < 50; guard += 1) {
        const page = await clientsApi.listMembers(
          organization.id,
          { status: ['active'], cursor },
          signal,
        );
        rows.push(...page.data);
        if (!page.meta?.has_more || !page.meta.next_cursor) break;
        cursor = page.meta.next_cursor;
      }
      return rows;
    },
    enabled: can('member.read'),
    staleTime: 5 * 60_000,
  });
}

/** The Users tab: members in the list style, searchable. */
export function useStaffList(q: string, enabled: boolean) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: clientKeys.staffList(organization.id, q),
    queryFn: ({ pageParam, signal }) =>
      clientsApi.listMembers(
        organization.id,
        { q: q.trim() || undefined, cursor: pageParam, limit: CLIENT_PAGE_SIZE },
        signal,
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/* ---------------------------------- Mutations ---------------------------------- */

/** Invalidates every client query of the practice (lists, summary and details). */
export function useInvalidateClients() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => queryClient.invalidateQueries({ queryKey: clientKeys.all(organization.id) });
}

export function useCreateClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (body: ClientCreate) => clientsApi.create(organization.id, body),
    onSuccess: invalidate,
  });
}

export function useUpdateClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: ClientUpdate }) =>
      clientsApi.update(organization.id, clientId, body),
    onSuccess: invalidate,
  });
}

export function useArchiveClient() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (clientId: string) => clientsApi.archive(organization.id, clientId),
    onSuccess: invalidate,
  });
}

/** One action on the selected clients (archive included): all or nothing (`POST /clients/bulk`). */
export function useBulkClients() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: (body: ClientBulkRequest) => clientsApi.bulk(organization.id, body),
    onSettled: invalidate,
  });
}

export function useDeleteClient() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) => clientsApi.remove(organization.id, clientId),
    onSuccess: async (_data, clientId) => {
      queryClient.removeQueries({ queryKey: clientKeys.detail(organization.id, clientId) });
      await queryClient.invalidateQueries({ queryKey: clientKeys.all(organization.id) });
    },
  });
}

export function useCreateContact() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: ContactCreate }) =>
      clientsApi.createContact(organization.id, clientId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateContact() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({
      clientId,
      contactId,
      body,
    }: {
      clientId: string;
      contactId: string;
      body: ContactUpdate;
    }) => clientsApi.updateContact(organization.id, clientId, contactId, body),
    onSuccess: invalidate,
  });
}

export function useDeleteContact() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, contactId }: { clientId: string; contactId: string }) =>
      clientsApi.deleteContact(organization.id, clientId, contactId),
    onSuccess: invalidate,
  });
}

export function useCreateEngagement() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: ClientServiceCreate }) =>
      clientsApi.createEngagement(organization.id, clientId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateEngagement() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({
      clientId,
      engagementId,
      body,
    }: {
      clientId: string;
      engagementId: string;
      body: ClientServiceUpdate;
    }) => clientsApi.updateEngagement(organization.id, clientId, engagementId, body),
    onSuccess: invalidate,
  });
}

/** Create the job of the engagement's next period now; refreshes the clients, the jobs and the runs. */
export function useCreateEngagementJob() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ clientId, engagementId }: { clientId: string; engagementId: string }) =>
      clientsApi.createEngagementJob(organization.id, clientId, engagementId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: clientKeys.all(organization.id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.org.jobs(organization.id) }),
      ]);
    },
  });
}

/** The jobs an engagement created (newest first); loads only once `enabled`. */
export function useEngagementJobRuns(clientId: string, engagementId: string, enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.jobRuns(organization.id, clientId, engagementId),
    queryFn: ({ signal }) =>
      clientsApi.listEngagementJobRuns(organization.id, clientId, engagementId, signal),
    enabled,
  });
}

export function useDeleteEngagement() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ clientId, engagementId }: { clientId: string; engagementId: string }) =>
      clientsApi.deleteEngagement(organization.id, clientId, engagementId),
    onSuccess: invalidate,
  });
}

export function useImportClients() {
  const { organization } = useOrg();
  const invalidate = useInvalidateClients();
  return useMutation({
    mutationFn: ({ file, dryRun }: { file: File; dryRun: boolean }) =>
      clientsApi.importCsv(organization.id, file, dryRun),
    onSuccess: async (result) => {
      if (!result.dry_run) await invalidate();
    },
  });
}

export function useExportClients() {
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (params: ClientListParams) => clientsApi.exportCsv(organization.id, params),
  });
}
