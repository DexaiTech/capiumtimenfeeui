import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { ExpenseTypeCreate, ExpenseTypeUpdate, TypeFilters } from '../types';
import { expensesApi } from './expensesApi';
import { useExpenseInvalidation } from './invalidation';
import { expenseKeys } from './keys';
import { fetchEverything, nextCursor } from './pages';

/** The expense types as pages, newest filters first (the Expense Types page). */
export function useExpenseTypeList(filters: TypeFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.typeList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listTypes(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/**
 * Every type (or every active one) for a select: a practice has a handful, so the pages are
 * followed to the end. Readable with `expense.log`, `expense.read_all` or `expense.manage`.
 */
export function useExpenseTypes(options: { activeOnly?: boolean; enabled?: boolean } = {}) {
  const { organization } = useOrg();
  const activeOnly = options.activeOnly ?? false;
  return useQuery({
    queryKey: expenseKeys.typeOptions(organization.id, activeOnly),
    queryFn: ({ signal }) =>
      fetchEverything(
        (cursor) =>
          expensesApi.listTypes(
            organization.id,
            { is_active: activeOnly ? true : undefined, sort: 'name', order: 'asc' },
            { cursor, signal, limit: 100 },
          ),
        5,
      ),
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  });
}

export type SaveTypeVariables =
  | { mode: 'create'; body: ExpenseTypeCreate }
  | { mode: 'update'; typeId: string; body: ExpenseTypeUpdate };

export function useSaveExpenseType() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (variables: SaveTypeVariables) =>
      variables.mode === 'create'
        ? expensesApi.createType(organization.id, variables.body)
        : expensesApi.updateType(organization.id, variables.typeId, variables.body),
    onSettled: invalidate.types,
  });
}

export function useDeleteExpenseType() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (typeId: string) => expensesApi.deleteType(organization.id, typeId),
    onSettled: invalidate.types,
  });
}
