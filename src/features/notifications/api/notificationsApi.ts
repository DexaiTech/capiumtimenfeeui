import { api } from '@/services/api';

import { BELL_PAGE_SIZE } from '../constants';
import type {
  AppNotification,
  EmailTemplate,
  EmailTemplateDraft,
  EmailTemplatePreview,
  EmailTemplatePreviewRequest,
  MarkAllResult,
  NotificationSettings,
  NotificationSettingsUpdate,
  PracticeNotificationSettings,
  PracticeNotificationSettingsUpdate,
  UnreadCount,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Typed wrappers over the notification, notification-settings and email-template endpoints
 * (`docs/modules/notifications.md` of the API). Everything is scoped to one practice.
 */
export const notificationsApi = {
  /* ------------------------------ The bell (own inbox) ------------------------------ */
  list: (organizationId: string, page: PageRequest = {}) =>
    api.list<AppNotification>(`${org(organizationId)}/notifications`, {
      query: { limit: page.limit ?? BELL_PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  unreadCount: (organizationId: string, signal?: AbortSignal) =>
    api.get<UnreadCount>(`${org(organizationId)}/notifications/unread-count`, { signal }),
  markRead: (organizationId: string, notificationId: string) =>
    api.post<AppNotification>(`${org(organizationId)}/notifications/${seg(notificationId)}/read`),
  markAllRead: (organizationId: string) =>
    api.post<MarkAllResult>(`${org(organizationId)}/notifications/read-all`),

  /* -------------------------------- Notification settings -------------------------------- */
  getSettings: (organizationId: string, signal?: AbortSignal) =>
    api.get<NotificationSettings>(`${org(organizationId)}/notification-settings`, { signal }),
  saveSettings: (organizationId: string, body: NotificationSettingsUpdate) =>
    api.put<NotificationSettings>(`${org(organizationId)}/notification-settings`, body),
  getPracticeSettings: (organizationId: string, signal?: AbortSignal) =>
    api.get<PracticeNotificationSettings>(`${org(organizationId)}/notification-settings/practice`, {
      signal,
    }),
  savePracticeSettings: (organizationId: string, body: PracticeNotificationSettingsUpdate) =>
    api.put<PracticeNotificationSettings>(
      `${org(organizationId)}/notification-settings/practice`,
      body,
    ),

  /* ----------------------------------- Email templates ----------------------------------- */
  listTemplates: (organizationId: string, signal?: AbortSignal) =>
    api.get<EmailTemplate[]>(`${org(organizationId)}/email-templates`, { signal }),
  saveTemplate: (organizationId: string, key: string, body: EmailTemplateDraft) =>
    api.put<EmailTemplate>(`${org(organizationId)}/email-templates/${seg(key)}`, body),
  /** Back to the built-in text; answers the built-in template. */
  resetTemplate: (organizationId: string, key: string) =>
    api.delete<EmailTemplate>(`${org(organizationId)}/email-templates/${seg(key)}`),
  /** Renders without saving or sending; a draft is validated like a save. */
  previewTemplate: (
    organizationId: string,
    key: string,
    body: EmailTemplatePreviewRequest,
    signal?: AbortSignal,
  ) =>
    api.post<EmailTemplatePreview>(
      `${org(organizationId)}/email-templates/${seg(key)}/preview`,
      body,
      { signal },
    ),
};
