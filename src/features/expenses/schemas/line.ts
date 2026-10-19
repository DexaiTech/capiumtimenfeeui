import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { LIMITS } from '../constants';
import { parseMiles, resolveAmounts } from '../utils/amounts';

/** The most an amount may be (`docs/modules/expenses.md`, "Limits"): 10,000,000,000.00. */
export const MAX_PENCE = 1_000_000_000_000;

export interface LineSchemaOptions {
  /** Today as `YYYY-MM-DD` in the practice time zone: nothing is spent in the future. */
  today: string;
  /** The ids of the types priced from miles. */
  mileageTypeIds: ReadonlySet<string>;
  /** A line of an approved claim: a reason is required. */
  correcting: boolean;
}

const AMOUNT_MESSAGE = 'Enter an amount in pounds, for example 12.50';

/** Pounds as typed → pence; null for empty or unreadable. */
function pence(text: string): number | null {
  const value = parsePounds(text);
  return value !== null && value >= 0 && value <= MAX_PENCE ? value : null;
}

/**
 * The form of one expense line. Money is typed in pounds and miles as decimals; the amounts that
 * are left empty are worked out by the API (or shown from `utils/amounts`).
 */
export function lineSchema({ today, mileageTypeIds, correcting }: LineSchemaOptions) {
  return z
    .object({
      expense_type_id: z.string().min(1, 'Choose the type of expense'),
      incurred_on: z.string().min(1, 'Enter the date'),
      description: z
        .string()
        .trim()
        .min(1, 'Describe the expense')
        .max(LIMITS.description, `Use at most ${String(LIMITS.description)} characters`),
      supplier: z
        .string()
        .trim()
        .max(LIMITS.supplier, `Use at most ${String(LIMITS.supplier)} characters`),
      /** Ids, or empty for none. */
      client_id: z.string(),
      job_id: z.string(),
      vat_rate_id: z.string(),
      net: z.string(),
      vat: z.string(),
      gross: z.string(),
      miles: z.string(),
      is_billable: z.boolean(),
      /** Pounds, or empty for "work it out" (needs `expense.manage` to set). */
      recharge_amount: z.string(),
      payer: z.enum(['staff', 'practice']),
      reason: z
        .string()
        .trim()
        .max(LIMITS.reason, `Use at most ${String(LIMITS.reason)} characters`),
    })
    .superRefine((values, ctx) => {
      const issue = (path: string, message: string) =>
        ctx.addIssue({ code: 'custom', path: [path], message });

      if (values.incurred_on > today) issue('incurred_on', 'The date cannot be in the future');

      if (mileageTypeIds.has(values.expense_type_id)) {
        if (parseMiles(values.miles) === null) {
          issue('miles', 'Enter the miles, for example 42.5 (more than 0, two decimals at most)');
        }
      } else {
        const given = {
          net: values.net.trim() === '' ? null : pence(values.net),
          vat: values.vat.trim() === '' ? null : pence(values.vat),
          gross: values.gross.trim() === '' ? null : pence(values.gross),
        };
        for (const field of ['net', 'vat', 'gross'] as const) {
          if (values[field].trim() !== '' && given[field] === null) issue(field, AMOUNT_MESSAGE);
        }
        if (values.net.trim() === '' && values.gross.trim() === '') {
          issue('net', 'Enter the net or the gross amount');
        } else {
          const resolved = resolveAmounts(given, null);
          if (resolved?.gross === 0) {
            issue('net', 'The amount must be more than £0.00');
          } else if (resolved === null && given.net !== null && given.gross !== null) {
            issue('gross', 'The gross amount cannot be less than the net');
          }
        }
      }

      if (values.is_billable && values.client_id === '') {
        issue('is_billable', 'Choose a client to charge this to');
      }
      if (values.recharge_amount.trim() !== '' && pence(values.recharge_amount) === null) {
        issue('recharge_amount', AMOUNT_MESSAGE);
      }
      if (correcting && values.reason === '') {
        issue('reason', 'Say why you are correcting this expense');
      }
    });
}

export type LineValues = z.infer<ReturnType<typeof lineSchema>>;
