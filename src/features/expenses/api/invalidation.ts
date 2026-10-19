import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { expenseKeys } from './keys';

/**
 * What to refresh after each kind of change. Everything is only marked stale and refetched when
 * something shows it, so listing the neighbours is cheap. The cached bytes of receipts are never
 * invalidated: a file does not change.
 */
export function useExpenseInvalidation() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const id = organization.id;

  return useMemo(() => {
    const refresh = (...keys: ReadonlyArray<readonly unknown[]>) => {
      for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
    };
    const audit = queryKeys.org.auditLogs(id);
    // What counts claims: the lists, the badges, the queue, the receipt and line views.
    const claimViews = [
      expenseKeys.claimLists(id),
      expenseKeys.summary(id),
      expenseKeys.approvals(id),
      expenseKeys.receipts(id),
      expenseKeys.lines(id),
    ] as const;

    return {
      /** One claim changed (a line, a receipt, the title, its status). */
      claim: (claimId: string) => refresh(expenseKeys.claim(id, claimId), ...claimViews, audit),
      /** Claims were created, deleted or decided in bulk. */
      claims: () => refresh(expenseKeys.claimDetails(id), ...claimViews, audit),
      /**
       * A claim was approved, or an approved line corrected: its billable lines are work in
       * progress, so the money screens move with it.
       */
      decided: (claimId?: string) => {
        refresh(
          claimId ? expenseKeys.claim(id, claimId) : expenseKeys.claimDetails(id),
          ...claimViews,
          queryKeys.org.wip(id),
          queryKeys.org.clients(id),
          queryKeys.org.dashboard(id),
          queryKeys.org.reports(id),
          audit,
        );
      },
      /** A receipt came or went: the claim, the receipt list and the lines still without one. */
      receipts: (claimId: string) =>
        refresh(
          expenseKeys.claim(id, claimId),
          expenseKeys.claimLists(id),
          expenseKeys.receipts(id),
          expenseKeys.lines(id),
          audit,
        ),
      types: () => refresh(expenseKeys.types(id), audit),
      /** A disbursement changed: its list, the client's expenses tab and WIP. */
      disbursements: () =>
        refresh(
          expenseKeys.disbursements(id),
          queryKeys.org.clients(id),
          queryKeys.org.wip(id),
          audit,
        ),
    };
  }, [queryClient, id]);
}
