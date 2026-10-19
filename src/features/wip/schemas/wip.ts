import * as z from 'zod';

import { parsePounds } from '@/utils/money';

import { REASON_MAX } from '../constants';
import {
  ADJUSTMENT_KINDS,
  WIP_COMPONENTS,
  type AdjustmentInput,
  type TransferInput,
  type TransferItemRef,
  type WipComponent,
  type WriteOffInput,
  type WipItemRef,
} from '../types';

/** The most an amount may be (the API's `Money`): 10,000,000,000.00. */
export const MAX_PENCE = 1_000_000_000_000;

const AMOUNT_MESSAGE = 'Enter an amount above zero in pounds, for example 250.00';

/** A reason: required, and short enough for the API. */
const reason = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .max(REASON_MAX, `Use at most ${String(REASON_MAX)} characters`);

/** Pounds as typed → pence; null for empty, unreadable, zero or too large. */
export function positivePence(text: string): number | null {
  const value = parsePounds(text);
  return value !== null && value > 0 && value <= MAX_PENCE ? value : null;
}

const component = (value: string): WipComponent | null =>
  WIP_COMPONENTS.find((item) => item === value) ?? null;

/* -------------------------------- Adjustments -------------------------------- */

/** The form of a write-on or write-off. The amount is typed in pounds; empty is "not given". */
export const adjustmentSchema = z
  .object({
    client_id: z.string().min(1, 'Choose the client'),
    /** A job id, or empty for the client as a whole. */
    job_id: z.string(),
    kind: z.enum(ADJUSTMENT_KINDS),
    amount: z.string(),
    /** A component, or empty to let the API choose (fixed fee on a fixed-fee job, else time). */
    component: z.string(),
    effective_date: z.string(),
    reason: reason('Say why the WIP is adjusted'),
  })
  .superRefine((values, ctx) => {
    if (positivePence(values.amount) === null) {
      ctx.addIssue({ code: 'custom', path: ['amount'], message: AMOUNT_MESSAGE });
    }
  });

export type AdjustmentValues = z.infer<typeof adjustmentSchema>;

export const adjustmentDefaults = (): AdjustmentValues => ({
  client_id: '',
  job_id: '',
  kind: 'write_off',
  amount: '',
  component: '',
  effective_date: '',
  reason: '',
});

/** The body of `POST /wip/adjustments`; what is empty is left out so the API's defaults apply. */
export function toAdjustmentInput(values: AdjustmentValues): AdjustmentInput {
  const input: AdjustmentInput = {
    client_id: values.client_id,
    kind: values.kind,
    amount: positivePence(values.amount) ?? 0,
    reason: values.reason,
  };
  if (values.job_id) input.job_id = values.job_id;
  const chosen = component(values.component);
  if (chosen) input.component = chosen;
  if (values.effective_date) input.effective_date = values.effective_date;
  return input;
}

/* ---------------------------------- Transfers ---------------------------------- */

export const TRANSFER_MODES = ['amount', 'items'] as const;

/** The form of a transfer: an amount, or items chosen from the job's WIP. */
export const transferSchema = z
  .object({
    client_id: z.string().min(1, 'Choose the client'),
    from_job_id: z.string().min(1, 'Choose the job the WIP leaves'),
    to_job_id: z.string().min(1, 'Choose the job the WIP goes to'),
    mode: z.enum(TRANSFER_MODES),
    amount: z.string(),
    component: z.string(),
    /** `kind:id` of the items chosen, when the mode is items. */
    item_keys: z.array(z.string()),
    effective_date: z.string(),
    reason: reason('Say why the WIP is moved'),
  })
  .superRefine((values, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (values.from_job_id && values.from_job_id === values.to_job_id) {
      issue('to_job_id', 'Choose a different job from the one the WIP leaves');
    }
    if (values.mode === 'amount' && positivePence(values.amount) === null) {
      issue('amount', AMOUNT_MESSAGE);
    }
    if (values.mode === 'items' && values.item_keys.length === 0) {
      issue('item_keys', 'Choose at least one item');
    }
  });

export type TransferValues = z.infer<typeof transferSchema>;

export const transferDefaults = (): TransferValues => ({
  client_id: '',
  from_job_id: '',
  to_job_id: '',
  mode: 'amount',
  amount: '',
  component: '',
  item_keys: [],
  effective_date: '',
  reason: '',
});

/** The body of `POST /wip/transfers`: the items chosen (already referenced) or the amount. */
export function toTransferInput(
  values: TransferValues,
  items: ReadonlyArray<TransferItemRef>,
): TransferInput {
  const input: TransferInput = {
    from_job_id: values.from_job_id,
    to_job_id: values.to_job_id,
    reason: values.reason,
  };
  if (values.mode === 'items') input.items = [...items];
  else {
    input.amount = positivePence(values.amount) ?? 0;
    const chosen = component(values.component);
    if (chosen) input.component = chosen;
  }
  if (values.effective_date) input.effective_date = values.effective_date;
  return input;
}

/* ---------------------------------- Write-offs ---------------------------------- */

export const writeOffSchema = z.object({
  reason: reason('Say why the WIP is written off'),
  written_off_on: z.string(),
});

export type WriteOffValues = z.infer<typeof writeOffSchema>;

export function toWriteOffInput(
  values: WriteOffValues,
  clientId: string,
  items: ReadonlyArray<WipItemRef>,
): WriteOffInput {
  const input: WriteOffInput = { client_id: clientId, items: [...items], reason: values.reason };
  if (values.written_off_on) input.written_off_on = values.written_off_on;
  return input;
}
