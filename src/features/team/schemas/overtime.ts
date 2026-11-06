import * as z from 'zod';

import { parseMinutes } from '@/utils/minutes';
import { parsePounds } from '@/utils/money';
import { parseMultiplierToBp } from '@/utils/multiplier';

import { MAX_PENCE } from '../utils/format';

/** The most standard hours a period can hold: every hour of a week, or of a 31-day month. */
const MAX_MINUTES = { weekly: 168 * 60, monthly: 31 * 24 * 60 } as const;

/** New standard hours of a person, typed as h:mm or decimal hours. */
export const staffHoursSchema = z
  .object({
    basis: z.enum(['weekly', 'monthly']),
    standard_hours: z.string().trim(),
    effective_from: z.string().min(1, 'Enter the date the hours start'),
  })
  .refine(
    (values) => {
      const minutes = parseMinutes(values.standard_hours);
      return minutes !== null && minutes >= 1 && minutes <= MAX_MINUTES[values.basis];
    },
    {
      path: ['standard_hours'],
      message: 'Enter the standard hours of the period, more than 0, for example 37:30 or 37.5',
    },
  );
export type StaffHoursValues = z.infer<typeof staffHoursSchema>;

/** A new overtime rate: a grade or a person, and a multiplier of the cost rate or a fixed rate. */
export const overtimeRateSchema = z
  .object({
    level: z.enum(['grade', 'staff']),
    grade_id: z.string(),
    user_id: z.string().nullable(),
    mode: z.enum(['multiplier', 'fixed']),
    multiplier: z.string(),
    rate: z.string(),
    effective_from: z.string().min(1, 'Enter the date the rate starts'),
    effective_to: z.string(),
  })
  .refine((values) => values.level !== 'grade' || Boolean(values.grade_id), {
    path: ['grade_id'],
    message: 'Choose a grade',
  })
  .refine((values) => values.level !== 'staff' || Boolean(values.user_id), {
    path: ['user_id'],
    message: 'Choose a staff member',
  })
  .refine(
    (values) => values.mode !== 'multiplier' || parseMultiplierToBp(values.multiplier) !== null,
    {
      path: ['multiplier'],
      message: 'Enter a multiple of the cost rate from 1 to 10, for example 1.5',
    },
  )
  .refine(
    (values) => {
      if (values.mode !== 'fixed') return true;
      const pence = parsePounds(values.rate);
      return pence !== null && pence >= 0 && pence <= MAX_PENCE;
    },
    { path: ['rate'], message: 'Enter the rate in pounds per hour, for example 45.00' },
  )
  .refine(
    (values) =>
      !values.effective_to ||
      !values.effective_from ||
      values.effective_to >= values.effective_from,
    { path: ['effective_to'], message: "The end date can't be before the start date" },
  );
export type OvertimeRateValues = z.infer<typeof overtimeRateSchema>;
