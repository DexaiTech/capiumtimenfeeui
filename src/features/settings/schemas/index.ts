import * as z from 'zod';

export const ROLE_NAME_MAX_LENGTH = 60;
export const ROLE_DESCRIPTION_MAX_LENGTH = 300;

export const roleSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the role')
    .max(ROLE_NAME_MAX_LENGTH, `Use at most ${ROLE_NAME_MAX_LENGTH} characters`),
  description: z
    .string()
    .trim()
    .max(ROLE_DESCRIPTION_MAX_LENGTH, `Use at most ${ROLE_DESCRIPTION_MAX_LENGTH} characters`),
  permissions: z.array(z.string()),
});
export type RoleValues = z.infer<typeof roleSchema>;
