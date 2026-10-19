import { formatUkDate } from '@/utils/dates';
import { formatBasisPoints } from '@/utils/money';

import { INVOICE_STATUS_LABELS, type LabelTone } from '../constants';
import type { ClientRef, InvoiceSummary, VatOption } from '../types';

/** "Standard (20%)". */
export function vatLabel(option: Pick<VatOption, 'name' | 'rate_bp'>): string {
  return `${option.name} (${formatBasisPoints(option.rate_bp)})`;
}

/** The text of an invoice status; one this build does not know is shown as the API wrote it. */
export function invoiceStatusLabel(status: string): string {
  return (INVOICE_STATUS_LABELS as Partial<Record<string, LabelTone>>)[status]?.label ?? status;
}

/** Text for a plain count: "1 invoice", "3 invoices". */
export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** The number of an issued invoice, "Draft" before that. */
export function invoiceLabel(invoice: Pick<InvoiceSummary, 'number'>): string {
  return invoice.number ?? 'Draft';
}

/** "Acme Ltd (ACM001)", or a dash when the client is not known. */
export function clientLabel(client: ClientRef | null | undefined): string {
  return client ? `${client.name} (${client.code})` : '—';
}

/** A date for a table cell: `dd/MM/yyyy`, or a dash. */
export function dateCell(value: string | null | undefined): string {
  return formatUkDate(value) || '—';
}

/** Whole days an invoice is past its due date (0 when not due yet or not dated). */
export function daysOverdue(dueDate: string | null, today: string): number {
  if (!dueDate || dueDate >= today) return 0;
  const [dy, dm, dd] = dueDate.split('-').map(Number);
  const [ty, tm, td] = today.split('-').map(Number);
  const due = Date.UTC(dy ?? 0, (dm ?? 1) - 1, dd ?? 1);
  const now = Date.UTC(ty ?? 0, (tm ?? 1) - 1, td ?? 1);
  return Math.round((now - due) / 86_400_000);
}
