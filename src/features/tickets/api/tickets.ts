import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryKey,
} from '@tanstack/react-query';
import { useCallback } from 'react';

import { useOrg } from '@/features/organizations';

import type {
  BulkRequest,
  DashboardRange,
  TagRef,
  TicketCreate,
  TicketDashboard,
  TicketDetail,
  TicketFilters,
  TicketListItem,
  TicketUpdate,
} from '../types';
import { useTicketInvalidation } from './invalidation';
import { ticketKeys } from './keys';
import { mapListItems, nextCursor, type ListData } from './pages';
import { ticketsApi } from './ticketsApi';

/** The list, a page at a time (cursor); the rows of the previous filters stay until the new ones arrive. */
export function useTickets(filters: TicketFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: ticketKeys.list(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      ticketsApi.list(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useTicket(ticketId: string | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: ticketKeys.detail(organization.id, ticketId ?? ''),
    queryFn: ({ signal }) => ticketsApi.get(organization.id, ticketId ?? '', signal),
    enabled: Boolean(ticketId),
  });
}

/** The dashboard of a range (the last 19 days without one); the previous range shows meanwhile. */
export function useTicketDashboard(range: DashboardRange) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: ticketKeys.dashboard(organization.id, range),
    queryFn: ({ signal }) => ticketsApi.dashboard(organization.id, range, signal),
    placeholderData: keepPreviousData,
  });
}

type Snapshot = Array<[QueryKey, unknown]>;
type TicketPatch = Partial<Pick<TicketListItem, 'status' | 'priority' | 'tags'>>;
type Taggable = { tags: TagRef[] };

/**
 * Optimistic changes: the patch is written into every cached copy of the ticket (the lists, the
 * detail, the dashboard's recent tickets) at once, and `rollback` puts the old copies back when
 * the request fails.
 */
function useOptimisticTicket() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;

  const apply = useCallback(
    async (ticketId: string, derive: (item: Taggable) => TicketPatch): Promise<Snapshot> => {
      const scopes = [
        ticketKeys.lists(id),
        ticketKeys.detail(id, ticketId),
        ticketKeys.dashboards(id),
      ];
      // A refetch that lands now would overwrite the change that is being made.
      await Promise.all(scopes.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      const snapshot = scopes.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
      const patched = <TItem extends Taggable>(item: TItem): TItem => ({
        ...item,
        ...derive(item),
      });
      queryClient.setQueriesData<ListData<TicketListItem>>(
        { queryKey: ticketKeys.lists(id) },
        (data) =>
          mapListItems(
            data,
            (item) => item.id === ticketId,
            (item) => patched(item),
          ),
      );
      queryClient.setQueryData<TicketDetail>(ticketKeys.detail(id, ticketId), (detail) =>
        detail ? patched(detail) : detail,
      );
      queryClient.setQueriesData<TicketDashboard>(
        { queryKey: ticketKeys.dashboards(id) },
        (dashboard) =>
          dashboard
            ? {
                ...dashboard,
                recent: dashboard.recent.map((item) =>
                  item.id === ticketId ? patched(item) : item,
                ),
              }
            : dashboard,
      );
      return snapshot;
    },
    [queryClient, id],
  );

  const rollback = useCallback(
    (snapshot: Snapshot | undefined) => {
      for (const [queryKey, data] of snapshot ?? []) queryClient.setQueryData(queryKey, data);
    },
    [queryClient],
  );

  return { apply, rollback };
}

export function useCreateTicket() {
  const { organization } = useOrg();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (body: TicketCreate) => ticketsApi.create(organization.id, body),
    onSuccess: () => invalidate.tickets(),
  });
}

/**
 * PATCH a ticket. A new status or priority shows at once (the inline selects) and is put back
 * when the request fails; the response then replaces the cached detail.
 */
export function useUpdateTicket() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();
  const optimistic = useOptimisticTicket();
  const id = organization.id;

  return useMutation({
    mutationFn: ({ ticketId, body }: { ticketId: string; body: TicketUpdate }) =>
      ticketsApi.update(id, ticketId, body),
    onMutate: async ({ ticketId, body }): Promise<Snapshot> => {
      const patch: TicketPatch = {};
      if (body.status) patch.status = body.status;
      if (body.priority) patch.priority = body.priority;
      return Object.keys(patch).length > 0 ? optimistic.apply(ticketId, () => patch) : [];
    },
    onError: (_error, _variables, snapshot) => optimistic.rollback(snapshot),
    onSuccess: (ticket) => {
      queryClient.setQueryData(ticketKeys.detail(id, ticket.id), ticket);
      queryClient.setQueriesData<ListData<TicketListItem>>(
        { queryKey: ticketKeys.lists(id) },
        (data) =>
          mapListItems(
            data,
            (item) => item.id === ticket.id,
            (item) => ({
              ...item,
              subject: ticket.subject,
              status: ticket.status,
              priority: ticket.priority,
              tags: ticket.tags,
              updated_at: ticket.updated_at,
              closed_at: ticket.closed_at,
            }),
          ),
      );
    },
    onSettled: (_data, _error, { ticketId }) => invalidate.ticket(ticketId),
  });
}

/** Adds or takes off one tag with a bulk call, which (unlike a PATCH of all tags) cannot race. */
export function useToggleTicketTag() {
  const { organization } = useOrg();
  const invalidate = useTicketInvalidation();
  const optimistic = useOptimisticTicket();

  return useMutation({
    mutationFn: ({ ticketId, tag, add }: { ticketId: string; tag: TagRef; add: boolean }) =>
      ticketsApi.bulk(organization.id, {
        ticket_ids: [ticketId],
        action: add ? 'add_tag' : 'remove_tag',
        value: tag.id,
      }),
    onMutate: ({ ticketId, tag, add }) =>
      optimistic.apply(ticketId, ({ tags }) => ({
        tags: add
          ? [...tags.filter((entry) => entry.id !== tag.id), tag].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            )
          : tags.filter((entry) => entry.id !== tag.id),
      })),
    onError: (_error, _variables, snapshot) => optimistic.rollback(snapshot),
    onSettled: (_data, _error, { ticketId }) => invalidate.ticket(ticketId),
  });
}

export function useDeleteTicket() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (ticketId: string) => ticketsApi.remove(organization.id, ticketId),
    onSuccess: (_result, ticketId) => {
      queryClient.removeQueries({ queryKey: ticketKeys.detail(organization.id, ticketId) });
      invalidate.tickets();
    },
  });
}

/** One action on the selected tickets: all or nothing (the API's bulk endpoint). */
export function useBulkTickets() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (body: BulkRequest) => ticketsApi.bulk(organization.id, body),
    onSuccess: (_result, body) => {
      if (body.action !== 'delete') return;
      for (const ticketId of body.ticket_ids) {
        queryClient.removeQueries({ queryKey: ticketKeys.detail(organization.id, ticketId) });
      }
    },
    onSettled: () => invalidate.tickets(),
  });
}
