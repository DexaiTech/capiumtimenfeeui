import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { MAX_DOCUMENT_LINES, MAX_PENCE, PAYMENT_METHOD_LABELS } from '../constants';
import { PAYMENT_METHODS, SCHEDULE_FREQUENCIES } from '../types';
import { parseQuantity } from '../utils/lineMaths';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A calendar date as `YYYY-MM-DD`. */
export const isoDateText = (message: string) => z.string().refine((v) => ISO_DATE.test(v), message);

/** Pounds as typed ("95.50"), at least 1p, at most the API's limit. */
export const positiveMoneyText = (message: string) =>
  z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence > 0 && pence <= MAX_PENCE;
  }, message);

/** Pounds as typed; a negative amount (a discount) is allowed. */
export const signedMoneyText = (message: string) =>
  z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && Math.abs(pence) <= MAX_PENCE;
  }, message);

export const textMax = (max: number) => z.string().trim().max(max, `Use at most ${max} characters`);

/** Addresses separated by commas, semicolons or spaces. */
export function splitEmails(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

const emailList = z
  .string()
  .trim()
  .refine((value) => {
    const emails = splitEmails(value);
    return emails.length <= 10 && emails.every((email) => z.email().safeParse(email).success);
  }, 'Enter up to 10 valid email addresses, separated by commas');

/** A required reason (void, reject, reverse) or an optional one. */
export const reasonSchema = (required: boolean, requiredMessage = 'Give a reason') =>
  z.object({
    reason: required
      ? z.string().trim().min(1, requiredMessage).max(500, 'Use at most 500 characters')
      : textMax(500),
  });
export type ReasonValues = z.infer<ReturnType<typeof reasonSchema>>;

/** Issue date and due date; the due date may not come first. */
export const datesSchema = z
  .object({
    issue_date: isoDateText('Enter the issue date'),
    due_date: isoDateText('Enter the due date'),
  })
  .refine((values) => values.due_date >= values.issue_date, {
    path: ['due_date'],
    message: 'The due date cannot be before the issue date',
  });
export type DatesValues = z.infer<typeof datesSchema>;

export const headerSchema = z
  .object({
    issue_date: isoDateText('Enter the issue date'),
    due_date: isoDateText('Enter the due date'),
    reference: textMax(100),
    notes: textMax(2000),
  })
  .refine((values) => values.due_date >= values.issue_date, {
    path: ['due_date'],
    message: 'The due date cannot be before the issue date',
  });
export type HeaderValues = z.infer<typeof headerSchema>;

export const sendSchema = z.object({ to: emailList });
export type SendValues = z.infer<typeof sendSchema>;

/** The period of a statement and, for one client, where to send it (empty: the client's own). */
export const statementSendSchema = z
  .object({
    date_from: z.string().refine((v) => v === '' || ISO_DATE.test(v), 'Enter a valid start date'),
    date_to: isoDateText('Enter the end date'),
    to: emailList,
  })
  .refine((values) => values.date_from === '' || values.date_from <= values.date_to, {
    path: ['date_from'],
    message: 'The start of the period cannot be after its end',
  });
export type StatementSendValues = z.infer<typeof statementSendSchema>;

const description = z
  .string()
  .trim()
  .min(1, 'Enter a description')
  .max(1000, 'Use at most 1000 characters');

/** A line that bills no WIP: quantity times unit price, negative for a discount. */
export const manualLineSchema = z.object({
  description,
  quantity: z
    .string()
    .refine((value) => parseQuantity(value) !== null, 'Enter a quantity such as 1 or 2.5'),
  unit_amount: signedMoneyText('Enter an amount such as 120.00 (negative for a discount)'),
  vat_rate_id: z.string(),
});
export type ManualLineValues = z.infer<typeof manualLineSchema>;

/** A line that bills WIP: what to bill for it (never negative) and its VAT code. */
export const wipLineSchema = z.object({
  description,
  net_amount: z.string().refine((value) => {
    const pence = parsePounds(value);
    return pence !== null && pence >= 0 && pence <= MAX_PENCE;
  }, 'Enter the amount to bill, such as 120.00 (0 or more)'),
  vat_rate_id: z.string(),
});
export type WipLineValues = z.infer<typeof wipLineSchema>;

/** Issue date, and a due date that may be left empty (the client's terms then apply). */
export const issueSchema = z
  .object({
    issue_date: isoDateText('Enter the issue date'),
    due_date: z.string().refine((v) => v === '' || ISO_DATE.test(v), 'Enter a valid due date'),
  })
  .refine((values) => values.due_date === '' || values.due_date >= values.issue_date, {
    path: ['due_date'],
    message: 'The due date cannot be before the issue date',
  });
export type IssueValues = z.infer<typeof issueSchema>;

export const paymentSchema = z.object({
  client_id: z.string().min(1, 'Choose the client'),
  received_on: isoDateText('Enter the date received'),
  amount: positiveMoneyText('Enter the amount received, such as 250.00'),
  method: z.enum(
    PAYMENT_METHODS,
    `Choose one of: ${Object.values(PAYMENT_METHOD_LABELS).join(', ')}`,
  ),
  reference: textMax(100),
  notes: textMax(1000),
  allocation: z.enum(['auto', 'manual', 'none']),
});
export type PaymentValues = z.infer<typeof paymentSchema>;

/** One line of the draft being prepared: its wording, what to bill (empty keeps the WIP value) and VAT code. */
export const prepareLineSchema = z.object({
  description,
  net: z.string().refine((value) => {
    if (value.trim() === '') return true;
    const pence = parsePounds(value);
    return pence !== null && pence >= 0 && pence <= MAX_PENCE;
  }, 'Enter the amount to bill, such as 120.00 (0 or more)'),
  vat_rate_id: z.string(),
});
export type PrepareLineValues = z.infer<typeof prepareLineSchema>;

/** The header of the draft being prepared; the due date may be left empty (the client's terms apply). */
export const prepareDetailsSchema = z
  .object({
    issue_date: isoDateText('Enter the issue date'),
    due_date: z.string().refine((v) => v === '' || ISO_DATE.test(v), 'Enter a valid due date'),
    reference: textMax(100),
    notes: textMax(2000),
  })
  .refine((values) => values.due_date === '' || values.due_date >= values.issue_date, {
    path: ['due_date'],
    message: 'The due date cannot be before the issue date',
  });
export type PrepareDetailsValues = z.infer<typeof prepareDetailsSchema>;

export const creditNoteSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Give a reason for the credit note')
    .max(500, 'Use at most 500 characters'),
  issue_date: isoDateText('Enter the credit note date'),
});
export type CreditNoteValues = z.infer<typeof creditNoteSchema>;

