import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  ApprovalFilters,
  ClaimFilters,
  ExpenseClaimDetail,
  ExpenseClaimInput,
  ExpenseLineInput,
  ExpenseLineUpdate,
} from '../types';
import { expensesApi } from './expensesApi';
import { useExpenseInvalidation } from './invalidation';
import { expenseKeys } from './keys';
import { nextCursor } from './pages';

/** The claim list: previous rows stay visible while a new filter or search loads. */
export function useClaimList(filters: ClaimFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.claimList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listClaims(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** The approval queue, oldest submission first. */
export function useApprovalQueue(filters: ApprovalFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: expenseKeys.approvalList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      expensesApi.listApprovals(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/** One claim with its lines, receipts and history. */
export function useClaim(claimId: string | undefined, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: expenseKeys.claim(organization.id, claimId ?? ''),
    queryFn: ({ signal }) => expensesApi.getClaim(organization.id, claimId ?? '', signal),
    enabled: Boolean(claimId) && (options.enabled ?? true),
  });
}

/** Counts by status and the approval badge (the tabs, the approvals count). */
export function useExpenseSummary(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: expenseKeys.summary(organization.id),
    queryFn: ({ signal }) => expensesApi.summary(organization.id, signal),
    enabled: options.enabled ?? true,
    staleTime: 15_000,
  });
}

export function useCreateClaim() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (body: ExpenseClaimInput) => expensesApi.createClaim(organization.id, body),
    onSuccess: (claim) => {
      queryClient.setQueryData(expenseKeys.claim(organization.id, claim.id), claim);
    },
    onSettled: invalidate.claims,
  });
}

/** What every claim-changing call does with its answer: the claim is the fresh detail. */
function useKeepClaim() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return (claim: ExpenseClaimDetail) => {
    queryClient.setQueryData(expenseKeys.claim(organization.id, claim.id), claim);
  };
}

export function useUpdateClaimTitle() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  const keep = useKeepClaim();
  return useMutation({
    mutationFn: ({ claimId, title }: { claimId: string; title: string | null }) =>
      expensesApi.updateClaim(organization.id, claimId, { title }),
    onSuccess: keep,
    onSettled: (_claim, _error, { claimId }) => invalidate.claim(claimId),
  });
}

export function useDeleteClaim() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (claimId: string) => expensesApi.deleteClaim(organization.id, claimId),
    onSettled: invalidate.claims,
  });
}

export type SaveLineVariables =
  | { mode: 'add'; claimId: string; body: ExpenseLineInput }
  | { mode: 'update'; claimId: string; lineId: string; body: ExpenseLineUpdate };

/**
 * Adds a line or changes one. A change with a `reason` corrects a line of an approved claim,
 * which moves the work in progress too.
 */
export function useSaveLine() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (variables: SaveLineVariables) =>
      variables.mode === 'add'
        ? expensesApi.addLine(organization.id, variables.claimId, variables.body)
        : expensesApi.updateLine(
            organization.id,
            variables.claimId,
            variables.lineId,
            variables.body,
          ),
    onSettled: (_line, _error, variables) => {
      if (variables.mode === 'update' && variables.body.reason) {
        invalidate.decided(variables.claimId);
      } else {
        invalidate.claim(variables.claimId);
      }
    },
  });
}

export function useDeleteLine() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: ({ claimId, lineId }: { claimId: string; lineId: string }) =>
      expensesApi.deleteLine(organization.id, claimId, lineId),
    onSettled: (_data, _error, { claimId }) => invalidate.claim(claimId),
  });
}

export function useSubmitClaim() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  const keep = useKeepClaim();
  return useMutation({
    mutationFn: (claimId: string) => expensesApi.submit(organization.id, claimId),
    onSuccess: keep,
    onSettled: (_claim, _error, claimId) => invalidate.claim(claimId),
  });
}

export function useRecallClaim() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  const keep = useKeepClaim();
  return useMutation({
    mutationFn: (claimId: string) => expensesApi.recall(organization.id, claimId),
    onSuccess: keep,
    onSettled: (_claim, _error, claimId) => invalidate.claim(claimId),
  });
}

export function useApproveClaim() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  const keep = useKeepClaim();
  return useMutation({
    mutationFn: ({ claimId, note }: { claimId: string; note?: string }) =>
      expensesApi.approve(organization.id, claimId, note),
    onSuccess: keep,
    onSettled: (_claim, _error, { claimId }) => invalidate.decided(claimId),
  });
}

export function useReturnClaim() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  const keep = useKeepClaim();
  return useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      expensesApi.returnClaim(organization.id, claimId, reason),
    onSuccess: keep,
    onSettled: (_claim, _error, { claimId }) => invalidate.claim(claimId),
  });
}

/** Approves every claim or none (the API is atomic); the result carries the message. */
export function useBulkApprove() {
  const { organization } = useOrg();
  const invalidate = useExpenseInvalidation();
  return useMutation({
    mutationFn: (claimIds: string[]) => expensesApi.bulkApprove(organization.id, claimIds),
    onSettled: () => invalidate.decided(),
  });
}
