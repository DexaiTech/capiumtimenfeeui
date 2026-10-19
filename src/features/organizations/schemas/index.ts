import * as z from 'zod';

import { RESERVED_TOP_LEVEL } from '@/constants/routes';

import { SLUG_MAX_LENGTH, SLUG_MIN_LENGTH, SLUG_PATTERN } from '../utils/slug';

export const ORG_NAME_MAX_LENGTH = 120;

/** Field names match the API's request bodies, so 422 details map onto fields by path. */

const nameField = z
  .string()
  .trim()
  .min(1, 'Enter the practice name')
  .max(ORG_NAME_MAX_LENGTH, `Use at most ${ORG_NAME_MAX_LENGTH} characters`);

const timezoneField = z.string().min(1, 'Choose a timezone');

export const createOrganizationSchema = z.object({
  name: nameField,
  /** Optional: empty means "derive it from the name". */
  slug: z
    .string()
    .trim()
    .refine(
      (value) =>
        value === '' || (value.length >= SLUG_MIN_LENGTH && value.length <= SLUG_MAX_LENGTH),
      `Use ${SLUG_MIN_LENGTH} to ${SLUG_MAX_LENGTH} characters`,
    )
    .refine(
      (value) => value === '' || value.length < SLUG_MIN_LENGTH || SLUG_PATTERN.test(value),
      'Use lowercase letters, numbers and hyphens, starting and ending with a letter or number',
    )
    .refine(
      (value) => !(RESERVED_TOP_LEVEL as ReadonlyArray<string>).includes(value),
      'This name is used by the application. Choose another.',
    ),
  timezone: timezoneField,
});
export type CreateOrganizationValues = z.infer<typeof createOrganizationSchema>;