export const creditNoteWipSchema = z.object({
  mode: z.enum(['return', 'write_off']),
  reason: z.string().trim().min(1, 'Give a reason').max(500, 'Use at most 500 characters'),
});
export type CreditNoteWipValues = z.infer<typeof creditNoteWipSchema>;

export const reversalSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Give the reason for the reversal')
    .max(500, 'Use at most 500 characters'),
  bounced: z.boolean(),
});
export type ReversalValues = z.infer<typeof reversalSchema>;

/* ------------------------ Estimates and recurring schedules ------------------------ */

/** One line of an estimate or schedule; the service and job of a saved line ride along unseen. */
export const documentLineSchema = z.object({
  description,
  quantity: z
    .string()
    .refine((value) => parseQuantity(value) !== null, 'Enter a quantity such as 1 or 2.5'),
  unit_amount: signedMoneyText('Enter an amount such as 120.00 (negative for a discount)'),
  vat_rate_id: z.string(),
  service_id: z.string(),
  job_id: z.string(),
});
export type DocumentLineValues = z.infer<typeof documentLineSchema>;

const documentLines = z
  .array(documentLineSchema)
  .min(1, 'Add at least one line')
  .max(MAX_DOCUMENT_LINES, `Use at most ${MAX_DOCUMENT_LINES} lines`);

/** An optional calendar date: empty or `YYYY-MM-DD`. */
const optionalDate = (message: string) =>
  z.string().refine((value) => value === '' || ISO_DATE.test(value), message);

export const estimateSchema = z.object({
  client_id: z.string().min(1, 'Choose the client'),
  expiry_date: optionalDate('Enter a valid expiry date'),
  reference: textMax(100),
  notes: textMax(2000),
  lines: documentLines,
});
export type EstimateValues = z.infer<typeof estimateSchema>;

export const scheduleSchema = z
  .object({
    client_id: z.string().min(1, 'Choose the client'),
    name: z.string().trim().min(1, 'Enter a name').max(200, 'Use at most 200 characters'),
    frequency: z.enum(SCHEDULE_FREQUENCIES, 'Choose how often to invoice'),
    start_date: isoDateText('Enter the start date'),
    end_date: optionalDate('Enter a valid end date'),
    reference: textMax(100),
    notes: textMax(2000),
    lines: documentLines,
  })
  .refine((values) => values.end_date === '' || values.end_date >= values.start_date, {
    path: ['end_date'],
    message: 'The end date cannot be before the start date',
  });
export type ScheduleValues = z.infer<typeof scheduleSchema>;
