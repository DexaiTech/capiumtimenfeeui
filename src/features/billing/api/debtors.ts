import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { LIST_PAGE_SIZE } from '../constants';
import type {
  DebtorFilters,
  DebtorRow,
  DebtorSort,
  DebtorsPage,
  ReminderLogFilters,
  ReminderRequest,
  StatementListFilters,
  StatementRow,
  StatementSendBody,
  StatementSort,
  StatementsPage,
} from '../types';
import { billingApi, type PagedObject, type SortOrder } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { nextCursor } from './pages';

const nextOf = <TData>(last: PagedObject<TData>) => last.meta?.next_cursor ?? undefined;

export interface DebtorSortState {
  sort: DebtorSort;
  order: SortOrder;
}

/** What the debtors table shows: the rows loaded so far and the figures of every matching client. */
export function debtorsView(data: InfiniteData<PagedObject<DebtorsPage>> | undefined): {
  rows: DebtorRow[];
  first: DebtorsPage | undefined;
} {
  return { rows: data?.pages.flatMap((page) => page.data.rows) ?? [], first: data?.pages[0]?.data };
}

/** The clients that owe something, as at a date, with ageing buckets, newest filters first. */
export function useDebtors(filters: DebtorFilters, sort: DebtorSortState) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.debtors(organization.id, filters, sort),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listDebtors(organization.id, filters, sort, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextOf,
    placeholderData: keepPreviousData,
  });
}

/** One debtor's open invoices with days overdue and the last reminder (the drill-down). */
export function useDebtorInvoices(clientId: string | null, asAt: string) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.debtorInvoices(organization.id, clientId ?? '', asAt),
    queryFn: ({ signal }) =>
      billingApi.getDebtorInvoices(organization.id, clientId ?? '', asAt || undefined, signal),
    enabled: clientId !== null,
  });
}

/** The reminders sent so far, newest first. */
export function useReminderLog(filters: ReminderLogFilters, enabled = true) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.reminders(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listReminders(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled,
  });
}

/**
 * Queues payment reminders, or (with `dry_run`) returns the emails that would go out. A real run
 * refreshes the debtors and the reminder history.
 */
export function useSendReminders() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ReminderRequest) => billingApi.sendReminders(organization.id, body),
    onSuccess: (result) => {
      if (!result.dry_run) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.org.debtors(organization.id) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.org.auditLogs(organization.id) });
      }
    },
  });
}

export interface StatementSortState {
  sort: StatementSort;
  order: SortOrder;
}

export function statementsView(data: InfiniteData<PagedObject<StatementsPage>> | undefined): {
  rows: StatementRow[];
  first: StatementsPage | undefined;
} {
  return { rows: data?.pages.flatMap((page) => page.data.rows) ?? [], first: data?.pages[0]?.data };
}

/** The clients with a balance (or cash on account), with when each last had a statement. */
export function useStatementList(filters: StatementListFilters, sort: StatementSortState) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.statementList(organization.id, filters, sort),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listStatements(organization.id, filters, sort, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextOf,
    placeholderData: keepPreviousData,
  });
}

/** Queues a statement email for one client; refreshes the list that shows "last sent". */
export function useSendStatement() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: StatementSendBody }) =>
      billingApi.sendStatement(organization.id, clientId, body),
    onSettled: invalidate.statements,
  });
}
