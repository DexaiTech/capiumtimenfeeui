import { api, type ApiResult, type RequestOptions } from '@/services/api';
import type { BulkResult } from '@/types';

import type {
  AllocateBody,
  ClientWip,
  CreditNote,
  CreditNoteCreate,
  CreditNoteListFilters,
  CreditNoteWip,
  CreditNoteWipMode,
  DebtorFilters,
  DebtorInvoices,
  InvoiceBulkRequest,
  DebtorsPage,
  DebtorSort,
  Estimate,
  EstimateConverted,
  EstimateCreate,
  EstimateListFilters,
  EstimateListSummary,
  EstimateSendBody,
  EstimateSummary,
  EstimateUpdate,
  InvoiceCreate,
  InvoiceDetail,
  InvoiceHeaderUpdate,
  InvoiceIssueBody,
  InvoiceLineCreate,
  InvoiceLineUpdate,
  InvoiceListFilters,
  InvoiceListSummary,
  InvoiceSent,
  InvoiceSummary,
  Payment,
  PaymentCreate,
  PaymentListFilters,
  ReminderLogEntry,
  ReminderLogFilters,
  ReminderRequest,
  ReminderResult,
  Schedule,
  ScheduleCreate,
  ScheduleListFilters,
  ScheduleRun,
  ScheduleSummary,
  ScheduleUpdate,
  Statement,
  StatementListFilters,
  StatementSendBody,
  StatementSent,
  StatementSort,
  StatementsPage,
  VatOption,
} from '../types';

type Query = NonNullable<RequestOptions['query']>;

/** A list whose `data` is one object (rows + totals) paged with the cursor of `meta`. */
export type PagedObject<TData> = ApiResult<TData>;

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface ListOptions {
  cursor?: string;
  limit?: number;
  signal?: AbortSignal;
}

export type SortOrder = 'asc' | 'desc';

/** What a client's billing settings give an invoice: terms, VAT code, template, address. */
export interface ClientBillingDefaults {
  id: string;
  code: string;
  name: string;
  payment_terms_days: number | null;
  default_vat_rate_id: string | null;
  invoice_email: string | null;
  invoice_template_id: string | null;
}

function invoiceQuery(filters: InvoiceListFilters): Query {
  return {
    client_id: filters.client_id,
    status: filters.status,
    date_from: filters.date_from,
    date_to: filters.date_to,
    q: filters.q,
    outstanding: filters.outstanding,
  };
}

