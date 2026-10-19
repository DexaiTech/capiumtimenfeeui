import * as z from 'zod';

import { codeText, optionalRateText, textMax, wholeNumberText } from './common';

/** Create and edit a service. The default fee is typed in pounds; empty clears it. */
export const serviceSchema = z.object({
  code: codeText(12, 'Enter a code for the service'),
  name: z.string().trim().min(1, 'Enter the service name').max(120, 'Use at most 120 characters'),
  description: textMax(1000),
  billing_basis: z.enum(['hourly', 'fixed']),
  default_fee: optionalRateText('Enter an amount in pounds, for example 250.00'),
  default_billable: z.boolean(),
  /** A VAT code id, or empty for "no default". */
  vat_rate_id: z.string(),
  invoice_description: textMax(500),
  sort_order: wholeNumberText(0, 10_000, 'Enter a whole number from 0 to 10000'),
  /** The activity types the service is limited to; empty means every type. */
  activity_code_ids: z.array(z.string()),
});
export type ServiceValues = z.infer<typeof serviceSchema>;

/** Create and edit an activity type. */
export const activityTypeSchema = z.object({
  code: codeText(12, 'Enter a code for the activity type'),
  name: z
    .string()
    .trim()
    .min(1, 'Enter the activity type name')
    .max(120, 'Use at most 120 characters'),
  is_chargeable: z.boolean(),
  vat_rate_id: z.string(),
  invoice_description: textMax(500),
});
export type ActivityTypeValues = z.infer<typeof activityTypeSchema>;
