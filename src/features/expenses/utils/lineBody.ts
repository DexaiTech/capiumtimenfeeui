import { parsePounds, penceToPoundsInput } from '@/utils/money';

import type { ExpenseLine, ExpenseLineInput, ExpenseLineUpdate } from '../types';
import type { LineValues } from '../schemas/line';

/** What the form needs to know about the line it describes. */
export interface LineBodyContext {
  /** The chosen type is priced from miles. */
  isMileage: boolean;
  /** The caller may set the recharge amount (`expense.manage`). */
  canSetRecharge: boolean;
  /** The amount field the person typed in last: the API works the rest out from it. */
  anchor: 'net' | 'gross';
  /** Whether the person typed an amount at all (net, VAT or gross). */
  amountsTouched: boolean;
  /** Whether the VAT field holds a value to send (typed, or an odd one a line already had). */
  vatTouched: boolean;
}

const pence = (text: string): number | null => parsePounds(text);

/** The amounts the API is given: the typed anchor, and the VAT only when it was set by hand. */
function amountsOf(values: LineValues, ctx: LineBodyContext): Partial<ExpenseLineInput> {
  const body: Partial<ExpenseLineInput> = {};
  const anchored = pence(values[ctx.anchor]);
  if (anchored !== null) body[ctx.anchor] = anchored;
  if (ctx.vatTouched) {
    const vat = pence(values.vat);
    if (vat !== null) body.vat = vat;
  }
  return body;
}

/** The body of `POST …/lines` for what the form holds. Empty optional fields are left out. */
export function toLineInput(values: LineValues, ctx: LineBodyContext): ExpenseLineInput {
  const body: ExpenseLineInput = {
    expense_type_id: values.expense_type_id,
    incurred_on: values.incurred_on,
    description: values.description,
    payer: values.payer,
    is_billable: values.is_billable,
  };
  if (values.supplier) body.supplier = values.supplier;
  if (values.client_id) body.client_id = values.client_id;
  if (values.job_id) body.job_id = values.job_id;
  if (values.vat_rate_id) body.vat_rate_id = values.vat_rate_id;
  if (ctx.isMileage) {
    body.miles = values.miles.trim();
  } else {
    Object.assign(body, amountsOf(values, ctx));
  }
  if (ctx.canSetRecharge && values.is_billable && values.recharge_amount.trim() !== '') {
    body.recharge_amount = pence(values.recharge_amount) ?? undefined;
  }
  return body;
}

const sameMiles = (typed: string, stored: string | null) =>
  stored !== null && Number(typed) === Number(stored);

/**
 * The body of `PATCH …/lines/{id}`: only what changed (what is not sent stays). The amounts go
 * only when they were typed, so the API prices the rest as it does for a new line.
 */
export function toLineUpdate(
  values: LineValues,
  line: ExpenseLine,
  ctx: LineBodyContext,
  reason?: string,
): ExpenseLineUpdate {
  const changes: ExpenseLineUpdate = {};
  if (values.expense_type_id !== line.expense_type_id) {
    changes.expense_type_id = values.expense_type_id;
  }
  if (values.incurred_on !== line.incurred_on) changes.incurred_on = values.incurred_on;
  if (values.description !== line.description) changes.description = values.description;
  const supplier = values.supplier || null;
  if (supplier !== line.supplier) changes.supplier = supplier;
  const client = values.client_id || null;
  if (client !== line.client_id) changes.client_id = client;
  const job = values.job_id || null;
  if (job !== line.job_id) changes.job_id = job;
  const vatCode = values.vat_rate_id || null;
  if (vatCode !== line.vat_rate_id) changes.vat_rate_id = vatCode;
  if (values.payer !== line.payer) changes.payer = values.payer;
  if (values.is_billable !== line.is_billable) changes.is_billable = values.is_billable;

  if (ctx.isMileage) {
    if (!sameMiles(values.miles.trim(), line.miles)) changes.miles = values.miles.trim();
  } else if (ctx.amountsTouched) {
    Object.assign(changes, amountsOf(values, ctx));
  }

  if (ctx.canSetRecharge && values.is_billable) {
    const typed = values.recharge_amount.trim();
    if (typed !== penceToPoundsInput(line.recharge_amount)) {
      changes.recharge_amount = typed === '' ? null : pence(typed);
    }
  }
  if (reason !== undefined && reason !== '') changes.reason = reason;
  return changes;
}

/** True when `changes` holds something besides the correction's reason. */
export function hasChanges(changes: ExpenseLineUpdate): boolean {
  return Object.keys(changes).some((key) => key !== 'reason');
}
