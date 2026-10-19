import { queryKeys } from '@/constants/queryKeys';

import type { EmailTemplateDraft } from '../types';

/** Keys of the notification data, all under `['org', organizationId, …]`. */
export const notificationKeys = {
  /** Everything of the bell: the count and the list. */
  all: (organizationId: string) => queryKeys.org.notifications(organizationId),
  unreadCount: (organizationId: string) =>
    [...queryKeys.org.notifications(organizationId), 'unread-count'] as const,
  list: (organizationId: string) =>
    [...queryKeys.org.notifications(organizationId), 'list'] as const,

  settings: (organizationId: string) =>
    [...queryKeys.org.notificationSettings(organizationId), 'own'] as const,
  practiceSettings: (organizationId: string) =>
    [...queryKeys.org.notificationSettings(organizationId), 'practice'] as const,

  templates: (organizationId: string) =>
    [...queryKeys.org.emailTemplates(organizationId), 'list'] as const,
  preview: (organizationId: string, key: string, draft: EmailTemplateDraft) =>
    [...queryKeys.org.emailTemplates(organizationId), 'preview', key, draft] as const,
};
