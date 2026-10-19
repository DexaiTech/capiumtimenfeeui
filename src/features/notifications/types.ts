/**
 * Shapes of the notification endpoints (`capiumtimenfeeapi/docs/modules/notifications.md`).
 * Ids are strings, timestamps are ISO 8601 UTC, every text is plain text.
 */

/** One notification of the signed-in person's own inbox (the bell). */
export interface AppNotification {
  id: string;
  /** A code of the catalogue, for example `budget_alert`. The bell picks an icon from it. */
  type: string;
  title: string;
  body: string;
  /** A path inside the practice's app, relative to `/{slug}` (starts with one `/`), or null. */
  link: string | null;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface UnreadCount {
  count: number;
}

export interface MarkAllResult {
  updated: number;
}

/** The three places a notification can reach a person. */
export type Channel = 'in_app' | 'email' | 'sms';

/** The person's setting of one notification type (`GET /notification-settings`). */
export interface NotificationPreference {
  type: string;
  label: string;
  description: string;
  /** False when the practice has switched the type off: nothing is sent whatever the choice. */
  enabled: boolean;
  in_app: boolean;
  email: boolean;
  sms: boolean;
  /** True when the person made the choice; false when they inherit the practice's default. */
  customised: boolean;
}

export interface NotificationSettings {
  /** The mobile number SMS goes to, in this practice. */
  sms_number: string | null;
  /** Every type of the catalogue, in the catalogue's order. */
  preferences: NotificationPreference[];
}

export interface PreferenceChoice {
  type: string;
  in_app: boolean;
  email: boolean;
  sms: boolean;
}

/** Types that are not listed keep the person's choice; an omitted number is unchanged. */
export interface NotificationSettingsUpdate {
  preferences?: PreferenceChoice[];
  /** Null or blank clears the number. */
  sms_number?: string | null;
}

/** One type as the practice has it set (`GET /notification-settings/practice`). */
export interface PracticeNotificationType {
  type: string;
  label: string;
  description: string;
  /** Switches the type on or off for the whole practice. */
  enabled: boolean;
  /** The channels people get until they choose their own. */
  in_app: boolean;
  email: boolean;
  sms: boolean;
}

export interface PracticeNotificationSettings {
  types: PracticeNotificationType[];
}

export interface PracticeTypeChoice {
  type: string;
  enabled: boolean;
  in_app: boolean;
  email: boolean;
  sms: boolean;
}

export interface PracticeNotificationSettingsUpdate {
  types: PracticeTypeChoice[];
}

/** A `{{ name }}` an email template may use. */
export interface MergeField {
  name: string;
  label: string;
  description: string;
  /** What a preview shows for it. */
  sample: string;
}

export type TemplateCategory = 'notification' | 'system';

export interface EmailTemplate {
  key: string;
  name: string;
  description: string;
  category: TemplateCategory;
  /** The notification type the email belongs to; null for a system email. */
  notification_type: string | null;
  merge_fields: MergeField[];
  /** Fields that must appear in the HTML or the text body. */
  required_fields: string[];
  /** True when the practice has its own version; false shows the built-in text. */
  customised: boolean;
  subject: string;
  html_body: string;
  text_body: string;
  updated_at: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
}

export interface EmailTemplateDraft {
  subject: string;
  html_body: string;
  text_body: string;
}

export type TemplatePart = keyof EmailTemplateDraft;

export interface EmailTemplatePreviewRequest extends Partial<EmailTemplateDraft> {
  values?: Record<string, string>;
}

export interface EmailTemplatePreview {
  subject: string;
  /** The complete email as it would be sent: shown in a sandboxed frame. */
  html: string;
  text: string;
  values: Record<string, string>;
}
