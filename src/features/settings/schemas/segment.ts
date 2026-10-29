import * as z from 'zod';

/** Characters as the API counts them (code points), so an emoji is one. */
const length = (value: string) => Array.from(value).length;

export const SEGMENT_NAME_MAX = 40;
export const SEGMENT_DESCRIPTION_MAX = 500;

/** Add or change a segment. */
export const segmentSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for the segment')
    .refine((value) => length(value) <= SEGMENT_NAME_MAX, {
      message: `Use at most ${SEGMENT_NAME_MAX} characters`,
    }),
  description: z
    .string()
    .trim()
    .refine((value) => length(value) <= SEGMENT_DESCRIPTION_MAX, {
      message: `Use at most ${SEGMENT_DESCRIPTION_MAX} characters`,
    }),
});

export type SegmentValues = z.infer<typeof segmentSchema>;
