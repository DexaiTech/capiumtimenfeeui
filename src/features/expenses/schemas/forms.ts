import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { LIMITS } from '../constants';
import { MAX_PENCE } from './line';

const atMost = (max: number) => `Use at most ${String(max)} characters`;

/** The form of an expense type (`docs/modules/expenses.md`, "Limits"). */
export const expenseTypeSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Enter the name of the expense type')
    .max(LIMITS.typeName, atMost(LIMITS.typeName)),
  code: z
    .string()
    .trim()
    .min(1, 'Enter a code for the expense type')
    .refine(
      (value) => new RegExp(`^[A-Za-z0-9_-]{1,${String(LIMITS.typeCode)}}$`).test(value),
      `Use 1–${String(LIMITS.typeCode)} letters, digits, '_' or '-'`,
    ),
  /** A VAT code id, or empty for "no default". */
  default_vat_rate_id: z.string(),
  is_mileage: z.boolean(),
  default_billable: z.boolean(),
  is_active: z.boolean(),
});
export type ExpenseTypeValues = z.infer<typeof expenseTypeSchema>;

/** The form of a disbursement: a cost paid for a client, to recharge. */
export const disbursementSchema = z.object({
  client_id: z.string().min(1, 'Choose the client'),
  job_id: z.string(),
  incurred_on: z.string().min(1, 'Enter the date'),
  description: z
    .string()
    .trim()
    .min(1, 'Describe the disbursement')
    .max(LIMITS.description, atMost(LIMITS.description)),
  supplier: z.string().trim().max(LIMITS.supplier, atMost(LIMITS.supplier)),
  /** Pounds, before VAT. */
  amount: z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence > 0 && pence <= MAX_PENCE;
  }, 'Enter an amount in pounds more than 0, for example 12.50'),
  vat_rate_id: z.string(),
  is_billable: z.boolean(),
});
export type DisbursementValues = z.infer<typeof disbursementSchema>;

/** Why a claim is sent back: required, and the claimant reads it. */
export const returnSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Say why the claim is returned, so the claimant knows what to change')
    .max(LIMITS.decision, atMost(LIMITS.decision)),
});
export type ReturnValues = z.infer<typeof returnSchema>;

/** The optional note of an approval. */
export const approveSchema = z.object({
  note: z.string().trim().max(LIMITS.decision, atMost(LIMITS.decision)),
});
export type ApproveValues = z.infer<typeof approveSchema>;

/** A new claim: an optional title, and whose claim it is when entered for someone else. */
export const newClaimSchema = z.object({
  title: z.string().trim().max(LIMITS.title, atMost(LIMITS.title)),
  /** The claimant's id; empty for oneself. */
  user_id: z.string(),
});
export type NewClaimValues = z.infer<typeof newClaimSchema>;

/** The title of a claim: optional; empty clears it. */
export const claimTitleSchema = z.object({
  title: z.string().trim().max(LIMITS.title, atMost(LIMITS.title)),
});
export type ClaimTitleValues = z.infer<typeof claimTitleSchema>;
