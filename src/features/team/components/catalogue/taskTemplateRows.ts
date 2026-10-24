import type { TaskTemplate, TaskTemplateInput } from '../../types';

/** At most this many default tasks per service (the API answers 422 for more). */
export const MAX_TEMPLATES = 100;
export const MAX_TITLE = 200;
export const MAX_DESCRIPTION = 2000;
export const MAX_OFFSET_DAYS = 3650;
/** The most an hours budget may be, in minutes (as for the budget of a job). */
export const MAX_BUDGET_MINUTES = 10_000_000;

/** One default task as it is edited: the offset stays text until it is validated. */
export interface TemplateRow {
  /** Identifies the row while it is edited (not sent). */
  key: string;
  title: string;
  description: string;
  budget_minutes: number | null;
  /** Whole days as typed; empty for no due date. */
  due_offset_days: string;
}

export interface TemplateRowErrors {
  title?: string;
  description?: string;
  due_offset_days?: string;
}

let counter = 0;

export function newRow(title = ''): TemplateRow {
  counter += 1;
  return {
    key: `new-${String(counter)}`,
    title,
    description: '',
    budget_minutes: null,
    due_offset_days: '',
  };
}

export function rowsFromTemplates(templates: ReadonlyArray<TaskTemplate>): TemplateRow[] {
  return templates.map((template) => ({
    key: template.id,
    title: template.title,
    description: template.description ?? '',
    budget_minutes: template.budget_minutes,
    due_offset_days: template.due_offset_days === null ? '' : String(template.due_offset_days),
  }));
}

/** The body of `PUT …/task-templates`, in the order of the rows. Call after validating. */
export function toTemplateInputs(rows: ReadonlyArray<TemplateRow>): TaskTemplateInput[] {
  return rows.map((row) => ({
    title: row.title.trim(),
    description: row.description.trim() === '' ? null : row.description.trim(),
    budget_minutes: row.budget_minutes,
    due_offset_days: row.due_offset_days.trim() === '' ? null : Number(row.due_offset_days),
  }));
}

/** The errors of each row (an empty object for a valid one), in row order. */
export function validateRows(rows: ReadonlyArray<TemplateRow>): TemplateRowErrors[] {
  return rows.map((row) => {
    const errors: TemplateRowErrors = {};
    const title = row.title.trim();
    if (title === '') errors.title = 'Enter the task title';
    else if (title.length > MAX_TITLE) errors.title = `Use at most ${String(MAX_TITLE)} characters`;
    if (row.description.trim().length > MAX_DESCRIPTION) {
      errors.description = `Use at most ${String(MAX_DESCRIPTION)} characters`;
    }
    const days = row.due_offset_days.trim();
    if (days !== '' && !(/^\d{1,4}$/.test(days) && Number(days) <= MAX_OFFSET_DAYS)) {
      errors.due_offset_days = `Enter a whole number of days from 0 to ${String(MAX_OFFSET_DAYS)}`;
    }
    return errors;
  });
}

export const hasErrors = (errors: ReadonlyArray<TemplateRowErrors>) =>
  errors.some((entry) => Object.keys(entry).length > 0);
