import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { LineFilters, ReceiptFilters } from '../types';
import { expensesApi } from './expensesApi';
import { useExpenseInvalidation } from './invalidation';
import { expenseKeys } from './keys';
import { nextCursor } from './pages';

/** The receipts the caller may see, with the line and the claim each proves. */
export function useReceiptList(filters: ReceiptFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.receiptList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listReceipts(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** Expense lines across claims (the "missing a receipt" view of the Receipts page). */
export function useLineList(filters: LineFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.lineList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listLines(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/**
 * The bytes of a receipt. The request carries the Bearer token (an `<img src>` or a link cannot),
 * and the blob stays cached while the page is open, so a thumbnail is fetched once.
 */
export function useReceiptFile(lineId: string, receiptId: string, enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: expenseKeys.receiptFile(organization.id, lineId, receiptId),
    queryFn: ({ signal }) =>
      expensesApi.downloadReceipt(organization.id, lineId, receiptId, signal),
    enabled,
    staleTime: Infinity,
    gcTime: 10 * 60_000,
    retry: false,
  });
}

export function useDeleteReceipt() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: ({ lineId, receiptId }: { claimId: string; lineId: string; receiptId: string }) =>
      expensesApi.deleteReceipt(organization.id, lineId, receiptId),
    onSettled: (_data, _error, { claimId }) => invalidate.receipts(claimId),
  });
}
