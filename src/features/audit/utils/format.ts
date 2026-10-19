import { formatUkDate, formatUkDateTime } from '@/utils/dates';

import type { HistoryEntry } from '../types';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

/** `effective_from` → "Effective from". */
export function humanizeField(field: string): string {
  const words = field.replace(/[_.-]+/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : field;
}

/**
 * A value of a change as text, UK formats for dates; `null` when the field had no value (the
 * table says "None"). Money stays in the unit the service recorded: the entry does not say
 * which fields are money.
 */
export function formatChangeValue(value: unknown, timeZone: string): string | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (ISO_DATE.test(value)) return formatUkDate(value);
    if (ISO_DATE_TIME.test(value)) return formatUkDateTime(value, timeZone) || value;
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    if (value.every((item) => typeof item === 'string' || typeof item === 'number')) {
      return value.join(', ');
    }
  }
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/**
 * What an entry is about, without its label: "Invoice issued: INV-00012 (Babbage Ltd)" →
 * "INV-00012 (Babbage Ltd)". Empty when the summary says no more than the label.
 */
export function subjectOf(entry: Pick<HistoryEntry, 'label' | 'summary'>): string {
  if (!entry.summary.startsWith(entry.label)) return entry.summary;
  return entry.summary
    .slice(entry.label.length)
    .replace(/^\s*:\s*/, '')
    .trim();
}
