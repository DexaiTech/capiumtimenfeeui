import * as z from 'zod';

import { formatUkDate } from '@/utils/dates';

import { MAPPING_CODE_PATTERN } from '../utils/integrations';

export const REASON_MAX = 500;
/** The API refuses a lock earlier than this (`EARLIEST_LOCK_DATE`). */
export const EARLIEST_LOCK_DATE = '2000-01-01';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const reasonOf = (required: boolean) => {
  const text = z.string().trim().max(REASON_MAX, `Use at most ${REASON_MAX} characters`);
  return required ? text.min(1, 'Say why the period is reopened') : text;
};

/** Locking a period: a day after the lock there is now, and not after today. */
export function lockSchema(currentLock: string | null, today: string) {
  return z.object({
    locked_through: z.string().superRefine((value, ctx) => {
      const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
      if (!ISO_DATE.test(value)) issue('Choose the last day to lock');
      else if (value < EARLIEST_LOCK_DATE) issue('Choose a day from 01/01/2000');
      else if (value > today) issue('Choose a day that is not in the future');
      else if (currentLock !== null && value <= currentLock) {
        issue(`Choose a day after ${formatUkDate(currentLock)}, which is already locked`);
      }
    }),
    reason: reasonOf(false),
  });
}
export type LockValues = z.infer<ReturnType<typeof lockSchema>>;

export const REOPEN_MODES = ['to_date', 'remove'] as const;

/** Reopening: back to an earlier day or the lock removed altogether, always with a reason. */
export function reopenSchema(currentLock: string) {
  return z
    .object({
      mode: z.enum(REOPEN_MODES),
      reopen_to: z.string(),
      reason: reasonOf(true),
    })
    .superRefine((values, ctx) => {
      if (values.mode !== 'to_date') return;
      const issue = (message: string) =>
        ctx.addIssue({ code: 'custom', path: ['reopen_to'], message });
      if (!ISO_DATE.test(values.reopen_to)) issue('Choose the new last locked day');
      else if (values.reopen_to < EARLIEST_LOCK_DATE) issue('Choose a day from 01/01/2000');
      else if (values.reopen_to >= currentLock) {
        issue(`Choose a day before ${formatUkDate(currentLock)}, the day locked through now`);
      }
    });
}
export type ReopenValues = z.infer<ReturnType<typeof reopenSchema>>;

/** A code of the bookkeeping system, or nothing: a row without one is not mapped. */
const mappingCode = z
  .string()
  .trim()
  .refine(
    (value) => value === '' || MAPPING_CODE_PATTERN.test(value),
    'Use letters, digits and . _ / - (1 to 20 characters)',
  );
const mappingName = z.string().trim().max(120, 'Use at most 120 characters');

/** The bookkeeping mappings: an account code per service and a tax code per VAT code. */
export const mappingsSchema = z.object({
  services: z.array(
    z.object({
      service_id: z.string().nullable(),
      account_code: mappingCode,
      account_name: mappingName,
    }),
  ),
  vat_rates: z.array(
    z.object({
      vat_rate_id: z.string().nullable(),
      tax_code: mappingCode,
      tax_name: mappingName,
    }),
  ),
});
export type MappingsValues = z.infer<typeof mappingsSchema>;
