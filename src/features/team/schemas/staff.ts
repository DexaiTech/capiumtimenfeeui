import * as z from 'zod';

import { parseMinutes } from '@/utils/minutes';
import { parseMultiplierToBp } from '@/utils/multiplier';

import { percentToBp } from '../utils/format';
import {
  codeText,
  optionalCodeText,
  optionalEmailText,
  optionalPercentText,
  optionalRateText,
  textMax,
} from './common';

const INITIALS_PATTERN = /^[A-Za-z0-9]{1,6}$/;

/**
 * The fields the add and edit forms share. Both forms have the same values type, so one form
 * component serves both; each schema changes only which fields are required.
 */
const shape = {
  full_name: z.string().trim().min(1, 'Enter the full name').max(120, 'Use at most 120 characters'),
  email: optionalEmailText,
  grade_id: z.string().min(1, 'Choose a grade'),
  approver_id: z.string().nullable(),
  job_title: textMax(120),
  initials: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || INITIALS_PATTERN.test(value),
      'Use 1 to 6 letters or digits',
    ),
  /** Typed as hours ("7.5") or h:mm; the API stores whole minutes. */
  hours_per_day: z
    .string()
    .trim()
    .refine((value) => {
      const minutes = parseMinutes(value);
      return minutes !== null && minutes >= 1 && minutes <= 1440;
    }, 'Enter the hours of a working day, more than 0 and at most 24, for example 7.5 or 7:30'),
  /** ISO weekdays, 1 = Monday. */
  working_days: z.array(z.number().int().min(1).max(7)).min(1, 'Choose at least one working day'),
  leaving_date: z.string(),
  status: z.enum(['active', 'inactive', 'left']),
  /** Add only: no login, an invitation by email, or an account with a temporary password. */
  login: z.enum(['none', 'invite', 'create']),
  /** Add only: the sign-in address; empty means the work email. */
  login_email: optionalEmailText,
  role_id: z.string(),
  send_email: z.boolean(),
  /** Add only, with `rate.manage`: the person's own rates, in pounds per hour; empty: none. */
  cost_rate: optionalRateText('Enter the cost rate in pounds per hour, for example 48.00'),
  charge_rate: optionalRateText('Enter the charge-out rate in pounds per hour, for example 95.00'),
  /** Add only: when those rates start; empty means the start date. */
  rate_effective_from: z.string(),
  /** Edit only, with overtime on: their own multiple of the normal rate ("1.5"); empty: the practice's. */
  overtime_multiplier: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || parseMultiplierToBp(value) !== null,
      'Enter a multiple of the normal rate from 1 to 10, for example 1.5, or leave it empty',
    ),
};

const LEAVING_BEFORE_START = "The leaving date can't be before the start date";

/** Add staff member: a record without a login, and optionally the login to give them. */
export const staffCreateSchema = z
  .object({
    ...shape,
    /** Empty: the API takes the next number of the staff sequence. */
    code: optionalCodeText(20),
    start_date: z.string().min(1, 'Enter the start date'),
    /** Empty: the grade's target, else 75%. */
    target_percent: optionalPercentText,
  })
  .refine(
    (values) =>
      !values.leaving_date || !values.start_date || values.leaving_date >= values.start_date,
    { path: ['leaving_date'], message: LEAVING_BEFORE_START },
  )
  .refine((values) => values.login === 'none' || values.login_email !== '' || values.email !== '', {
    path: ['login_email'],
    message: 'Enter the sign-in email address',
  });

/** Edit staff member: every profile field, and the status. */
export const staffEditSchema = z
  .object({
    ...shape,
    code: codeText(20, 'Enter the staff code'),
    start_date: z.string(),
    target_percent: z
      .string()
      .trim()
      .refine(
        (value) => (percentToBp(value) ?? Infinity) <= 10_000,
        'Enter the chargeable target as a percentage from 0 to 100, for example 75',
      ),
  })
  .refine(
    (values) =>
      !values.leaving_date || !values.start_date || values.leaving_date >= values.start_date,
    { path: ['leaving_date'], message: LEAVING_BEFORE_START },
  );

export type StaffFormValues = z.infer<typeof staffCreateSchema>;

/** Deactivate: pause the person, or record that they left. */
export const deactivateSchema = z.object({
  status: z.enum(['inactive', 'left']),
  leaving_date: z.string(),
});
export type DeactivateValues = z.infer<typeof deactivateSchema>;

/** Invite: the sign-in address (empty means the work email) and the role. */
export const inviteSchema = z.object({
  email: optionalEmailText,
  role_id: z.string(),
});
export type InviteValues = z.infer<typeof inviteSchema>;

/** Link a login: a new account, or merge into a person who already signs in. */
export const linkLoginSchema = z
  .object({
    mode: z.enum(['create_account', 'existing_user']),
    email: optionalEmailText,
    role_id: z.string(),
    send_email: z.boolean(),
  })
  .refine((values) => values.mode !== 'existing_user' || values.email !== '', {
    path: ['email'],
    message: 'Enter the email address the person already signs in with',
  });
export type LinkLoginValues = z.infer<typeof linkLoginSchema>;

export const changeRoleSchema = z.object({ role_id: z.string().min(1, 'Choose a role') });
export type ChangeRoleValues = z.infer<typeof changeRoleSchema>;