/** Typed wrappers over the invoice, credit-note, payment and statement endpoints. */
export const billingApi = {
  /* -------------------------------- Invoices -------------------------------- */
  listInvoices: (organizationId: string, filters: InvoiceListFilters, options: ListOptions = {}) =>
    api.list<InvoiceSummary>(`${org(organizationId)}/invoices`, {
      query: { ...invoiceQuery(filters), limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  getInvoice: (organizationId: string, invoiceId: string, signal?: AbortSignal) =>
    api.get<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}`, { signal }),
  createInvoice: (organizationId: string, body: InvoiceCreate) =>
    api.post<InvoiceDetail>(`${org(organizationId)}/invoices`, body),
  updateInvoice: (organizationId: string, invoiceId: string, body: InvoiceHeaderUpdate) =>
    api.patch<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}`, body),
  bulkInvoices: (organizationId: string, body: InvoiceBulkRequest) =>
    api.post<BulkResult<'delete'>>(`${org(organizationId)}/invoices/bulk`, body),
  deleteInvoice: (organizationId: string, invoiceId: string) =>
    api.delete<null>(`${org(organizationId)}/invoices/${seg(invoiceId)}`),
  addLine: (organizationId: string, invoiceId: string, body: InvoiceLineCreate) =>
    api.post<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}/lines`, body),
  updateLine: (
    organizationId: string,
    invoiceId: string,
    lineId: string,
    body: InvoiceLineUpdate,
  ) =>
    api.patch<InvoiceDetail>(
      `${org(organizationId)}/invoices/${seg(invoiceId)}/lines/${seg(lineId)}`,
      body,
    ),
  deleteLine: (organizationId: string, invoiceId: string, lineId: string) =>
    api.delete<InvoiceDetail>(
      `${org(organizationId)}/invoices/${seg(invoiceId)}/lines/${seg(lineId)}`,
    ),
  issueInvoice: (organizationId: string, invoiceId: string, body: InvoiceIssueBody) =>
    api.post<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}/issue`, body),
  voidInvoice: (organizationId: string, invoiceId: string, reason: string) =>
    api.post<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}/void`, { reason }),
  sendInvoice: (organizationId: string, invoiceId: string, to?: string[]) =>
    api.post<InvoiceSent>(
      `${org(organizationId)}/invoices/${seg(invoiceId)}/send`,
      to ? { to } : undefined,
    ),
  /** The invoice PDF, read with the Bearer header (a link could not carry it). */
  invoicePdf: (organizationId: string, invoiceId: string, templateId?: string) =>
    api.getBlob(`${org(organizationId)}/invoices/${seg(invoiceId)}/pdf`, {
      query: { template_id: templateId },
      accept: 'application/pdf',
    }),
  /** The counts of the status tabs and the money figures, for the filters of the list. */
  invoiceSummary: (organizationId: string, filters: InvoiceListFilters, signal?: AbortSignal) =>
    api.get<InvoiceListSummary>(`${org(organizationId)}/invoices/summary`, {
      query: { ...invoiceQuery({ ...filters, status: undefined, outstanding: undefined }) },
      signal,
    }),
  submitInvoice: (organizationId: string, invoiceId: string, note?: string) =>
    api.post<InvoiceDetail>(
      `${org(organizationId)}/invoices/${seg(invoiceId)}/submit`,
      note ? { note } : {},
    ),
  approveInvoice: (organizationId: string, invoiceId: string, note?: string) =>
    api.post<InvoiceDetail>(
      `${org(organizationId)}/invoices/${seg(invoiceId)}/approve`,
      note ? { note } : {},
    ),
  rejectInvoice: (organizationId: string, invoiceId: string, reason: string) =>
    api.post<InvoiceDetail>(`${org(organizationId)}/invoices/${seg(invoiceId)}/reject`, {
      reason,
    }),

  /* ------------------------------ Credit notes ------------------------------ */
  listCreditNotes: (
    organizationId: string,
    filters: CreditNoteListFilters,
    options: ListOptions = {},
  ) =>
    api.list<CreditNote>(`${org(organizationId)}/credit-notes`, {
      query: { ...filters, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  getCreditNote: (organizationId: string, creditNoteId: string, signal?: AbortSignal) =>
    api.get<CreditNote>(`${org(organizationId)}/credit-notes/${seg(creditNoteId)}`, { signal }),
  createCreditNote: (organizationId: string, invoiceId: string, body: CreditNoteCreate) =>
    api.post<CreditNote>(`${org(organizationId)}/invoices/${seg(invoiceId)}/credit-notes`, body),
  creditNotePdf: (organizationId: string, creditNoteId: string) =>
    api.getBlob(`${org(organizationId)}/credit-notes/${seg(creditNoteId)}/pdf`, {
      accept: 'application/pdf',
    }),

  /* -------------------------------- Payments -------------------------------- */
  listPayments: (organizationId: string, filters: PaymentListFilters, options: ListOptions = {}) =>
    api.list<Payment>(`${org(organizationId)}/payments`, {
      query: { ...filters, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  getPayment: (organizationId: string, paymentId: string, signal?: AbortSignal) =>
    api.get<Payment>(`${org(organizationId)}/payments/${seg(paymentId)}`, { signal }),
  createPayment: (organizationId: string, body: PaymentCreate) =>
    api.post<Payment>(`${org(organizationId)}/payments`, body),
  allocatePayment: (organizationId: string, paymentId: string, body: AllocateBody) =>
    api.post<Payment>(`${org(organizationId)}/payments/${seg(paymentId)}/allocations`, body),
  removeAllocation: (organizationId: string, paymentId: string, allocationId: string) =>
    api.delete<Payment>(
      `${org(organizationId)}/payments/${seg(paymentId)}/allocations/${seg(allocationId)}`,
    ),
  voidPayment: (organizationId: string, paymentId: string, reason?: string) =>
    api.post<Payment>(
      `${org(organizationId)}/payments/${seg(paymentId)}/void`,
      reason ? { reason } : undefined,
    ),
  /** Reverses a payment (a bounced cheque): every allocation goes at once. */
  reversePayment: (
    organizationId: string,
    paymentId: string,
    body: { reason: string; bounced: boolean },
  ) => api.post<Payment>(`${org(organizationId)}/payments/${seg(paymentId)}/reverse`, body),

  /* ------------------------------- Statements ------------------------------- */
  getStatement: (
    organizationId: string,
    clientId: string,
    range: { from?: string; to?: string },
    signal?: AbortSignal,
  ) =>
    api.get<Statement>(`${org(organizationId)}/clients/${seg(clientId)}/statement`, {
      query: { date_from: range.from, date_to: range.to },
      signal,
    }),
  statementPdf: (organizationId: string, clientId: string, range: { from?: string; to?: string }) =>
    api.getBlob(`${org(organizationId)}/clients/${seg(clientId)}/statement/pdf`, {
      query: { date_from: range.from, date_to: range.to },
      accept: 'application/pdf',
    }),
  /** Queues the statement as an email with the PDF (to the client's billing recipients). */
  sendStatement: (organizationId: string, clientId: string, body: StatementSendBody) =>
    api.post<StatementSent>(`${org(organizationId)}/clients/${seg(clientId)}/statement/send`, body),
  /** The clients that owe something or hold cash on account, with their last statement. */
  listStatements: (
    organizationId: string,
    filters: StatementListFilters,
    sort: { sort: StatementSort; order: SortOrder },
    options: ListOptions = {},
  ) =>
    api.withMessage<StatementsPage>(`${org(organizationId)}/statements`, {
      query: { ...filters, ...sort, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),

  /* ------------------------------- Debtors ------------------------------- */
  listDebtors: (
    organizationId: string,
    filters: DebtorFilters,
    sort: { sort: DebtorSort; order: SortOrder },
    options: ListOptions = {},
  ) =>
    api.withMessage<DebtorsPage>(`${org(organizationId)}/debtors`, {
      query: { ...filters, ...sort, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  getDebtorInvoices: (
    organizationId: string,
    clientId: string,
    asAt?: string,
    signal?: AbortSignal,
  ) =>
    api.get<DebtorInvoices>(`${org(organizationId)}/debtors/${seg(clientId)}/invoices`, {
      query: { as_at: asAt },
      signal,
    }),
  /** Queues payment reminder emails; with `dry_run` nothing is sent and the emails are returned. */
  sendReminders: (organizationId: string, body: ReminderRequest) =>
    api.post<ReminderResult>(`${org(organizationId)}/debtors/reminders`, body),
  listReminders: (organizationId: string, filters: ReminderLogFilters, options: ListOptions = {}) =>
    api.list<ReminderLogEntry>(`${org(organizationId)}/debtors/reminders`, {
      query: { ...filters, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),

  /* ------------------------ Credit notes and WIP ------------------------ */
  /** Returns the credited work to WIP, or writes it off (WIP's endpoint, once per credit note). */
  createCreditNoteWip: (
    organizationId: string,
    creditNoteId: string,
    body: { mode: CreditNoteWipMode; reason: string },
  ) =>
    api.post<CreditNoteWip>(`${org(organizationId)}/credit-notes/${seg(creditNoteId)}/wip`, body),

  /* ---------------------- What the preparation reads ---------------------- */
  getClientWip: (organizationId: string, clientId: string, jobId?: string, signal?: AbortSignal) =>
    api.get<ClientWip>(`${org(organizationId)}/clients/${seg(clientId)}/wip`, {
      query: { job_id: jobId },
      signal,
    }),
  getClientBilling: (organizationId: string, clientId: string, signal?: AbortSignal) =>
    api.get<ClientBillingDefaults>(`${org(organizationId)}/clients/${seg(clientId)}`, { signal }),
  listVatRates: (organizationId: string, signal?: AbortSignal) =>
    api.get<VatOption[]>(`${org(organizationId)}/vat-rates`, { signal }),

  /* ------------------------------- Estimates ------------------------------- */
  listEstimates: (
    organizationId: string,
    filters: EstimateListFilters,
    options: ListOptions = {},
  ) =>
    api.list<EstimateSummary>(`${org(organizationId)}/estimates`, {
      query: { ...filters, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  /** The counts of the status tabs and the value still open, for the client and search filters. */
  estimateSummary: (
    organizationId: string,
    filters: Pick<EstimateListFilters, 'client_id' | 'q'>,
    signal?: AbortSignal,
  ) =>
    api.get<EstimateListSummary>(`${org(organizationId)}/estimates/summary`, {
      query: { client_id: filters.client_id, q: filters.q },
      signal,
    }),
  getEstimate: (organizationId: string, estimateId: string, signal?: AbortSignal) =>
    api.get<Estimate>(`${org(organizationId)}/estimates/${seg(estimateId)}`, { signal }),
  createEstimate: (organizationId: string, body: EstimateCreate) =>
    api.post<Estimate>(`${org(organizationId)}/estimates`, body),
  updateEstimate: (organizationId: string, estimateId: string, body: EstimateUpdate) =>
    api.patch<Estimate>(`${org(organizationId)}/estimates/${seg(estimateId)}`, body),
  deleteEstimate: (organizationId: string, estimateId: string) =>
    api.delete<null>(`${org(organizationId)}/estimates/${seg(estimateId)}`),
  sendEstimate: (organizationId: string, estimateId: string, body: EstimateSendBody = {}) =>
    api.post<Estimate>(`${org(organizationId)}/estimates/${seg(estimateId)}/send`, body),
  acceptEstimate: (organizationId: string, estimateId: string) =>
    api.post<Estimate>(`${org(organizationId)}/estimates/${seg(estimateId)}/accept`),
  declineEstimate: (organizationId: string, estimateId: string) =>
    api.post<Estimate>(`${org(organizationId)}/estimates/${seg(estimateId)}/decline`),
  convertEstimate: (organizationId: string, estimateId: string) =>
    api.post<EstimateConverted>(`${org(organizationId)}/estimates/${seg(estimateId)}/convert`),

  /* ------------------------- Recurring invoice schedules ------------------------- */
  listSchedules: (
    organizationId: string,
    filters: ScheduleListFilters,
    options: ListOptions = {},
  ) =>
    api.list<ScheduleSummary>(`${org(organizationId)}/recurring`, {
      query: { ...filters, limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  getSchedule: (organizationId: string, scheduleId: string, signal?: AbortSignal) =>
    api.get<Schedule>(`${org(organizationId)}/recurring/${seg(scheduleId)}`, { signal }),
  createSchedule: (organizationId: string, body: ScheduleCreate) =>
    api.post<Schedule>(`${org(organizationId)}/recurring`, body),
  updateSchedule: (organizationId: string, scheduleId: string, body: ScheduleUpdate) =>
    api.patch<Schedule>(`${org(organizationId)}/recurring/${seg(scheduleId)}`, body),
  deleteSchedule: (organizationId: string, scheduleId: string) =>
    api.delete<null>(`${org(organizationId)}/recurring/${seg(scheduleId)}`),
  pauseSchedule: (organizationId: string, scheduleId: string) =>
    api.post<Schedule>(`${org(organizationId)}/recurring/${seg(scheduleId)}/pause`),
  resumeSchedule: (organizationId: string, scheduleId: string) =>
    api.post<Schedule>(`${org(organizationId)}/recurring/${seg(scheduleId)}/resume`),
  listScheduleRuns: (organizationId: string, scheduleId: string, options: ListOptions = {}) =>
    api.list<ScheduleRun>(`${org(organizationId)}/recurring/${seg(scheduleId)}/runs`, {
      query: { limit: options.limit, cursor: options.cursor },
      signal: options.signal,
    }),
  /** Tries a failed run again; answers 200 even when it fails again (read `status`). */
  retryRun: (organizationId: string, runId: string) =>
    api.post<ScheduleRun>(`${org(organizationId)}/recurring/runs/${seg(runId)}/retry`),
};
