import type {
  AppNotification,
  EmailTemplate,
  NotificationPreference,
  NotificationSettings,
  PracticeNotificationSettings,
  PracticeNotificationType,
} from '../types';

let counter = 0;

/** A notification of the signed-in person; the defaults are an unread approval request. */
export function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  counter += 1;
  return {
    id: `0198c1f2-0000-7000-8000-00000000${String(counter).padStart(4, '0')}`,
    type: 'approval_pending',
    title: 'Timesheet waiting for approval',
    body: 'Pat Person submitted their timesheet for the week starting 07/09/2026 (1:30 hours).',
    link: '/time/approvals',
    entity_type: 'timesheet',
    entity_id: '0198c1f2-0000-7000-8000-0000000000e1',
    payload: { week_start: '2026-09-07', total_minutes: 90 },
    is_read: false,
    read_at: null,
    created_at: '2026-10-18T09:00:00Z',
    ...overrides,
  };
}

const CATALOGUE: ReadonlyArray<{ type: string; label: string; description: string }> = [
  {
    type: 'timesheet_reminder',
    label: 'Timesheet reminder',
    description: 'A reminder to submit your timesheet.',
  },
  {
    type: 'timesheet_returned',
    label: 'Timesheet returned',
    description: 'Your timesheet was sent back to you.',
  },
  {
    type: 'approval_pending',
    label: 'Approval pending',
    description: 'A timesheet is waiting for your approval.',
  },
  {
    type: 'budget_alert',
    label: 'Budget alert',
    description: 'A job has used a set share of its budget.',
  },
  {
    type: 'invoice_delivery',
    label: 'Invoice delivery',
    description: 'An invoice you sent was delivered.',
  },
  {
    type: 'payment_reminder',
    label: 'Payment reminder',
    description: 'An invoice is overdue.',
  },
  {
    type: 'failed_job',
    label: 'Failed background job',
    description: 'A background job failed for good.',
  },
];

/** The person's own settings: in-app and email on (invoice delivery: in-app only), SMS off. */
export function ownSettings(
  overrides: Partial<Record<string, Partial<NotificationPreference>>> = {},
  smsNumber: string | null = null,
): NotificationSettings {
  return {
    sms_number: smsNumber,
    preferences: CATALOGUE.map((entry) => ({
      ...entry,
      enabled: true,
      in_app: true,
      email: entry.type !== 'invoice_delivery',
      sms: false,
      customised: false,
      ...overrides[entry.type],
    })),
  };
}

export function practiceSettings(
  overrides: Partial<Record<string, Partial<PracticeNotificationType>>> = {},
): PracticeNotificationSettings {
  return {
    types: CATALOGUE.map((entry) => ({
      ...entry,
      enabled: true,
      in_app: true,
      email: entry.type !== 'invoice_delivery',
      sms: false,
      ...overrides[entry.type],
    })),
  };
}

const COMMON_FIELDS = [
  {
    name: 'recipient_name',
    label: 'Recipient name',
    description: 'Who the email is for.',
    sample: 'Ada Admin',
  },
  {
    name: 'practice_name',
    label: 'Practice name',
    description: 'The practice.',
    sample: 'Acme Accountants',
  },
];

export const budgetAlertTemplate: EmailTemplate = {
  key: 'budget_alert',
  name: 'Budget alert',
  description: 'Warns when a job has used a set share of its budget.',
  category: 'notification',
  audience: 'internal',
  notification_type: 'budget_alert',
  merge_fields: [
    ...COMMON_FIELDS,
    {
      name: 'job_name',
      label: 'Job name',
      description: 'The job concerned.',
      sample: 'Year-end accounts 2026',
    },
    {
      name: 'budget_percent',
      label: 'Budget used',
      description: 'The share of the budget used.',
      sample: '80',
    },
  ],
  required_fields: [],
  customised: false,
  subject: 'Budget alert: {{ job_name }}',
  html_body:
    '<p>Hello {{ recipient_name }}, the job has used {{ budget_percent }}% of its budget.</p>',
  text_body: 'Hello {{ recipient_name }}, the job has used {{ budget_percent }}% of its budget.',
  updated_at: null,
  updated_by: null,
  updated_by_name: null,
};

export const invoiceTemplate: EmailTemplate = {
  key: 'invoice',
  name: 'Invoice email',
  description: 'The email that carries an invoice to the client.',
  category: 'system',
  audience: 'external',
  notification_type: null,
  merge_fields: [
    ...COMMON_FIELDS,
    {
      name: 'invoice_number',
      label: 'Invoice number',
      description: 'The number of the invoice.',
      sample: 'INV-0042',
    },
  ],
  required_fields: [],
  customised: true,
  subject: 'Invoice {{ invoice_number }} from {{ practice_name }}',
  html_body: '<p>Please find invoice {{ invoice_number }} attached.</p>',
  text_body: 'Please find invoice {{ invoice_number }} attached.',
  updated_at: '2026-10-18T09:05:00Z',
  updated_by: '0198c1f2-0000-7000-8000-0000000000c1',
  updated_by_name: 'Ada Admin',
};

export const invitationTemplate: EmailTemplate = {
  key: 'staff_invitation',
  name: 'Staff invitation',
  description: 'The email that invites a member of staff.',
  category: 'system',
  audience: 'internal',
  notification_type: null,
  merge_fields: [
    ...COMMON_FIELDS,
    {
      name: 'link',
      label: 'Link',
      description: 'The one-time link.',
      sample: 'https://app.example/invite/abc',
    },
  ],
  required_fields: ['link'],
  customised: false,
  subject: 'You are invited to {{ practice_name }}',
  html_body: '<p>Hello {{ recipient_name }}, <a href="{{ link }}">accept</a>.</p>',
  text_body: 'Hello {{ recipient_name }}, accept here: {{ link }}',
  updated_at: null,
  updated_by: null,
  updated_by_name: null,
};

export const allTemplates: ReadonlyArray<EmailTemplate> = [
  budgetAlertTemplate,
  invoiceTemplate,
  invitationTemplate,
];
