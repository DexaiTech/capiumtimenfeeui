import * as z from 'zod';

import { FIXED_FEE_WIP_MODES, RATE_MODES, TIME_INCREMENTS } from '@/types/organization';
import { parseMultiplierToBp } from '@/utils/multiplier';
import { hoursToMinutes } from '@/utils/minutes';
import { parsePounds } from '@/utils/money';

import { parsePercentToBp } from '../utils/vat';
import {
  MARKUP_MAX_BP,
  MILEAGE_MAX_PENCE,
  REMINDER_BEFORE_MAX,
  REMINDER_DAYS_MAX,
  THRESHOLD_MAX_PENCE,
  parseMarkupToBp,
} from '../utils/general';

/** An amount typed in pounds that must fit the API's pence range. */
const pounds = (maxPence: number, message: string) =>
  z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence >= 0 && pence <= maxPence;
  }, message);

const THRESHOLD_MESSAGE = 'Enter an amount in pounds from 0 to 1,000,000.00, for example 500.00';

/** Time recording: `time_increment_minutes`, `minutes_per_day`, `week_start`, `working_days`. */
export const timeSettingsSchema = z.object({
  time_increment_minutes: z.enum(
    TIME_INCREMENTS.map(String) as [string, ...string[]],
    'Choose a time increment',
  ),
  /** Typed as hours; stored by the API as `minutes_per_day`. */
  hours_per_day: z.string().refine((value) => {
    const minutes = hoursToMinutes(value);
    return minutes !== null && minutes >= 1 && minutes <= 1440;
  }, 'Enter the working hours of a day, more than 0 and at most 24'),
  /** A select value: '1' (Monday) to '7' (Sunday). */
  week_start: z.enum(['1', '2', '3', '4', '5', '6', '7'], 'Choose the first day of the week'),
  working_days: z.array(z.number().int().min(1).max(7)).min(1, 'Choose at least one working day'),
  require_timesheet_approval: z.boolean(),
  auto_approve_privileged_time: z.boolean(),
});
export type TimeSettingsValues = z.infer<typeof timeSettingsSchema>;

/** WIP and billing: the fixed-fee rule, the approval thresholds and the payment reminders. */
export const billingSettingsSchema = z.object({
  fixed_fee_wip_mode: z.enum(FIXED_FEE_WIP_MODES, 'Choose when a fixed fee counts as WIP'),
  wip_adjustment_approval_threshold: pounds(THRESHOLD_MAX_PENCE, THRESHOLD_MESSAGE),
  wip_write_off_percent_enabled: z.boolean(),
  wip_write_off_approval_threshold_percent: z.string().refine((value) => {
    const bp = parsePercentToBp(value);
    return bp !== null;
  }, 'Enter a percentage from 0 to 100, for example 10 or 12.5'),
  invoice_approval_required: z.boolean(),
  invoice_approval_threshold: pounds(THRESHOLD_MAX_PENCE, THRESHOLD_MESSAGE),
  payment_reminders_enabled: z.boolean(),
  /** Days from the due date: negative before it, 0 on it, positive after it. */
  payment_reminder_schedule: z
    .array(z.number().int().min(-REMINDER_BEFORE_MAX).max(REMINDER_DAYS_MAX))
    .min(1, 'Add at least one reminder day')
    .max(12, 'Up to 12 reminders'),
});
export type BillingSettingsValues = z.infer<typeof billingSettingsSchema>;

export const rateSettingsSchema = z.object({
  rate_mode: z.enum(RATE_MODES, 'Choose how rates are applied'),
  overtime_enabled: z.boolean(),
  /** Typed as a multiple of the normal rate ("1.5"); the API stores basis points. */
  overtime_multiplier: z
    .string()
    .refine(
      (value) => parseMultiplierToBp(value) !== null,
      'Enter a multiple of the normal rate from 1 to 10, for example 1.5',
    ),
});
export type RateSettingsValues = z.infer<typeof rateSettingsSchema>;

/** Expenses: pounds per mile, the mark-up in percent and the receipt threshold in pounds. */
export const expenseSettingsSchema = z.object({
  mileage_rate: pounds(
    MILEAGE_MAX_PENCE,
    'Enter the rate per mile in pounds, from 0 to 10.00, for example 0.45',
  ),
  expense_markup: z.string().refine((value) => {
    const bp = parseMarkupToBp(value);
    return bp !== null && bp <= MARKUP_MAX_BP;
  }, 'Enter a percentage from 0 to 1000 with at most two decimals, for example 10 or 12.5'),
  receipt_required_threshold: pounds(THRESHOLD_MAX_PENCE, THRESHOLD_MESSAGE),
});
export type ExpenseSettingsValues = z.infer<typeof expenseSettingsSchema>;

export const localeSettingsSchema = z.object({
  timezone: z.string().min(1, 'Choose a timezone'),
});
export type LocaleSettingsValues = z.infer<typeof localeSettingsSchema>;
