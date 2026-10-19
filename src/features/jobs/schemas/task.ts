import * as z from 'zod';

import { formatUkDate } from '@/utils/dates';

import { LIMITS } from '../constants';
import { TASK_STATUSES, type Task, type TaskInput, type TaskUpdate } from '../types';
import { MAX_MINUTES } from './job';

export interface TaskSchemaOptions {
  /** The job's dates: a task is due within them where the job has them. */
  jobStart: string | null;
  jobDue: string | null;
}

/** The form of a task: a title, an optional description, due date and hours budget. */
export function taskSchema({ jobStart, jobDue }: TaskSchemaOptions) {
  return z
    .object({
      title: z
        .string()
        .trim()
        .min(1, 'Enter the title of the task')
        .max(LIMITS.taskTitle, `Use at most ${String(LIMITS.taskTitle)} characters`),
      description: z
        .string()
        .trim()
        .max(LIMITS.taskDescription, `Use at most ${String(LIMITS.taskDescription)} characters`),
      due_date: z.string(),
      budget_minutes: z.number().int().min(0).max(MAX_MINUTES).nullable(),
      /** A new task starts in any status; an existing one changes status from the list. */
      status: z.enum(TASK_STATUSES),
    })
    .superRefine((values, ctx) => {
      if (!values.due_date) return;
      if ((jobStart && values.due_date < jobStart) || (jobDue && values.due_date > jobDue)) {
        const span = [jobStart, jobDue]
          .map((day) => (day ? formatUkDate(day) : 'open'))
          .join(' - ');
        ctx.addIssue({
          code: 'custom',
          path: ['due_date'],
          message: `The due date must be within the dates of the job (${span})`,
        });
      }
    });
}

export type TaskValues = z.infer<ReturnType<typeof taskSchema>>;

export function taskDefaults(task: Task | null): TaskValues {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    due_date: task?.due_date ?? '',
    budget_minutes: task?.budget_minutes ?? null,
    status: task?.status ?? 'not_started',
  };
}

/** The body of `POST /jobs/{id}/tasks`; what is empty is left out. */
export function toTaskInput(values: TaskValues, assigneeIds: string[]): TaskInput {
  const input: TaskInput = { title: values.title, status: values.status };
  if (values.description) input.description = values.description;
  if (values.due_date) input.due_date = values.due_date;
  if (values.budget_minutes !== null) input.budget_minutes = values.budget_minutes;
  if (assigneeIds.length > 0) input.assignee_user_ids = assigneeIds;
  return input;
}

/** The body of `PATCH /jobs/{id}/tasks/{id}`: only what changed; null clears a value. */
export function toTaskUpdate(values: TaskValues, task: Task): TaskUpdate {
  const update: TaskUpdate = {};
  if (values.title !== task.title) update.title = values.title;
  const description = values.description === '' ? null : values.description;
  if (description !== task.description) update.description = description;
  const due = values.due_date === '' ? null : values.due_date;
  if (due !== task.due_date) update.due_date = due;
  if (values.budget_minutes !== task.budget_minutes) update.budget_minutes = values.budget_minutes;
  return update;
}
