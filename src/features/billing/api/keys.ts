import { queryKeys } from '@/constants/queryKeys';

import type {
  CreditNoteListFilters,
  DebtorFilters,
  DebtorSort,
  EstimateListFilters,
  InvoiceListFilters,
  PaymentListFilters,
  ReminderLogFilters,
  ScheduleListFilters,
  StatementListFilters,
  StatementSort,
} from '../types';

/**
 * Keys of the billing data, all under `['org', organizationId, …]`: the roots the clients module
 * already reads (`invoices`, `credit-notes`, `payments`), so a change here also refreshes the
 * client workspace's tabs.
 */
export const billingKeys = {
  invoiceList: (organizationId: string, filters: InvoiceListFilters) =>
    [...queryKeys.org.invoices(organizationId), 'list', filters] as const,
  invoiceSummary: (organizationId: string, filters: InvoiceListFilters) =>
    [...queryKeys.org.invoices(organizationId), 'summary', filters] as const,
  invoice: (organizationId: string, invoiceId: string) =>
    [...queryKeys.org.invoices(organizationId), 'detail', invoiceId] as const,
  /** A client's invoices that still owe money (the allocation grid). */
  openInvoices: (organizationId: string, clientId: string) =>
    [...queryKeys.org.invoices(organizationId), 'open', clientId] as const,
  creditNoteList: (organizationId: string, filters: CreditNoteListFilters) =>
    [...queryKeys.org.creditNotes(organizationId), 'list', filters] as const,
  creditNote: (organizationId: string, creditNoteId: string) =>
    [...queryKeys.org.creditNotes(organizationId), 'detail', creditNoteId] as const,
  paymentList: (organizationId: string, filters: PaymentListFilters) =>
    [...queryKeys.org.payments(organizationId), 'list', filters] as const,
  payment: (organizationId: string, paymentId: string) =>
    [...queryKeys.org.payments(organizationId), 'detail', paymentId] as const,
  statement: (organizationId: string, clientId: string, dateFrom: string, dateTo: string) =>
    [...queryKeys.org.statements(organizationId), 'one', clientId, dateFrom, dateTo] as const,
  statementList: (
    organizationId: string,
    filters: StatementListFilters,
    sort: { sort: StatementSort; order: string },
  ) => [...queryKeys.org.statements(organizationId), 'list', filters, sort] as const,
  debtors: (
    organizationId: string,
    filters: DebtorFilters,
    sort: { sort: DebtorSort; order: string },
  ) => [...queryKeys.org.debtors(organizationId), 'list', filters, sort] as const,
  debtorInvoices: (organizationId: string, clientId: string, asAt: string) =>
    [...queryKeys.org.debtors(organizationId), 'invoices', clientId, asAt] as const,
  reminders: (organizationId: string, filters: ReminderLogFilters) =>
    [...queryKeys.org.debtors(organizationId), 'reminders', filters] as const,
  clientWip: (organizationId: string, clientId: string, jobId: string) =>
    [...queryKeys.org.wip(organizationId), 'billing-items', clientId, jobId] as const,
  clientBilling: (organizationId: string, clientId: string) =>
    [...queryKeys.org.clients(organizationId), 'billing-defaults', clientId] as const,
  estimateList: (organizationId: string, filters: EstimateListFilters) =>
    [...queryKeys.org.estimates(organizationId), 'list', filters] as const,
  estimateSummary: (organizationId: string, filters: EstimateListFilters) =>
    [...queryKeys.org.estimates(organizationId), 'summary', filters] as const,
  estimate: (organizationId: string, estimateId: string) =>
    [...queryKeys.org.estimates(organizationId), 'detail', estimateId] as const,
  scheduleList: (organizationId: string, filters: ScheduleListFilters) =>
    [...queryKeys.org.recurring(organizationId), 'list', filters] as const,
  schedule: (organizationId: string, scheduleId: string) =>
    [...queryKeys.org.recurring(organizationId), 'detail', scheduleId] as const,
  scheduleRuns: (organizationId: string, scheduleId: string) =>
    [...queryKeys.org.recurring(organizationId), 'runs', scheduleId] as const,
  vatOptions: (organizationId: string) =>
    [...queryKeys.org.vatRates(organizationId), 'billing'] as const,
};
