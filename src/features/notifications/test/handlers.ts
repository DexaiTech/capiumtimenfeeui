import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  AppNotification,
  EmailTemplate,
  EmailTemplateDraft,
  EmailTemplatePreviewRequest,
  NotificationSettings,
  NotificationSettingsUpdate,
  PracticeNotificationSettings,
  PracticeNotificationSettingsUpdate,
} from '../types';
import { allTemplates, ownSettings, practiceSettings } from './fixtures';

export { orgApiPath };

/** What the built-in text of every template is, as the API answers after a reset. */
export const DEFAULT_TEXT: EmailTemplateDraft = {
  subject: 'Default subject for {{ practice_name }}',
  html_body: '<p>Default body</p>',
  text_body: 'Default body',
};

/** The requests the fake API has seen, for assertions on exact bodies and counts. */
export interface Calls {
  unreadCounts: number;
  lists: URLSearchParams[];
  read: string[];
  readAll: number;
  savedSettings: NotificationSettingsUpdate[];
  practiceReads: number;
  savedPractice: PracticeNotificationSettingsUpdate[];
  templateLists: number;
  savedTemplates: Array<{ key: string; body: EmailTemplateDraft }>;
  resets: string[];
  previews: Array<{ key: string; body: EmailTemplatePreviewRequest }>;
}

/** A small in-memory stand-in for the notification endpoints; tests read and change its state. */
export interface Backend {
  /** Newest first. */
  notifications: AppNotification[];
  pageSize: number;
  settings: NotificationSettings;
  practice: PracticeNotificationSettings;
  templates: EmailTemplate[];
  calls: Calls;
}

export function createBackend(initial: Partial<Omit<Backend, 'calls'>> = {}): Backend {
  return {
    notifications: [],
    pageSize: 20,
    settings: ownSettings(),
    practice: practiceSettings(),
    templates: allTemplates.map((template) => ({ ...template })),
    ...initial,
    calls: {
      unreadCounts: 0,
      lists: [],
      read: [],
      readAll: 0,
      savedSettings: [],
      practiceReads: 0,
      savedPractice: [],
      templateLists: 0,
      savedTemplates: [],
      resets: [],
      previews: [],
    },
  };
}

const PLACEHOLDER = /\{\{\s*([^{}]*?)\s*\}\}/g;

/** The problems the API reports for a draft (a few of its codes are enough for the UI). */
export function templateProblems(template: EmailTemplate, draft: EmailTemplateDraft) {
  const problems: Array<{ field: string; code: string; message: string }> = [];
  const known = new Set(template.merge_fields.map((field) => field.name));
  for (const part of ['subject', 'html_body', 'text_body'] as const) {
    for (const match of draft[part].matchAll(PLACEHOLDER)) {
      const name = match[1] ?? '';
      if (!/^[a-z_]+$/.test(name)) {
        problems.push({
          field: part,
          code: 'invalid_placeholder',
          message: `"${name}" is not a plain merge field name.`,
        });
      } else if (!known.has(name)) {
        problems.push({
          field: part,
          code: 'unknown_merge_field',
          message: `{{ ${name} }} is not a merge field of this email.`,
        });
      }
    }
  }
  for (const name of template.required_fields) {
    if (!draft.html_body.includes(name) && !draft.text_body.includes(name)) {
      problems.push({
        field: 'html_body',
        code: 'missing_merge_field',
        message: `{{ ${name} }} must appear in the HTML or the plain text.`,
      });
    }
  }
  return problems;
}

function render(template: EmailTemplate, text: string): string {
  return text.replace(PLACEHOLDER, (_match, name: string) => {
    return template.merge_fields.find((field) => field.name === name)?.sample ?? '';
  });
}

const invalidNumber = (value: string) => {
  const digits = value.replace(/[\s\-.()]/g, '').replace(/^\+/, '');
  return !/^[0-9]{7,15}$/.test(digits);
};

