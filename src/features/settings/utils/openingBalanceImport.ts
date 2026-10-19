import { downloadText, toCsv } from '@/utils/csv';

/** The header row of the opening-balance import template (`opening_balance_import.py` of the
 * API maps these columns by name). */
export const OPENING_BALANCE_COLUMNS = [
  'client',
  'staff',
  'date',
  'hours',
  'activity',
  'job',
  'billable',
] as const;

type Column = (typeof OPENING_BALANCE_COLUMNS)[number];

const EXAMPLE: Record<Column, string> = {
  client: 'ACME',
  staff: 'jane@example.com',
  date: '2025-03-31',
  hours: '3.5',
  activity: 'ACC',
  job: '',
  billable: 'Y',
};

/** The CSV template: the header row and one example row. */
export function downloadOpeningBalanceTemplate() {
  downloadText(
    'opening-balance-time-import-template.csv',
    toCsv([[...OPENING_BALANCE_COLUMNS], OPENING_BALANCE_COLUMNS.map((column) => EXAMPLE[column])]),
  );
}
