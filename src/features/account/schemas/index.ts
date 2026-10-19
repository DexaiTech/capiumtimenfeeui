import * as z from 'zod';

import { FULL_NAME_MAX_LENGTH } from '@/constants/limits';
import { newPasswordField } from '@/features/auth';

export const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, 'Enter your name')
    .max(FULL_NAME_MAX_LENGTH, `Use at most ${FULL_NAME_MAX_LENGTH} characters`),
  timezone: z.string().min(1, 'Choose a timezone'),
});
export type ProfileValues = z.infer<typeof profileSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1, 'Enter your current password'),
    password: newPasswordField,
    password_confirm: z.string().min(1, 'Confirm your new password'),
  })
  .refine((values) => values.password === values.password_confirm, {
    path: ['password_confirm'],
    message: 'Passwords do not match',
  })
  .refine((values) => values.password !== values.current_password, {
    path: ['password'],
    message: 'Choose a password different from the current one',
  });
export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
