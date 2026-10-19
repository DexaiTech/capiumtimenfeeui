import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { LIST_PAGE_SIZE } from '../constants';
import type { AllocateBody, Payment, PaymentCreate, PaymentListFilters } from '../types';
import { billingApi } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { fetchEverything, nextCursor } from './pages';

export function usePaymentList(filters: PaymentListFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.paymentList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listPayments(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** One payment with its allocations (the list carries none). */
export function usePayment(paymentId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.payment(organization.id, paymentId ?? ''),
    queryFn: ({ signal }) => billingApi.getPayment(organization.id, paymentId ?? '', signal),
    enabled: paymentId !== null,
  });
}

/** The issued invoices of a client that still owe money, oldest first (the allocation grid). */
export function useOpenInvoices(clientId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.openInvoices(organization.id, clientId ?? ''),
    queryFn: async ({ signal }) => {
      const { rows } = await fetchEverything(
        (cursor) =>
          billingApi.listInvoices(
            organization.id,
            { client_id: clientId ?? undefined, outstanding: true },
            { cursor, limit: 100, signal },
          ),
        500,
      );
      // The order auto-allocation pays in: issue date, then number.
      return rows.sort(
        (a, b) =>
          (a.issue_date ?? '').localeCompare(b.issue_date ?? '') ||
          (a.number ?? '').localeCompare(b.number ?? ''),
      );
    },
    enabled: clientId !== null,
  });
}

/** Keeps the payment on screen current with what a change returned, before the refetch lands. */
function usePaymentCache() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return (payment: Payment) =>
    queryClient.setQueryData(billingKeys.payment(organization.id, payment.id), payment);
}

export function useCreatePayment() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = usePaymentCache();
  return useMutation({
    mutationFn: (body: PaymentCreate) => billingApi.createPayment(organization.id, body),
    onSuccess: cache,
    onSettled: invalidate.payments,
  });
}

export function useAllocatePayment() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = usePaymentCache();
  return useMutation({
    mutationFn: ({ paymentId, body }: { paymentId: string; body: AllocateBody }) =>
      billingApi.allocatePayment(organization.id, paymentId, body),
    onSuccess: cache,
    onSettled: invalidate.payments,
  });
}

export function useRemoveAllocation() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = usePaymentCache();
  return useMutation({
    mutationFn: ({ paymentId, allocationId }: { paymentId: string; allocationId: string }) =>
      billingApi.removeAllocation(organization.id, paymentId, allocationId),
    onSuccess: cache,
    onSettled: invalidate.payments,
  });
}

export function useVoidPayment() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = usePaymentCache();
  return useMutation({
    mutationFn: ({ paymentId, reason }: { paymentId: string; reason?: string }) =>
      billingApi.voidPayment(organization.id, paymentId, reason),
    onSuccess: cache,
    onSettled: invalidate.payments,
  });
}

/** Reverses a payment in one step: every allocation goes and the invoices owe again. */
export function useReversePayment() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = usePaymentCache();
  return useMutation({
    mutationFn: ({
      paymentId,
      reason,
      bounced,
    }: {
      paymentId: string;
      reason: string;
      bounced: boolean;
    }) => billingApi.reversePayment(organization.id, paymentId, { reason, bounced }),
    onSuccess: cache,
    onSettled: invalidate.payments,
  });
}
