import { queryKeys } from '@/constants/queryKeys';

import type {
  ApprovalFilters,
  ClaimFilters,
  DisbursementFilters,
  LineFilters,
  ReceiptFilters,
  TypeFilters,
} from '../types';

/**
 * Keys of the expense data, all under `['org', organizationId, 'expenses', …]` (disbursements
 * have their own root): the types, the claim lists, one claim, the summary, the approval queue,
 * the receipts and the cached bytes of their files.
 */
export const expenseKeys = {
  all: (organizationId: string) => queryKeys.org.expenses(organizationId),
  types: (organizationId: string) => [...queryKeys.org.expenses(organizationId), 'types'] as const,
  typeList: (organizationId: string, filters: TypeFilters) =>
    [...queryKeys.org.expenses(organizationId), 'types', 'list', filters] as const,
  /** Every type (or every active one), for a select: a plain list, not the pages of `typeList`. */
  typeOptions: (organizationId: string, activeOnly: boolean) =>
    [...queryKeys.org.expenses(organizationId), 'types', 'options', activeOnly] as const,
  claims: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'claims'] as const,
  claimLists: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'claims', 'list'] as const,
  claimList: (organizationId: string, filters: ClaimFilters) =>
    [...queryKeys.org.expenses(organizationId), 'claims', 'list', filters] as const,
  claim: (organizationId: string, claimId: string) =>
    [...queryKeys.org.expenses(organizationId), 'claims', 'detail', claimId] as const,
  claimDetails: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'claims', 'detail'] as const,
  summary: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'summary'] as const,
  approvals: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'approvals'] as const,
  approvalList: (organizationId: string, filters: ApprovalFilters) =>
    [...queryKeys.org.expenses(organizationId), 'approvals', 'list', filters] as const,
  receipts: (organizationId: string) =>
    [...queryKeys.org.expenses(organizationId), 'receipts'] as const,
  receiptList: (organizationId: string, filters: ReceiptFilters) =>
    [...queryKeys.org.expenses(organizationId), 'receipts', 'list', filters] as const,
  receiptFile: (organizationId: string, lineId: string, receiptId: string) =>
    [...queryKeys.org.expenses(organizationId), 'receipts', 'file', lineId, receiptId] as const,
  lines: (organizationId: string) => [...queryKeys.org.expenses(organizationId), 'lines'] as const,
  lineList: (organizationId: string, filters: LineFilters) =>
    [...queryKeys.org.expenses(organizationId), 'lines', 'list', filters] as const,
  disbursements: (organizationId: string) => queryKeys.org.disbursements(organizationId),
  disbursementList: (organizationId: string, filters: DisbursementFilters) =>
    [...queryKeys.org.disbursements(organizationId), 'list', filters] as const,
  /** A client or a job named by id (the disbursement list shows names). */
  clientName: (organizationId: string, clientId: string) =>
    [...queryKeys.org.expenses(organizationId), 'client-name', clientId] as const,
  jobName: (organizationId: string, jobId: string) =>
    [...queryKeys.org.expenses(organizationId), 'job-name', jobId] as const,
};
