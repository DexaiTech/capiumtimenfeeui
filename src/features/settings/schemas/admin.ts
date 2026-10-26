import * as z from 'zod';

import type { LockedPeriod } from '../adminTypes';
import { MAPPING_CODE_PATTERN } from '../utils/integrations';
import { lockBlocker } from '../utils/periodLock';

export const REASON_MAX = 500;
/** The API refuses a year before this (`EARLIEST_LOCK_YEAR`). */
export const EARLIEST_LOCK_YEAR = 2000;

const reasonOf = (required: boolean) => {
  const text = z.string().trim().max(REASON_MAX, `Use at most ${REASON_MAX} characters`);
  return required ? text.min(1, 'Say why the period is unlocked') : text;
};

export const LOCK_TYPES = ['month', 'quarter', 'year'] as const;

/** Locking a month, quarter or year that has ended and does not overlap a locked one. */
export function lockSchema(periods: ReadonlyArray<LockedPeriod>, today: string) {
  return z
    .object({
      period_type: z.enum(LOCK_TYPES),
      year: z.string(),
      period: z.string(),
      reason: reasonOf(false),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });
      const year = Number(values.year);
      if (!Number.isInteger(year) || year < EARLIEST_LOCK_YEAR) {
        issue('year', `Choose a year from ${String(EARLIEST_LOCK_YEAR)}`);
        return;
      }
      const index = values.period_type === 'year' ? 1 : Number(values.period);
      const max = values.period_type === 'quarter' ? 4 : 12;
      if (!Number.isInteger(index) || index < 1 || index > max) {
        issue('period', `Choose the ${values.period_type}`);
        return;
      }
      const blocker = lockBlocker(periods, values.period_type, year, index, today);
      if (blocker)
        issue(values.period_type === 'year' ? 'year' : 'period', `That period is ${blocker}`);
    });
}
export type LockValues = z.infer<ReturnType<typeof lockSchema>>;

/** Unlocking a period: always with a reason. */
export const unlockSchema = z.object({ reason: reasonOf(true) });
export type UnlockValues = z.infer<typeof unlockSchema>;

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
