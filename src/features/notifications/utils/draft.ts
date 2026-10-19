import type { EmailTemplate, EmailTemplateDraft } from '../types';

/** The three editable texts of a template. */
export function draftOf(template: EmailTemplate): EmailTemplateDraft {
  return {
    subject: template.subject,
    html_body: template.html_body,
    text_body: template.text_body,
  };
}

export function sameDraft(a: EmailTemplateDraft, b: EmailTemplateDraft): boolean {
  return a.subject === b.subject && a.html_body === b.html_body && a.text_body === b.text_body;
}

/** `{{ name }}`: how a merge field is written in a template. */
export const mergeToken = (name: string) => `{{ ${name} }}`;

/** Replaces the selection (or inserts at the caret) and says where the caret goes afterwards. */
export function insertAtSelection(
  text: string,
  start: number,
  end: number,
  insertion: string,
): { text: string; caret: number } {
  const from = Math.max(0, Math.min(start, text.length));
  const to = Math.max(from, Math.min(end, text.length));
  return { text: text.slice(0, from) + insertion + text.slice(to), caret: from + insertion.length };
}
