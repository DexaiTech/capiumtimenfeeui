import type { NumberedDocument } from '../billingTypes';

export interface NumberedDocumentInfo {
  /** The page title and the toast: "Invoice numbering". */
  title: string;
  /** "invoice": for sentences. */
  noun: string;
  plural: string;
}

export const NUMBERED_DOCUMENTS: Record<NumberedDocument, NumberedDocumentInfo> = {
  invoice: { title: 'Invoice numbering', noun: 'invoice', plural: 'invoices' },
  credit_note: { title: 'Credit note numbering', noun: 'credit note', plural: 'credit notes' },
  estimate: { title: 'Estimate numbering', noun: 'estimate', plural: 'estimates' },
};

/** Kinds whose next number may only be raised (the API answers 409 `SEQUENCE_BACKWARDS`). */
export const FORWARD_ONLY: ReadonlySet<string> = new Set(['invoice', 'credit_note', 'estimate']);

export const PREFIX_MAX_LENGTH = 12;
export const PREFIX_PATTERN = /^[A-Za-z0-9/_-]*$/;
export const PADDING_MIN = 1;
export const PADDING_MAX = 10;
export const NEXT_NUMBER_MAX = 2_000_000_000;

/** A number as the API prints it: prefix, then the number padded with zeros (`INV-00042`). */
export function formatSequenceNumber(prefix: string, number: number, padding: number): string {
  return `${prefix}${String(number).padStart(padding, '0')}`;
}

/** The text of the three numbering fields, as typed. */
export interface SequenceDraft {
  prefix: string;
  padding: string;
  next_number: string;
}

/** The next `count` numbers a draft would produce, or null while a field is not valid yet. */
export function previewNumbers(draft: SequenceDraft, count = 1): string[] | null {
  const prefix = draft.prefix.trim();
  const padding = Number(draft.padding);
  const next = Number(draft.next_number);
  const valid =
    prefix.length <= PREFIX_MAX_LENGTH &&
    PREFIX_PATTERN.test(prefix) &&
    /^\d{1,2}$/.test(draft.padding.trim()) &&
    padding >= PADDING_MIN &&
    padding <= PADDING_MAX &&
    /^\d{1,10}$/.test(draft.next_number.trim()) &&
    next >= 1 &&
    next <= NEXT_NUMBER_MAX;
  if (!valid) return null;
  return Array.from({ length: count }, (_, index) =>
    formatSequenceNumber(prefix, next + index, padding),
  );
}
