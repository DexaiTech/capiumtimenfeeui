import { keepPreviousData, useInfiniteQuery, useMutation } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { DisbursementCreate, DisbursementFilters, DisbursementUpdate } from '../types';
import { expensesApi } from './expensesApi';
import { useExpenseInvalidation } from './invalidation';
import { expenseKeys } from './keys';
import { nextCursor } from './pages';

/** Disbursements, newest first (`wip.read` sees all, `disbursement.log` only its own). */
export function useDisbursementList(
  filters: DisbursementFilters,
  options: { enabled?: boolean } = {},
) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.disbursementList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listDisbursements(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export type SaveDisbursementVariables =
  | { mode: 'create'; body: DisbursementCreate }
  | { mode: 'update'; id: string; body: DisbursementUpdate };

export function useSaveDisbursement() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (variables: SaveDisbursementVariables) =>
      variables.mode === 'create'
        ? expensesApi.createDisbursement(organization.id, variables.body)
        : expensesApi.updateDisbursement(organization.id, variables.id, variables.body),
    onSettled: invalidate.disbursements,
  });
}

export function useDeleteDisbursement() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (id: string) => expensesApi.deleteDisbursement(organization.id, id),
    onSettled: invalidate.disbursements,
  });
}
