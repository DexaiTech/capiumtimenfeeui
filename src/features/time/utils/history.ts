import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { ENTRY_FIELD_LABEL, HISTORY_HIDDEN_FIELDS } from '../constants';
import type { TimeEntryHistory } from '../types';

const MONEY_FIELDS = new Set(['charge_rate', 'cost_rate', 'charge_value', 'cost_value']);
const DATE_FIELDS = new Set(['entry_date', 'week_start']);

/** A value of a time entry snapshot as the person reads it: h:mm, £, dd/MM/yyyy, yes or no. */
export function formatEntryValue(field: string, value: unknown, currency: string): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'minutes' && typeof value === 'number') return formatMinutes(value);
  if (MONEY_FIELDS.has(field) && typeof value === 'number') return formatMoney(value, currency);
  if (DATE_FIELDS.has(field) && typeof value === 'string') return formatUkDate(value);
  if (field === 'is_billable') return value ? 'Billable' : 'Non-billable';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return JSON.stringify(value);
}

export interface ChangeLine {
  field: string;
  label: string;
  before: string;
  after: string;
}

/**
 * What a correction changed, one line per field, in the words of the screen. A reference whose
 * name changed with it (a client id next to its name) is listed once, by the name.
 */
export function changeLines(item: TimeEntryHistory, currency: string): ChangeLine[] {
  return Object.entries(item.changes)
    .filter(([field]) => !HISTORY_HIDDEN_FIELDS.includes(field))
    .map(([field, [before, after]]) => ({
      field,
      label: ENTRY_FIELD_LABEL[field] ?? field,
      before: formatEntryValue(field, before, currency),
      after: formatEntryValue(field, after, currency),
    }));
}
