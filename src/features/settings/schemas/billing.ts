import * as z from 'zod';

import {
  NEXT_NUMBER_MAX,
  PADDING_MAX,
  PADDING_MIN,
  PREFIX_MAX_LENGTH,
  PREFIX_PATTERN,
} from '../utils/numbering';
import { FOOTER_MAX, LAYOUTS, TEMPLATE_NAME_MAX } from '../utils/templates';
import { parsePercentToBp, VAT_CODES } from '../utils/vat';

/** Characters as the API counts them (code points), so an emoji is one. */
const length = (value: string) => Array.from(value).length;

/** Create and edit a VAT code. The rate is typed as a percentage; the API takes basis points. */
export const vatRateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the VAT code')
    .max(60, 'Use at most 60 characters'),
  code: z.enum(VAT_CODES, 'Choose the VAT treatment'),
  rate: z
    .string()
    .refine(
      (value) => parsePercentToBp(value) !== null,
      'Enter a rate from 0 to 100, with at most two decimals',
    ),
  /** Only offered when adding. */
  is_default: z.boolean(),
});
export type VatRateValues = z.infer<typeof vatRateSchema>;

/**
 * The numbering of one document kind. `minNext` is the next number the sequence has now, for the
 * kinds that only move forward: a lower one is refused here as the API would refuse it.
 */
export function numberingSchema(minNext: number | null) {
  return z.object({
    prefix: z
      .string()
      .trim()
      .max(PREFIX_MAX_LENGTH, `Use at most ${PREFIX_MAX_LENGTH} characters`)
      .regex(PREFIX_PATTERN, 'Use letters, digits, "-", "_" or "/" only'),
    padding: z
      .string()
      .trim()
      .refine(
        (value) =>
          /^\d{1,2}$/.test(value) && Number(value) >= PADDING_MIN && Number(value) <= PADDING_MAX,
        `Enter a whole number from ${PADDING_MIN} to ${PADDING_MAX}`,
      ),
    next_number: z
      .string()
      .trim()
      .superRefine((value, ctx) => {
        const number = Number(value);
        if (!/^\d{1,10}$/.test(value) || number < 1 || number > NEXT_NUMBER_MAX) {
          ctx.addIssue({
            code: 'custom',
            message: `Enter a whole number from 1 to ${NEXT_NUMBER_MAX.toLocaleString('en-GB')}`,
          });
        } else if (minNext !== null && number < minNext) {
          ctx.addIssue({
            code: 'custom',
            message: `Numbers only move forward. The next number is already ${minNext}: enter ${minNext} or higher.`,
          });
        }
      }),
  });
}
export type NumberingValues = z.infer<ReturnType<typeof numberingSchema>>;

/** Create and edit an invoice template. A blank footer means none. */
export const invoiceTemplateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the template')
    .max(TEMPLATE_NAME_MAX, `Use at most ${TEMPLATE_NAME_MAX} characters`),
  layout: z.enum(LAYOUTS, 'Choose a layout'),
  show_logo: z.boolean(),
  show_bank_details: z.boolean(),
  footer_text: z
    .string()
    .trim()
    .refine((value) => length(value) <= FOOTER_MAX, `Use at most ${FOOTER_MAX} characters`),
});
export type InvoiceTemplateValues = z.infer<typeof invoiceTemplateSchema>;
