import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import { api } from '@/services/api';

import { CLIENT_PAGE_SIZE } from '../constants';
import type {
  Lead,
  LeadConvert,
  LeadCreate,
  LeadListParams,
  LeadSummary,
  LeadUpdate,
} from '../leads/types';
import { clientKeys, nextCursor, org, seg } from './clients';

/** Typed wrappers over the lead endpoints (`app/api/v1/leads.py`). */
export const leadsApi = {
  list: (
    organizationId: string,
    params: LeadListParams,
    page: { cursor?: string; signal?: AbortSignal } = {},
  ) =>
    api.list<Lead>(`${org(organizationId)}/leads`, {
      query: {
        status: params.status,
        q: params.q.trim() || undefined,
        limit: CLIENT_PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  summary: (organizationId: string, signal?: AbortSignal) =>
    api.get<LeadSummary>(`${org(organizationId)}/leads/summary`, { signal }),
  create: (organizationId: string, body: LeadCreate) =>
    api.post<Lead>(`${org(organizationId)}/leads`, body),
  update: (organizationId: string, leadId: string, body: LeadUpdate) =>
    api.patch<Lead>(`${org(organizationId)}/leads/${seg(leadId)}`, body),
  archive: (organizationId: string, leadId: string) =>
    api.post<Lead>(`${org(organizationId)}/leads/${seg(leadId)}/archive`),
  unarchive: (organizationId: string, leadId: string) =>
    api.post<Lead>(`${org(organizationId)}/leads/${seg(leadId)}/unarchive`),
  convert: (organizationId: string, leadId: string, body: LeadConvert = {}) =>
    api.post<Lead>(`${org(organizationId)}/leads/${seg(leadId)}/convert`, body),
};

/** Every key of lead data sits under `queryKeys.org.leads`. */
export const leadKeys = {
  all: (organizationId: string) => queryKeys.org.leads(organizationId),
  list: (organizationId: string, params: LeadListParams) =>
    [...queryKeys.org.leads(organizationId), 'list', params] as const,
  summary: (organizationId: string) => [...queryKeys.org.leads(organizationId), 'summary'] as const,
};

/** One status of leads, newest first, a page at a time. */
export function useLeadList(params: LeadListParams) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: leadKeys.list(organization.id, params),
    queryFn: ({ pageParam, signal }) =>
      leadsApi.list(organization.id, params, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** The count and the costs of the open, converted and archived leads. */
export function useLeadSummary() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: leadKeys.summary(organization.id),
    queryFn: ({ signal }) => leadsApi.summary(organization.id, signal),
  });
}

/** Marks the leads (and the audit log) stale after a change; only what is shown is refetched. */
function useRefreshLeads() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => {
    void queryClient.invalidateQueries({ queryKey: leadKeys.all(organization.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.org.auditLogs(organization.id) });
  };
}

export function useCreateLead() {
  const { organization } = useOrg();
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: (body: LeadCreate) => leadsApi.create(organization.id, body),
    onSettled: refresh,
  });
}

/** Changes a lead: PATCH with the fields to change (the costs stay editable once converted). */
export function useUpdateLead() {
  const { organization } = useOrg();
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: ({ leadId, body }: { leadId: string; body: LeadUpdate }) =>
      leadsApi.update(organization.id, leadId, body),
    onSettled: refresh,
  });
}

/** Archives (`archived: true`) or unarchives a lead. */
export function useArchiveLead() {
  const { organization } = useOrg();
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: ({ leadId, archived }: { leadId: string; archived: boolean }) =>
      archived
        ? leadsApi.archive(organization.id, leadId)
        : leadsApi.unarchive(organization.id, leadId),
    onSettled: refresh,
  });
}

/** Turns a lead into a client in one step; the client list and its counts change too. */
export function useConvertLead() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const refresh = useRefreshLeads();
  return useMutation({
    mutationFn: ({ leadId, body }: { leadId: string; body?: LeadConvert }) =>
      leadsApi.convert(organization.id, leadId, body),
    onSettled: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: clientKeys.all(organization.id) });
    },
  });
}
