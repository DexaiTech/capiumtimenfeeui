/**
 * The lines of an estimate or a recurring schedule between the form (text as typed) and the API
 * (`LineInput`: quantity as a two-place string, unit amount in pence), and the figures the form
 * shows while the lines are typed.
 */
import { parsePounds, penceToPoundsInput } from '@/utils/money';

import type { DocumentLineValues } from '../schemas/forms';
import type { LineInput, VatOption } from '../types';
import { formatQuantity, lineNet, parseQuantity, sumPence, vatOn } from './lineMaths';

export const emptyLine = (): DocumentLineValues => ({
  description: '',
  quantity: '1',
  unit_amount: '',
  vat_rate_id: '',
  service_id: '',
  job_id: '',
});

/** What a saved line, of an estimate or a schedule, gives the form. */
export interface SavedLine {
  description: string;
  quantity: string;
  unit_amount: number;
  vat_rate_id: string | null;
  service_id: string | null;
  job_id: string | null;
}

export function linesToValues(lines: ReadonlyArray<SavedLine>): DocumentLineValues[] {
  return lines.map((line) => ({
    description: line.description,
    quantity: line.quantity,
    unit_amount: penceToPoundsInput(line.unit_amount),
    vat_rate_id: line.vat_rate_id ?? '',
    service_id: line.service_id ?? '',
    job_id: line.job_id ?? '',
  }));
}

/** The lines as the API takes them; one that does not parse (the form checks first) is left out. */
export function valuesToInputs(lines: ReadonlyArray<DocumentLineValues>): LineInput[] {
  return lines.flatMap((line) => {
    const quantity = parseQuantity(line.quantity);
    const unit = parsePounds(line.unit_amount);
    if (quantity === null || unit === null) return [];
    return [
      {
        description: line.description.trim(),
        quantity: formatQuantity(quantity),
        unit_amount: unit,
        ...(line.vat_rate_id ? { vat_rate_id: line.vat_rate_id } : {}),
        ...(line.service_id ? { service_id: line.service_id } : {}),
        ...(line.job_id ? { job_id: line.job_id } : {}),
      },
    ];
  });
}

/** True when two sets of lines would be stored the same. */
export const sameLines = (left: ReadonlyArray<LineInput>, right: ReadonlyArray<LineInput>) =>
  JSON.stringify(left) === JSON.stringify(right);

export interface LinePreview {
  /** Null while the quantity or the price is not a number yet. */
  net: number | null;
  vat: number | null;
}

/** The net and VAT of each line as typed; VAT is unknown for a line left on the default code. */
export function previewLines(
  lines: ReadonlyArray<DocumentLineValues>,
  vatOptions: ReadonlyArray<VatOption>,
): LinePreview[] {
  return lines.map((line) => {
    const quantity = parseQuantity(line.quantity);
    const unit = parsePounds(line.unit_amount);
    if (quantity === null || unit === null) return { net: null, vat: null };
    const net = lineNet(quantity, unit);
    const rate = vatOptions.find((option) => option.id === line.vat_rate_id)?.rate_bp;
    return { net, vat: rate === undefined ? null : vatOn(net, rate) };
  });
}

export interface PreviewTotals {
  net: number;
  vat: number;
  gross: number;
  /** True when some line has no VAT code chosen, so the API will apply the default and add VAT. */
  vatPending: boolean;
}

export function previewTotals(previews: ReadonlyArray<LinePreview>): PreviewTotals {
  const net = sumPence(previews.map((line) => line.net ?? 0));
  const vat = sumPence(previews.map((line) => line.vat ?? 0));
  return {
    net,
    vat,
    gross: net + vat,
    vatPending: previews.some((line) => line.net !== null && line.vat === null),
  };
}
