import { toCsv, downloadText } from '@/utils/csv';
import { formatUkDate } from '@/utils/dates';
import { penceToPoundsInput } from '@/utils/money';

import type { InvoiceSummary } from '../types';
import { invoiceStatusLabel } from './format';

const HEADER = [
  'Invoice',
  'Client',
  'Client code',
  'Issue date',
  'Due date',
  'Reference',
  'Net',
  'VAT',
  'Gross',
  'Paid',
  'Credited',
  'Outstanding',
  'Status',
] as const;

/** The invoices as a spreadsheet: UK dates, amounts in pounds with two decimals. */
export function exportInvoicesCsv(rows: ReadonlyArray<InvoiceSummary>, currency: string): void {
  const money = (pence: number) => penceToPoundsInput(pence, currency);
  const body = rows.map((invoice) => [
    invoice.number ?? 'Draft',
    invoice.client?.name ?? '',
    invoice.client?.code ?? '',
    formatUkDate(invoice.issue_date),
    formatUkDate(invoice.due_date),
    invoice.reference ?? '',
    money(invoice.net_total),
    money(invoice.vat_total),
    money(invoice.gross_total),
    money(invoice.paid_total),
    money(invoice.credited_total),
    money(invoice.balance),
    invoiceStatusLabel(invoice.display_status),
  ]);
  downloadText('invoices.csv', toCsv([HEADER, ...body]));
}
