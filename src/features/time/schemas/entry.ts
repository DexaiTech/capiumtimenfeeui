import * as z from 'zod';

import { parseMinutes } from '@/utils/minutes';

import { MAX_DAY_MINUTES } from '../constants';
import { isIsoDate } from '../utils/weeks';

/** A duration as typed ("1:30", "1.5", "1h 30m") that is a whole entry: 0:01 to 24:00. */
export const durationText = z
  .string()
  .trim()
  .refine((value) => {
    const minutes = parseMinutes(value);
    return minutes !== null && minutes >= 1 && minutes <= MAX_DAY_MINUTES;
  }, 'Enter a time from 0:01 to 24:00, like 1:30, 1.5 or 1h 30m');

const note = (what: string) =>
  z.string().trim().max(2000, `${what} can be at most 2000 characters`);

/** Record or edit one time entry. Ids are empty text for "none". */
export const entrySchema = z.object({
  entry_date: z.string().refine(isIsoDate, 'Choose a date'),
  time: durationText,
  client_id: z.string(),
  job_id: z.string(),
  activity_code_id: z.string(),
  description: note('The description'),
  internal_note: note('The internal note'),
});
export type EntryValues = z.infer<typeof entrySchema>;

/** The form of the entry dialog: an edit has no reason, but shares the values of a correction. */
export const editSchema = entrySchema.extend({ reason: z.string() });

/** A reason for returning or correcting time: required, at most 2000 characters. */
export const reasonText = (required: string) =>
  z.string().trim().min(1, required).max(2000, 'The reason can be at most 2000 characters');

export const returnSchema = z.object({
  reason: reasonText('Enter a reason for returning the timesheet'),
});
export type ReturnValues = z.infer<typeof returnSchema>;

/** The fields of a correction; which of them changed is worked out against the entry. */
export const correctionSchema = z.object({
  reason: reasonText('Enter a reason for correcting this time'),
  entry_date: z.string().refine(isIsoDate, 'Choose a date'),
  time: durationText,
  client_id: z.string(),
  job_id: z.string(),
  activity_code_id: z.string(),
  description: note('The description'),
  internal_note: note('The internal note'),
});
export type CorrectionValues = z.infer<typeof correctionSchema>;
