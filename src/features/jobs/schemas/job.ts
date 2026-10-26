import * as z from 'zod';

import { parsePounds, penceToPoundsInput } from '@/utils/money';

import { LIMITS } from '../constants';
import { BILLING_BASES, type Job, type JobInput, type JobUpdate } from '../types';

/** The most an amount may be (the API's `Money`): 10,000,000,000.00. */
export const MAX_PENCE = 1_000_000_000_000;
/** The most a duration may be (the API's `Minutes`). */
export const MAX_MINUTES = 10_000_000;

const AMOUNT_MESSAGE = 'Enter an amount in pounds, for example 1500.00';

const atMost = (max: number) => `Use at most ${String(max)} characters`;

/** Pounds as typed → pence; null for empty or unreadable. */
function pence(text: string): number | null {
  const value = parsePounds(text);
  return value !== null && value >= 0 && value <= MAX_PENCE ? value : null;
}

const blank = (text: string) => text.trim() === '';
const money = (text: string): number | null => (blank(text) ? null : pence(text));
const orNull = (text: string): string | null => (text === '' ? null : text);

/** The form of a job. Money is typed in pounds, the hours budget as a duration; empty is "none". */
export const jobSchema = z
  .object({
    client_id: z.string().min(1, 'Choose the client'),
    name: z
      .string()
      .trim()
      .min(1, 'Enter the name of the job')
      .max(LIMITS.jobName, atMost(LIMITS.jobName)),
    description: z.string().trim().max(LIMITS.jobDescription, atMost(LIMITS.jobDescription)),
    /** A service id, or empty for none. */
    service_id: z.string(),
    billing_basis: z.enum(BILLING_BASES),
    /** Pounds; only a fixed-fee job has one. */
    fixed_fee: z.string(),
    /** Pounds; overrides every other charge-out rate for time on the job. */
    hourly_rate: z.string(),
    budget_minutes: z.number().int().min(0).max(MAX_MINUTES).nullable(),
    budget_fee: z.string(),
    /** Pounds; the cost the work is expected to take. */
    budget_cost: z.string(),
    start_date: z.string(),
    due_date: z.string(),
    period_start: z.string(),
    period_end: z.string(),
    partner_user_id: z.string(),
    manager_user_id: z.string(),
    /** A new job starts not started or in progress. */
    status: z.enum(['planned', 'in_progress']),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });

    for (const field of ['fixed_fee', 'hourly_rate', 'budget_fee', 'budget_cost'] as const) {
      if (!blank(values[field]) && pence(values[field]) === null) issue(field, AMOUNT_MESSAGE);
    }
    if (values.start_date && values.due_date && values.start_date > values.due_date) {
      issue('due_date', 'The due date cannot be before the start date');
    }
    if (values.period_start && values.period_end && values.period_start > values.period_end) {
      issue('period_end', 'The period cannot end before it starts');
    }
  });

export type JobValues = z.infer<typeof jobSchema>;

/** The form's starting values: a new job, or the job being edited. */
export function jobDefaults(job: Job | null, clientId = ''): JobValues {
  return {
    client_id: job?.client_id ?? clientId,
    name: job?.name ?? '',
    description: job?.description ?? '',
    service_id: job?.service_id ?? '',
    billing_basis: job?.billing_basis ?? 'hourly',
    fixed_fee: penceToPoundsInput(job?.fixed_fee),
    hourly_rate: penceToPoundsInput(job?.hourly_rate),
    budget_minutes: job?.budget_minutes ?? null,
    budget_fee: penceToPoundsInput(job?.budget_fee),
    budget_cost: penceToPoundsInput(job?.budget_cost),
    start_date: job?.start_date ?? '',
    due_date: job?.due_date ?? '',
    period_start: job?.period_start ?? '',
    period_end: job?.period_end ?? '',
    partner_user_id: job?.partner_user_id ?? '',
    manager_user_id: job?.manager_user_id ?? '',
    status: 'planned',
  };
}

/** The body of `POST /jobs`: what is empty is left out, so the API's defaults apply. */
export function toJobInput(values: JobValues): JobInput {
  const input: JobInput = {
    client_id: values.client_id,
    name: values.name,
    billing_basis: values.billing_basis,
    status: values.status,
  };
  if (values.description) input.description = values.description;
  if (values.service_id) input.service_id = values.service_id;
  const fixedFee = values.billing_basis === 'fixed' ? money(values.fixed_fee) : null;
  if (fixedFee !== null) input.fixed_fee = fixedFee;
  const hourlyRate = values.billing_basis === 'hourly' ? money(values.hourly_rate) : null;
  if (hourlyRate !== null) input.hourly_rate = hourlyRate;
  if (values.budget_minutes !== null) input.budget_minutes = values.budget_minutes;
  const budgetFee = money(values.budget_fee);
  if (budgetFee !== null) input.budget_fee = budgetFee;
  const budgetCost = money(values.budget_cost);
  if (budgetCost !== null) input.budget_cost = budgetCost;
  for (const field of [
    'start_date',
    'due_date',
    'period_start',
    'period_end',
    'partner_user_id',
    'manager_user_id',
  ] as const) {
    if (values[field]) input[field] = values[field];
  }
  return input;
}

/** The body of `PATCH /jobs/{id}`: only what changed; null clears a value. */
export function toJobUpdate(values: JobValues, job: Job): JobUpdate {
  const next: JobUpdate = {
    name: values.name,
    description: orNull(values.description),
    service_id: orNull(values.service_id),
    billing_basis: values.billing_basis,
    fixed_fee: values.billing_basis === 'fixed' ? money(values.fixed_fee) : null,
    hourly_rate: values.billing_basis === 'hourly' ? money(values.hourly_rate) : null,
    budget_minutes: values.budget_minutes,
    budget_fee: money(values.budget_fee),
    budget_cost: money(values.budget_cost),
    period_start: orNull(values.period_start),
    period_end: orNull(values.period_end),
    start_date: orNull(values.start_date),
    due_date: orNull(values.due_date),
    partner_user_id: orNull(values.partner_user_id),
    manager_user_id: orNull(values.manager_user_id),
  };
  const changes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(next)) {
    if (value !== job[key as keyof Job]) changes[key] = value;
  }
  return changes;
}

/** The form of "copy this job": what the copy changes, and what comes along. */
export const copySchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter the name of the new job')
      .max(LIMITS.jobName, atMost(LIMITS.jobName)),
    client_id: z.string().min(1, 'Choose the client'),
    start_date: z.string(),
    due_date: z.string(),
    copy_tasks: z.boolean(),
    copy_assignees: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (values.start_date && values.due_date && values.start_date > values.due_date) {
      ctx.addIssue({
        code: 'custom',
        path: ['due_date'],
        message: 'The due date cannot be before the start date',
      });
    }
  });

export type CopyValues = z.infer<typeof copySchema>;
