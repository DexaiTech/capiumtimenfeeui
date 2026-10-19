import * as z from 'zod';

import { FULL_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/constants/limits';

/** Field names match the API's request bodies, so 422 details map onto fields by path. */

export const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email address')
  .pipe(z.email('Enter a valid email address'));

export const newPasswordField = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters`);

const PASSWORD_MISMATCH = 'Passwords do not match';

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, 'Enter your name')
      .max(FULL_NAME_MAX_LENGTH, `Use at most ${FULL_NAME_MAX_LENGTH} characters`),
    email: emailField,
    password: newPasswordField,
    password_confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.password_confirm, {
    path: ['password_confirm'],
    message: PASSWORD_MISMATCH,
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const emailOnlySchema = z.object({ email: emailField });
export type EmailOnlyValues = z.infer<typeof emailOnlySchema>;

export const resetPasswordSchema = z
  .object({
    password: newPasswordField,
    password_confirm: z.string().min(1, 'Confirm your password'),
  })
  .refine((values) => values.password === values.password_confirm, {
    path: ['password_confirm'],
    message: PASSWORD_MISMATCH,
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
