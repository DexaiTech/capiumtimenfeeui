import * as z from 'zod';

import { MAPPING_CODE_PATTERN } from '../utils/integrations';

export const REASON_MAX = 500;

const reasonOf = (required: boolean) => {
  const text = z.string().trim().max(REASON_MAX, `Use at most ${REASON_MAX} characters`);
  return required ? text.min(1, 'Say why the period is unlocked') : text;
};

export const LOCK_GRANULARITIES = ['weekly', 'monthly', 'quarterly', 'annually'] as const;

/** How the practice locks, and the day its accounting year starts (1-28 of any month). */
export const lockSettingsSchema = z.object({
  granularity: z.enum(LOCK_GRANULARITIES),
  financial_year_start_month: z.string(),
  financial_year_start_day: z
    .string()
    .trim()
    .refine((value) => /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 28, {
      message: 'Use a day from 1 to 28',
    }),
});
export type LockSettingsValues = z.infer<typeof lockSettingsSchema>;

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