/** Handlers for every notification endpoint of the practice, backed by `backend`. */
export function notificationHandlers(backend: Backend): HttpHandler[] {
  const { calls } = backend;
  const unread = () => backend.notifications.filter((entry) => !entry.is_read).length;
  const templateOf = (key: unknown) => backend.templates.find((entry) => entry.key === key);

  return [
    http.get(orgApiPath('/notifications/unread-count'), () => {
      calls.unreadCounts += 1;
      return ok({ count: unread() });
    }),
    http.get(orgApiPath('/notifications'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      calls.lists.push(params);
      const offset = Number(params.get('cursor') ?? '0');
      const size = backend.pageSize;
      const page = backend.notifications.slice(offset, offset + size);
      const more = offset + size < backend.notifications.length;
      return ok(page, {
        meta: { next_cursor: more ? String(offset + size) : null, has_more: more },
      });
    }),
    http.post(orgApiPath('/notifications/read-all'), () => {
      calls.readAll += 1;
      const updated = unread();
      backend.notifications.forEach((entry) => {
        entry.is_read = true;
      });
      return ok({ updated });
    }),
    http.post(orgApiPath('/notifications/:id/read'), ({ params }) => {
      const id = String(params.id);
      calls.read.push(id);
      const found = backend.notifications.find((entry) => entry.id === id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Notification not found.');
      found.is_read = true;
      found.read_at = '2026-10-18T10:00:00Z';
      return ok(found);
    }),

    http.get(orgApiPath('/notification-settings/practice'), () => {
      calls.practiceReads += 1;
      return ok(backend.practice);
    }),
    http.put(orgApiPath('/notification-settings/practice'), async ({ request }) => {
      const body = (await request.json()) as PracticeNotificationSettingsUpdate;
      calls.savedPractice.push(body);
      for (const change of body.types) {
        const entry = backend.practice.types.find((item) => item.type === change.type);
        if (entry) Object.assign(entry, change);
        // A type the practice switched off is locked in the person's own matrix.
        const own = backend.settings.preferences.find((item) => item.type === change.type);
        if (own) own.enabled = change.enabled;
      }
      return ok(backend.practice);
    }),
    http.get(orgApiPath('/notification-settings'), () => ok(backend.settings)),
    http.put(orgApiPath('/notification-settings'), async ({ request }) => {
      const body = (await request.json()) as NotificationSettingsUpdate;
      calls.savedSettings.push(body);
      const number =
        body.sms_number === undefined
          ? backend.settings.sms_number
          : body.sms_number?.trim() || null;
      if (number !== null && invalidNumber(number)) {
        return fail(422, 'VALIDATION_ERROR', 'Validation failed.', {
          details: [
            { field: 'sms_number', code: 'invalid', message: 'Enter a valid mobile number.' },
          ],
        });
      }
      const wantsSms = (body.preferences ?? []).some((choice) => choice.sms);
      if (wantsSms && number === null) {
        return fail(422, 'VALIDATION_ERROR', 'Validation failed.', {
          details: [
            {
              field: 'sms_number',
              code: 'required',
              message: 'Add a mobile number to receive SMS.',
            },
          ],
        });
      }
      for (const choice of body.preferences ?? []) {
        const entry = backend.settings.preferences.find((item) => item.type === choice.type);
        if (entry) Object.assign(entry, choice, { customised: true });
      }
      backend.settings.sms_number = number;
      return ok(backend.settings);
    }),

    http.get(orgApiPath('/email-templates'), () => {
      calls.templateLists += 1;
      return ok(backend.templates);
    }),
    http.put(orgApiPath('/email-templates/:key'), async ({ params, request }) => {
      const template = templateOf(params.key);
      if (!template) return fail(404, 'RESOURCE_NOT_FOUND', 'Template not found.');
      const body = (await request.json()) as EmailTemplateDraft;
      calls.savedTemplates.push({ key: template.key, body });
      const problems = templateProblems(template, body);
      if (problems.length > 0) {
        return fail(422, 'VALIDATION_ERROR', 'The template is not valid.', { details: problems });
      }
      Object.assign(template, body, {
        customised: true,
        updated_at: '2026-10-19T10:00:00Z',
        updated_by_name: 'Ada Admin',
      });
      return ok(template);
    }),
    http.delete(orgApiPath('/email-templates/:key'), ({ params }) => {
      const template = templateOf(params.key);
      if (!template) return fail(404, 'RESOURCE_NOT_FOUND', 'Template not found.');
      calls.resets.push(template.key);
      Object.assign(template, DEFAULT_TEXT, {
        customised: false,
        updated_at: null,
        updated_by: null,
        updated_by_name: null,
      });
      return ok(template);
    }),
    http.post(orgApiPath('/email-templates/:key/preview'), async ({ params, request }) => {
      const template = templateOf(params.key);
      if (!template) return fail(404, 'RESOURCE_NOT_FOUND', 'Template not found.');
      const body = (await request.json()) as EmailTemplatePreviewRequest;
      calls.previews.push({ key: template.key, body });
      const draft: EmailTemplateDraft = {
        subject: body.subject ?? template.subject,
        html_body: body.html_body ?? template.html_body,
        text_body: body.text_body ?? template.text_body,
      };
      const problems = templateProblems(template, draft);
      if (problems.length > 0) {
        return fail(422, 'VALIDATION_ERROR', 'The template is not valid.', { details: problems });
      }
      return ok({
        subject: render(template, draft.subject),
        html: `<!doctype html><html><body>${render(template, draft.html_body)}</body></html>`,
        text: render(template, draft.text_body),
        values: Object.fromEntries(
          template.merge_fields.map((field) => [field.name, field.sample]),
        ),
      });
    }),
  ];
}
