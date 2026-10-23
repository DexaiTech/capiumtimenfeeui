import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { TagCreate, TicketTag } from '../types';
import { useTicketInvalidation } from './invalidation';
import { ticketKeys } from './keys';
import { nextCursor } from './pages';
import { ticketsApi } from './ticketsApi';

/** The practice's tags (at most 200, sorted by name), for the filter, the pickers and the chips. */
export function useTicketTags() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: ticketKeys.tags(organization.id),
    queryFn: ({ signal }) => ticketsApi.listTags(organization.id, signal),
    staleTime: 30_000,
  });
}

/** A new tag (grey unless a colour is given); it joins the cached list at once, in name order. */
export function useCreateTicketTag() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (body: TagCreate) => ticketsApi.createTag(organization.id, body),
    onSuccess: (tag) => {
      queryClient.setQueryData<TicketTag[]>(ticketKeys.tags(organization.id), (tags) =>
        tags
          ? [...tags, tag].sort((a, b) =>
              a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
            )
          : tags,
      );
    },
    onSettled: () => invalidate.tags(),
  });
}

/** The comments of a ticket, oldest first, a page at a time. */
export function useTicketComments(ticketId: string) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: ticketKeys.comments(organization.id, ticketId),
    queryFn: ({ pageParam, signal }) =>
      ticketsApi.listComments(organization.id, ticketId, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}

export function useAddComment(ticketId: string) {
  const { organization } = useOrg();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (body: { body: string; body_html?: string; attachment_ids?: string[] }) =>
      ticketsApi.addComment(organization.id, ticketId, body),
    onSettled: () => invalidate.comments(ticketId),
  });
}

export function useDeleteAttachment(ticketId: string) {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useTicketInvalidation();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      ticketsApi.removeAttachment(organization.id, ticketId, attachmentId),
    onSuccess: (_result, attachmentId) => {
      queryClient.removeQueries({
        queryKey: ticketKeys.file(organization.id, ticketId, attachmentId),
      });
    },
    onSettled: () => invalidate.attachments(ticketId),
  });
}

/** What happened to a ticket, newest first, a page at a time. */
export function useTicketTimeline(ticketId: string) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: ticketKeys.timeline(organization.id, ticketId),
    queryFn: ({ pageParam, signal }) =>
      ticketsApi.timeline(organization.id, ticketId, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
  });
}
