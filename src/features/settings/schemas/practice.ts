import * as z from 'zod';

import { parsePounds } from '@/utils/money';

/** The largest money amount the API accepts (`Money`: 0 to 10^12 pence). */
export const MONEY_MAX_PENCE = 1_000_000_000_000;

const optionalText = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

/**
 * The practice settings form (`PATCH /organizations/{id}`). Field names match the API where
 * the value is the same; `default_rate` (pounds typed, pence sent) and the text forms of
 * numbers are converted on submit. Time recording (increment, working days, timesheet
 * approval) is edited on General Settings only — see `TimeSettingsCard` — so it has no field
 * here, to avoid the same setting being changeable from two places.
 */
export const practiceSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Enter the practice name').max(120, 'Use at most 120 characters'),
  company_number: optionalText(20),
  email: z
    .string()
    .trim()
    .max(254, 'Use at most 254 characters')
    .refine((value) => value === '' || z.email().safeParse(value).success, 'Enter a valid email'),
  phone: optionalText(40),
  address_line1: optionalText(200),
  address_line2: optionalText(200),
  city: optionalText(100),
  postcode: optionalText(20),
  country: z
    .string()
    .trim()
    .refine(
      (value) => /^[A-Za-z]{2}$/.test(value),
      'Use the two-letter country code, for example GB',
    ),
  vat_registered: z.boolean(),
  vat_number: optionalText(20),
  payment_terms_days: z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,3}$/.test(value) && Number(value) <= 365,
      'Enter a number of days from 0 to 365',
    ),
  /** Pounds as typed ("95.50"); sent as pence. */
  default_rate: z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence >= 0 && pence <= MONEY_MAX_PENCE;
  }, 'Enter an hourly rate in pounds, for example 95.00'),
  bank_details: optionalText(500),
  invoice_footer: optionalText(1000),
});

export type PracticeSettingsValues = z.infer<typeof practiceSettingsSchema>;
