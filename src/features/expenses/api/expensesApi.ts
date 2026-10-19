import { PAGE_SIZE } from '@/constants/limits';
import { api, type UploadOptions } from '@/services/api';

import type {
  ApprovalFilters,
  ClaimFilters,
  ClientRef,
  Disbursement,
  DisbursementCreate,
  DisbursementFilters,
  DisbursementUpdate,
  ExpenseClaim,
  ExpenseClaimDetail,
  ExpenseClaimInput,
  ExpenseLine,
  ExpenseLineInput,
  ExpenseLineListItem,
  ExpenseLineUpdate,
  ExpenseSummary,
  ExpenseType,
  ExpenseTypeCreate,
  ExpenseTypeUpdate,
  JobRef,
  LineFilters,
  Receipt,
  ReceiptFilters,
  ReceiptListItem,
  TypeFilters,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** A blank search is left out: the API ignores it anyway. */
const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/**
 * Typed wrappers over the expense endpoints (`docs/modules/expenses.md` of the API) and the
 * disbursements (`docs/modules/billing.md`). Query values that are empty are left out by the
 * client, a repeated value (`status`) is sent once per item.
 */
export const expensesApi = {
  /* --------------------------------- Types --------------------------------- */
  listTypes: (organizationId: string, filters: TypeFilters, page: PageRequest = {}) =>
    api.list<ExpenseType>(`${org(organizationId)}/expense-types`, {
      query: {
        q: text(filters.q),
        is_active: filters.is_active,
        is_mileage: filters.is_mileage,
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  createType: (organizationId: string, body: ExpenseTypeCreate) =>
    api.post<ExpenseType>(`${org(organizationId)}/expense-types`, body),
  updateType: (organizationId: string, typeId: string, body: ExpenseTypeUpdate) =>
    api.patch<ExpenseType>(`${org(organizationId)}/expense-types/${seg(typeId)}`, body),
  deleteType: (organizationId: string, typeId: string) =>
    api.delete<null>(`${org(organizationId)}/expense-types/${seg(typeId)}`),

  /* --------------------------------- Claims -------------------------------- */
  listClaims: (organizationId: string, filters: ClaimFilters, page: PageRequest = {}) =>
    api.list<ExpenseClaim>(`${org(organizationId)}/expense-claims`, {
      query: {
        status: filters.status,
        user_id: filters.user_id,
        mine: filters.mine,
        date_from: filters.date_from,
        date_to: filters.date_to,
        client_id: filters.client_id,
        job_id: filters.job_id,
        is_billable: filters.is_billable,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  getClaim: (organizationId: string, claimId: string, signal?: AbortSignal) =>
    api.get<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims/${seg(claimId)}`, {
      signal,
    }),
  summary: (organizationId: string, signal?: AbortSignal) =>
    api.get<ExpenseSummary>(`${org(organizationId)}/expense-claims/summary`, { signal }),
  createClaim: (organizationId: string, body: ExpenseClaimInput) =>
    api.post<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims`, body),
  updateClaim: (organizationId: string, claimId: string, body: { title: string | null }) =>
    api.patch<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims/${seg(claimId)}`, body),
  deleteClaim: (organizationId: string, claimId: string) =>
    api.delete<null>(`${org(organizationId)}/expense-claims/${seg(claimId)}`),

  /* --------------------------------- Lines --------------------------------- */
  addLine: (organizationId: string, claimId: string, body: ExpenseLineInput) =>
    api.post<ExpenseLine>(`${org(organizationId)}/expense-claims/${seg(claimId)}/lines`, body),
  updateLine: (organizationId: string, claimId: string, lineId: string, body: ExpenseLineUpdate) =>
    api.patch<ExpenseLine>(
      `${org(organizationId)}/expense-claims/${seg(claimId)}/lines/${seg(lineId)}`,
      body,
    ),
  deleteLine: (organizationId: string, claimId: string, lineId: string) =>
    api.delete<null>(`${org(organizationId)}/expense-claims/${seg(claimId)}/lines/${seg(lineId)}`),
  listLines: (organizationId: string, filters: LineFilters, page: PageRequest = {}) =>
    api.list<ExpenseLineListItem>(`${org(organizationId)}/expenses`, {
      query: {
        status: filters.status,
        user_id: filters.user_id,
        mine: filters.mine,
        client_id: filters.client_id,
        needs_receipt: filters.needs_receipt,
        date_from: filters.date_from,
        date_to: filters.date_to,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),

  /* -------------------------------- Workflow ------------------------------- */
  submit: (organizationId: string, claimId: string) =>
    api.post<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims/${seg(claimId)}/submit`),
  recall: (organizationId: string, claimId: string) =>
    api.post<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims/${seg(claimId)}/recall`),
  approve: (organizationId: string, claimId: string, note?: string) =>
    api.post<ExpenseClaimDetail>(
      `${org(organizationId)}/expense-claims/${seg(claimId)}/approve`,
      note ? { note } : undefined,
    ),
  returnClaim: (organizationId: string, claimId: string, reason: string) =>
    api.post<ExpenseClaimDetail>(`${org(organizationId)}/expense-claims/${seg(claimId)}/return`, {
      reason,
    }),
  listApprovals: (organizationId: string, filters: ApprovalFilters, page: PageRequest = {}) =>
    api.list<ExpenseClaim>(`${org(organizationId)}/expense-approvals`, {
      query: {
        user_id: filters.user_id,
        q: text(filters.q),
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  /** Approves every claim or none; the answer says how many (`message`). */
  bulkApprove: (organizationId: string, claimIds: string[]) =>
    api.withMessage<ExpenseClaim[]>(`${org(organizationId)}/expense-approvals/bulk-approve`, {
      method: 'POST',
      body: { claim_ids: claimIds },
    }),

  /* -------------------------------- Receipts ------------------------------- */
  listReceipts: (organizationId: string, filters: ReceiptFilters, page: PageRequest = {}) =>
    api.list<ReceiptListItem>(`${org(organizationId)}/expense-receipts`, {
      query: {
        claim_id: filters.claim_id,
        user_id: filters.user_id,
        mine: filters.mine,
        client_id: filters.client_id,
        status: filters.status,
        date_from: filters.date_from,
        date_to: filters.date_to,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  uploadReceipt: (
    organizationId: string,
    lineId: string,
    file: File,
    options: UploadOptions = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<Receipt>(
      `${org(organizationId)}/expenses/${seg(lineId)}/receipts`,
      form,
      options,
    );
  },
  /** The bytes of a receipt: the request carries the Bearer token, which `<img src>` could not. */
  downloadReceipt: (
    organizationId: string,
    lineId: string,
    receiptId: string,
    signal?: AbortSignal,
  ) =>
    api.getBlob(`${org(organizationId)}/expenses/${seg(lineId)}/receipts/${seg(receiptId)}`, {
      signal,
    }),
  deleteReceipt: (organizationId: string, lineId: string, receiptId: string) =>
    api.delete<null>(`${org(organizationId)}/expenses/${seg(lineId)}/receipts/${seg(receiptId)}`),

  /* ------------------------------ Disbursements ---------------------------- */
  listDisbursements: (
    organizationId: string,
    filters: DisbursementFilters,
    page: PageRequest = {},
  ) =>
    api.list<Disbursement>(`${org(organizationId)}/disbursements`, {
      query: {
        client_id: filters.client_id,
        job_id: filters.job_id,
        billing_status: filters.billing_status,
        is_billable: filters.is_billable,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  createDisbursement: (organizationId: string, body: DisbursementCreate) =>
    api.post<Disbursement>(`${org(organizationId)}/disbursements`, body),
  updateDisbursement: (organizationId: string, id: string, body: DisbursementUpdate) =>
    api.patch<Disbursement>(`${org(organizationId)}/disbursements/${seg(id)}`, body),
  deleteDisbursement: (organizationId: string, id: string) =>
    api.delete<null>(`${org(organizationId)}/disbursements/${seg(id)}`),

  /* --------------------------------- Names --------------------------------- */
  getClient: (organizationId: string, clientId: string, signal?: AbortSignal) =>
    api.get<ClientRef>(`${org(organizationId)}/clients/${seg(clientId)}`, { signal }),
  getJob: (organizationId: string, jobId: string, signal?: AbortSignal) =>
    api.get<JobRef>(`${org(organizationId)}/jobs/${seg(jobId)}`, { signal }),
};
