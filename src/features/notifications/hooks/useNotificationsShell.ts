import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ShellNotification, ShellNotifications } from '@/components/layout';
import { ORG_SEGMENTS, routes, safeNextPath } from '@/constants/routes';

import { useMarkAllRead, useMarkRead, useNotificationList, useUnreadCount } from '../api/hooks';
import { notificationKeys } from '../api/keys';
import type { AppNotification } from '../types';

/**
 * One notification for the bell. The API's `link` is a path inside the practice (relative to
 * `/{slug}`); anything that is not such a path (an absolute URL, `//host`) leads nowhere, so a
 * notification can never send the person to another site.
 */
export function toShellNotification(item: AppNotification, slug: string): ShellNotification {
  const link = safeNextPath(item.link);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    body: item.body,
    to: link ? `${routes.org.home(slug)}${link}` : null,
    read: item.is_read,
    createdAt: item.created_at,
  };
}

export interface UseNotificationsShellOptions {
  /** Null outside a practice: nothing is asked and the hook answers null. */
  organizationId: string | null;
  slug: string | null;
}

/**
 * The bell's data for the shell (`ShellData.notifications`): the unread count (polled every
 * minute and on window focus), the list (fetched only while the panel is open, newest first,
 * "load more" by cursor) and the actions. It takes the practice id because the shell sits above
 * the practice provider.
 */
export function useNotificationsShell({
  organizationId,
  slug,
}: UseNotificationsShellOptions): ShellNotifications | null {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const unread = useUnreadCount(organizationId);
  const list = useNotificationList(organizationId, open);
  const { mutate: markRead } = useMarkRead(organizationId);
  const { mutate: markAllRead, isPending: markingAllRead } = useMarkAllRead(organizationId);
  const { fetchNextPage, refetch, hasNextPage, isFetchingNextPage, isError, data } = list;

  // A new unread count means new notifications: the list is stale, and refetched when open.
  const count = unread.data;
  const shownCount = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (count === undefined) return;
    if (organizationId && shownCount.current !== undefined && shownCount.current !== count) {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.list(organizationId) });
    }
    shownCount.current = count;
  }, [count, organizationId, queryClient]);

  const items = useMemo(
    () =>
      slug
        ? (data?.pages.flatMap((page) => page.data) ?? []).map((item) =>
            toShellNotification(item, slug),
          )
        : [],
    [data, slug],
  );

  return useMemo(() => {
    if (!organizationId || !slug) return null;
    let status: ShellNotifications['status'] = 'ready';
    if (data === undefined) status = isError ? 'error' : 'loading';
    return {
      unreadCount: count ?? 0,
      items,
      status,
      hasMore: hasNextPage,
      loadingMore: isFetchingNextPage,
      markingAllRead,
      onOpenChange: setOpen,
      onSelect: (item: ShellNotification) => {
        if (!item.read) markRead(item.id);
      },
      onMarkAllRead: () => markAllRead(),
      onLoadMore: () => void fetchNextPage(),
      onRetry: () => void refetch(),
      settingsTo: routes.org.module(slug, ORG_SEGMENTS.settings, 'notifications'),
    };
  }, [
    organizationId,
    slug,
    data,
    isError,
    count,
    items,
    hasNextPage,
    isFetchingNextPage,
    markingAllRead,
    markRead,
    markAllRead,
    fetchNextPage,
    refetch,
  ]);
}
