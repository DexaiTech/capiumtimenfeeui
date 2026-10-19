/**
 * The data behind the Expenses tab, in one place. Today an expense is a disbursement
 * (`GET /disbursements?client_id=`); expense claims will arrive with their own endpoint, and
 * then only this file changes: it maps every source to `ExpenseRow`, the one shape the tab
 * knows. A person with `wip.read` sees every disbursement of the client, otherwise the ones
 * they recorded.
 */
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';
import { api } from '@/services/api';
import type { IsoDate, Pence } from '@/types/api';

import { RECORD_PAGE_SIZE } from '../workspace/constants';
import type { BillingStatus, DisbursementRow } from '../workspace/types';
import { clientKeys, nextCursor, org } from './clients';

export interface ExpenseRow {
  id: string;
  /** Where the line comes from; claims will add their own kind. */
  kind: 'disbursement';
  date: IsoDate;
  description: string;
  supplier: string | null;
  /** Pence before VAT. */
  amount: Pence;
  billable: boolean;
  status: BillingStatus;
  recordedBy: string | null;
}

export interface ExpenseFilters {
  from: string;
  to: string;
  billable: '' | 'true' | 'false';
  billing_status: BillingStatus | '';
}

export function toExpenseRow(row: DisbursementRow): ExpenseRow {
  return {
    id: row.id,
    kind: 'disbursement',
    date: row.incurred_on,
    description: row.description,
    supplier: row.supplier,
    amount: row.amount,
    billable: row.is_billable,
    status: row.billing_status,
    recordedBy: row.created_by,
  };
}

/** The client's expenses, newest first (`wip.read`, or the caller's own with `disbursement.log`). */
export function useClientExpenses(clientId: string, filters: ExpenseFilters, enabled = true) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: clientKeys.expenses(organization.id, clientId, filters),
    queryFn: ({ pageParam, signal }) =>
      api.list<DisbursementRow>(`${org(organization.id)}/disbursements`, {
        query: {
          client_id: clientId,
          date_from: filters.from || undefined,
          date_to: filters.to || undefined,
          is_billable: filters.billable || undefined,
          billing_status: filters.billing_status || undefined,
          limit: RECORD_PAGE_SIZE,
          cursor: pageParam,
        },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled,
    // Every source is mapped here, so the tab only ever sees `ExpenseRow`.
    select: (data) => ({
      ...data,
      pages: data.pages.map((page) => ({ ...page, data: page.data.map(toExpenseRow) })),
    }),
  });
}
