import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { MAX_PENCE, percentToBp } from '../utils/format';

/** Pounds as typed ("95.50"); required. */
export const requiredRateText = (message: string) =>
  z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence >= 0 && pence <= MAX_PENCE;
  }, message);

/** Pounds as typed, or empty for "none". */
export const optionalRateText = (message: string) =>
  z
    .string()
    .refine(
      (value) =>
        value.trim() === '' ||
        (parsePounds(value) !== null &&
          (parsePounds(value) ?? 0) >= 0 &&
          (parsePounds(value) ?? 0) <= MAX_PENCE),
      message,
    );

/** A percentage from 0 to 100 with at most two decimals, or empty. */
export const optionalPercentText = z
  .string()
  .refine(
    (value) => value.trim() === '' || (percentToBp(value) ?? Infinity) <= 10_000,
    'Enter a percentage from 0 to 100, for example 75',
  );

/** A whole number as typed, between `min` and `max`. */
export const wholeNumberText = (min: number, max: number, message: string) =>
  z
    .string()
    .trim()
    .refine(
      (value) => /^\d{1,6}$/.test(value) && Number(value) >= min && Number(value) <= max,
      message,
    );

export const textMax = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

/** An email address, or empty. */
export const optionalEmailText = z
  .string()
  .trim()
  .max(254, 'Use at most 254 characters')
  .refine(
    (value) => value === '' || z.email().safeParse(value).success,
    'Enter a valid email address',
  );

/** A code of letters, digits, `_` and `-` (the API upper-cases it). */
export const codeText = (max: number, required: string) =>
  z
    .string()
    .trim()
    .min(1, required)
    .refine(
      (value) => new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value),
      `Use 1–${max} letters, digits, '_' or '-'`,
    );

/** Like `codeText`, or empty for "generate one". */
export const optionalCodeText = (max: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) => value === '' || new RegExp(`^[A-Za-z0-9_-]{1,${max}}$`).test(value),
      `Use 1–${max} letters, digits, '_' or '-'`,
    );
