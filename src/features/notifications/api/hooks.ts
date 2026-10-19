import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';
import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

import { UNREAD_POLL_MS } from '../constants';
import type {
  AppNotification,
  EmailTemplate,
  EmailTemplateDraft,
  NotificationSettings,
  NotificationSettingsUpdate,
  PracticeNotificationSettings,
  PracticeNotificationSettingsUpdate,
} from '../types';
import { notificationKeys } from './keys';
import { notificationsApi } from './notificationsApi';

/* ------------------------------------------------------------------------------------------- */
/* The bell. The shell sits above the practice provider, so these take the practice id.         */
/* ------------------------------------------------------------------------------------------- */

type NotificationPage = ApiResult<AppNotification[], PageMeta>;

const nextCursor = (page: NotificationPage) => page.meta?.next_cursor ?? undefined;

/**
 * The number on the bell: asked again every minute (not while the tab is hidden) and whenever
 * the window is focused, because the global default does not refetch on focus.
 */
export function useUnreadCount(organizationId: string | null) {
  const id = organizationId ?? '';
  return useQuery({
    queryKey: notificationKeys.unreadCount(id),
    queryFn: ({ signal }) => notificationsApi.unreadCount(id, signal),
    enabled: id !== '',
    refetchInterval: UNREAD_POLL_MS,
    refetchOnWindowFocus: 'always',
    select: (data) => data.count,
  });
}

/** The person's own notifications, newest first, read page by page; fetched while `enabled`. */
export function useNotificationList(organizationId: string | null, enabled: boolean) {
  const id = organizationId ?? '';
  return useInfiniteQuery({
    queryKey: notificationKeys.list(id),
    queryFn: ({ pageParam, signal }) => notificationsApi.list(id, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: enabled && id !== '',
    // Opening the bell always shows what is there now.
    staleTime: 0,
  });
}

/** Marks one notification read, then refreshes the count and the list. */
export function useMarkRead(organizationId: string | null) {
  const id = organizationId ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notificationId: string) => notificationsApi.markRead(id, notificationId),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(id) }),
  });
}

export function useMarkAllRead(organizationId: string | null) {
  const id = organizationId ?? '';
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all(id) }),
  });
}

/* ------------------------------------------------------------------------------------------- */
/* Settings: the person's own choices, and the practice's switches and defaults.                */
/* ------------------------------------------------------------------------------------------- */

export function useNotificationSettings() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: notificationKeys.settings(organization.id),
    queryFn: ({ signal }) => notificationsApi.getSettings(organization.id, signal),
  });
}

export function useSaveNotificationSettings() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NotificationSettingsUpdate) =>
      notificationsApi.saveSettings(organization.id, body),
    onSuccess: (saved) =>
      queryClient.setQueryData<NotificationSettings>(
        notificationKeys.settings(organization.id),
        saved,
      ),
  });
}

/** Needs `organization.update` or `settings.manage`; pass `enabled` false for anyone else. */
export function usePracticeNotificationSettings(enabled: boolean) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: notificationKeys.practiceSettings(organization.id),
    queryFn: ({ signal }) => notificationsApi.getPracticeSettings(organization.id, signal),
    enabled,
  });
}

export function useSavePracticeNotificationSettings() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: PracticeNotificationSettingsUpdate) =>
      notificationsApi.savePracticeSettings(organization.id, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<PracticeNotificationSettings>(
        notificationKeys.practiceSettings(organization.id),
        saved,
      );
      // A switch or a default changes what the person's own matrix shows.
      void queryClient.invalidateQueries({ queryKey: notificationKeys.settings(organization.id) });
    },
  });
}

/* ------------------------------------------------------------------------------------------- */
/* Email templates.                                                                             */
/* ------------------------------------------------------------------------------------------- */

export function useEmailTemplates() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: notificationKeys.templates(organization.id),
    queryFn: ({ signal }) => notificationsApi.listTemplates(organization.id, signal),
  });
}

/** Puts a saved or reset template in the list without another request. */
function useReplaceTemplate() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return (saved: EmailTemplate) =>
    queryClient.setQueryData<EmailTemplate[]>(notificationKeys.templates(organization.id), (list) =>
      list?.map((entry) => (entry.key === saved.key ? saved : entry)),
    );
}

export function useSaveEmailTemplate() {
  const { organization } = useOrg();
  const replace = useReplaceTemplate();
  return useMutation({
    mutationFn: ({ key, draft }: { key: string; draft: EmailTemplateDraft }) =>
      notificationsApi.saveTemplate(organization.id, key, draft),
    onSuccess: replace,
  });
}

export function useResetEmailTemplate() {
  const { organization } = useOrg();
  const replace = useReplaceTemplate();
  return useMutation({
    mutationFn: (key: string) => notificationsApi.resetTemplate(organization.id, key),
    onSuccess: replace,
  });
}

/**
 * The email as it would be sent, for a draft. The draft should already be debounced by the
 * caller. An invalid draft answers 422 with the same problems a save would report.
 */
export function useTemplatePreview(key: string, draft: EmailTemplateDraft) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: notificationKeys.preview(organization.id, key, draft),
    queryFn: ({ signal }) => notificationsApi.previewTemplate(organization.id, key, draft, signal),
    retry: false,
    // A preview of the same text never changes while the page is open.
    staleTime: Infinity,
    gcTime: 60_000,
  });
}
