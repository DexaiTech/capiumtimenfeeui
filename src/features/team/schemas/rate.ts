import * as z from 'zod';

import { SCOPE_OPTIONS } from '../constants';
import type { RateLevel } from '../types';
import { requiredRateText } from './common';

const needsOf = (level: string) => SCOPE_OPTIONS.find((option) => option.level === level)?.needs;

const ENDS_BEFORE_START = "The end date can't be before the start date";

/** A new rate: its scope (which of the four pickers the level needs), the rate and the period. */
export const rateRuleSchema = z
  .object({
    level: z.string().min(1, 'Choose who the rate applies to'),
    client_id: z.string().nullable(),
    service_id: z.string(),
    user_id: z.string().nullable(),
    grade_id: z.string(),
    rate: requiredRateText('Enter the rate in pounds per hour, for example 95.00'),
    effective_from: z.string().min(1, 'Enter the date the rate starts'),
    effective_to: z.string(),
    close_previous: z.boolean(),
  })
  .refine((values) => !needsOf(values.level)?.client || Boolean(values.client_id), {
    path: ['client_id'],
    message: 'Choose a client',
  })
  .refine((values) => !needsOf(values.level)?.service || Boolean(values.service_id), {
    path: ['service_id'],
    message: 'Choose a service',
  })
  .refine((values) => !needsOf(values.level)?.staff || Boolean(values.user_id), {
    path: ['user_id'],
    message: 'Choose a staff member',
  })
  .refine((values) => !needsOf(values.level)?.grade || Boolean(values.grade_id), {
    path: ['grade_id'],
    message: 'Choose a grade',
  })
  .refine(
    (values) =>
      !values.effective_to ||
      !values.effective_from ||
      values.effective_to >= values.effective_from,
    {
      path: ['effective_to'],
      message: ENDS_BEFORE_START,
    },
  );
export type RateRuleValues = z.infer<typeof rateRuleSchema>;

/** Change a rate: the scope never changes; a used rate keeps its start date. */
export const rateRuleEditSchema = z
  .object({
    rate: requiredRateText('Enter the rate in pounds per hour, for example 95.00'),
    effective_from: z.string().min(1, 'Enter the date the rate starts'),
    effective_to: z.string(),
  })
  .refine(
    (values) =>
      !values.effective_to ||
      !values.effective_from ||
      values.effective_to >= values.effective_from,
    {
      path: ['effective_to'],
      message: ENDS_BEFORE_START,
    },
  );
export type RateRuleEditValues = z.infer<typeof rateRuleEditSchema>;

/** End-date: the last day the rate applies. */
export const endDateSchema = z.object({
  effective_to: z.string().min(1, 'Choose the last day the rate applies'),
});
export type EndDateValues = z.infer<typeof endDateSchema>;

export function isRateLevel(value: string): value is RateLevel {
  return SCOPE_OPTIONS.some((option) => option.level === value);
}
