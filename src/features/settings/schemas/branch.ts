import * as z from 'zod';

/** Characters as the API counts them (code points), so an emoji is one. */
const length = (value: string) => Array.from(value).length;

export const BRANCH_NAME_MAX = 40;

/** Add or rename a branch. */
export const branchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the branch')
    .refine((value) => length(value) <= BRANCH_NAME_MAX, {
      message: `Use at most ${BRANCH_NAME_MAX} characters`,
    }),
});

export type BranchValues = z.infer<typeof branchSchema>;
