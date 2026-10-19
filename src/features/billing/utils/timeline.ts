import { formatUkDate, formatUkDateTime } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { PAYMENT_METHOD_LABELS } from '../constants';
import type { InvoiceDetail } from '../types';

export interface TimelineEvent {
  /** Sorts the events: a timestamp, or a date for events that only have a day. */
  at: string;
  /** When it happened, as shown. */
  when: string;
  title: string;
  detail?: string;
}

/**
 * What happened to the invoice, oldest first. Built from the invoice itself (creation, issue,
 * email, payments, credit notes, void): the audit log has no per-invoice view to read.
 */
export function timelineOf(invoice: InvoiceDetail, timeZone: string): TimelineEvent[] {
  const money = (pence: number) => formatMoney(pence, invoice.currency);
  const stamp = (at: string) => ({ at, when: formatUkDateTime(at, timeZone) });
  const day = (date: string) => ({ at: date, when: formatUkDate(date) });
  const events: TimelineEvent[] = [{ ...stamp(invoice.created_at), title: 'Draft created' }];
  if (invoice.issued_at) {
    events.push({
      ...stamp(invoice.issued_at),
      title: `Issued as ${invoice.number ?? 'an invoice'}`,
      detail: `${money(invoice.gross_total)} including VAT`,
    });
  }
  if (invoice.sent_at) events.push({ ...stamp(invoice.sent_at), title: 'Emailed to the client' });
  for (const payment of invoice.payments) {
    const method = (PAYMENT_METHOD_LABELS as Partial<Record<string, string>>)[payment.method];
    events.push({
      ...day(payment.received_on),
      title: `Payment of ${money(payment.amount)} received`,
      detail: [method ?? payment.method, payment.reference].filter(Boolean).join(' · '),
    });
  }
  for (const note of invoice.credit_notes) {
    events.push({
      ...day(note.issue_date),
      title: `Credit note ${note.number} for ${money(note.gross_total)}`,
      detail: note.reason,
    });
  }
  if (invoice.voided_at) {
    events.push({
      ...stamp(invoice.voided_at),
      title: 'Voided',
      detail: invoice.void_reason ?? undefined,
    });
  }
  return events.sort((a, b) => a.at.localeCompare(b.at));
}
