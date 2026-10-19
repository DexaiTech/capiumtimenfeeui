import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { ticketKeys } from './keys';

/**
 * What to refresh after each kind of change. Everything is only marked stale and refetched when
 * something shows it. The cached bytes of files are never invalidated: a file does not change.
 */
export function useTicketInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;

  return useMemo(() => {
    const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };
    const audit = queryKeys.org.auditLogs(id);
    return {
      /** One ticket changed: its lists, itself, the dashboard, the tags' counts, the audit log. */
      ticket: (ticketId: string) =>
        refresh(
          ticketKeys.lists(id),
          ticketKeys.detail(id, ticketId),
          ticketKeys.dashboards(id),
          ticketKeys.tags(id),
          audit,
        ),
      /** Many tickets changed or went (a bulk action, a delete). */
      tickets: () =>
        refresh(
          ticketKeys.lists(id),
          ticketKeys.details(id),
          ticketKeys.dashboards(id),
          ticketKeys.tags(id),
          audit,
        ),
      /** A comment changed: the thread, the ticket (its count and files) and the lists' counts. */
      comments: (ticketId: string) =>
        refresh(
          ticketKeys.comments(id, ticketId),
          ticketKeys.detail(id, ticketId),
          ticketKeys.lists(id),
          audit,
        ),
      /** A file came or went: the ticket, its comments and the lists' counts. */
      attachments: (ticketId: string) =>
        refresh(
          ticketKeys.detail(id, ticketId),
          ticketKeys.comments(id, ticketId),
          ticketKeys.lists(id),
          audit,
        ),
      /** A tag came: the tag list (no ticket changes with it). */
      tags: () => refresh(ticketKeys.tags(id)),
    };
  }, [queryClient, id]);
}
