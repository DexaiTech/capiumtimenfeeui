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

/** One row of an invoice's line grid (Create invoice, a draft): text as typed. */
export const gridLineSchema = z.object({
  /** The saved line's id, or the key of a line of the chosen work; '' for a row typed in. */
  key: z.string(),
  /** Bills work: its quantity and unit price are the work's, what it bills is typed as its net. */
  wip: z.boolean(),
  description: z.string(),
  quantity: z.string(),
  unit_amount: z.string(),
  /** What a row of work bills, in pounds; unused on a row typed in. */
  net_amount: z.string(),
  vat_rate_id: z.string(),
  service_id: z.string(),
});
export type GridLineValues = z.infer<typeof gridLineSchema>;

/**
 * What every row needs: a description, then for a row typed in a quantity and a unit price
 * (more than zero for fees in advance, else may be negative for a discount), for a row of work the
 * amount to bill (0 or more; empty keeps what the work bills when `blankNet`). One pass over
 * all the rows, so every message shows at once.
 */
function checkGridLines(
  lines: ReadonlyArray<GridLineValues>,
  ctx: z.RefinementCtx,
  { advance, blankNet }: { advance: (line: GridLineValues) => boolean; blankNet: boolean },
) {
  lines.forEach((line, index) => {
    const issue = (field: keyof GridLineValues, message: string) =>
      ctx.addIssue({ code: 'custom', path: ['lines', index, field], message });
    const words = line.description.trim();
    if (words === '') issue('description', 'Enter a description');
    else if (words.length > 1000) issue('description', 'Use at most 1000 characters');
    if (line.wip) {
      if (blankNet && line.net_amount.trim() === '') return;
      const pence = parsePounds(line.net_amount);
      if (pence === null || pence < 0 || pence > MAX_PENCE) {
        issue('net_amount', 'Enter the amount to bill, such as 120.00 (0 or more)');
      }
      return;
    }
    if (parseQuantity(line.quantity) === null) {
      issue('quantity', 'Enter a quantity such as 1 or 2.5');
    }
    const unit = parsePounds(line.unit_amount);
    if (advance(line)) {
      if (unit === null || unit <= 0 || unit > MAX_PENCE) {
        issue('unit_amount', 'Enter the price before VAT, such as 6000.00');
      }
    } else if (unit === null || Math.abs(unit) > MAX_PENCE) {
      issue('unit_amount', 'Enter an amount such as 120.00 (negative for a discount)');
    }
  });
}

/** The lines of a draft, edited in place; `advance` makes the rows added fees in advance. */
export const draftLinesSchema = z
  .object({
    advance: z.boolean(),
    lines: z
      .array(gridLineSchema)
      .max(MAX_DOCUMENT_LINES, `Use at most ${MAX_DOCUMENT_LINES} lines`),
  })
  .superRefine((values, ctx) =>
    checkGridLines(values.lines, ctx, {
      advance: (line) => values.advance && line.key === '',
      blankNet: false,
    }),
  );
export type DraftLinesValues = z.infer<typeof draftLinesSchema>;

/** Fees billed in advance, one or more lines: wording, quantity, unit price before VAT, VAT code. */
export const advanceSchema = z.object({
  lines: z
    .array(
      z.object({
        description,
        quantity: z
          .string()
          .refine((value) => parseQuantity(value) !== null, 'Enter a quantity such as 1 or 2.5'),
        unit_amount: positiveMoneyText('Enter the price before VAT, such as 6000.00'),
        vat_rate_id: z.string(),
        service_id: z.string(),
      }),
    )
    .min(1, 'Add at least one line')
    .max(MAX_DOCUMENT_LINES, `Use at most ${MAX_DOCUMENT_LINES} lines`),
});
export type AdvanceValues = z.infer<typeof advanceSchema>;

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
