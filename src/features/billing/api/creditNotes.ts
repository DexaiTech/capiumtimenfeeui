import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { LIST_PAGE_SIZE } from '../constants';
import type { CreditNoteCreate, CreditNoteListFilters, CreditNoteWipMode } from '../types';
import { billingApi } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { nextCursor } from './pages';

export function useCreditNoteList(filters: CreditNoteListFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.creditNoteList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listCreditNotes(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** One credit note with its lines (the list carries none). */
export function useCreditNote(creditNoteId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.creditNote(organization.id, creditNoteId ?? ''),
    queryFn: ({ signal }) => billingApi.getCreditNote(organization.id, creditNoteId ?? '', signal),
    enabled: creditNoteId !== null,
  });
}

export function useCreateCreditNote() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ invoiceId, body }: { invoiceId: string; body: CreditNoteCreate }) =>
      billingApi.createCreditNote(organization.id, invoiceId, body),
    onSettled: invalidate.creditNotes,
  });
}

/** What becomes of the work a credit note cleared: back to WIP, or written off. */
export function useCreditNoteWip() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({
      creditNoteId,
      mode,
      reason,
    }: {
      creditNoteId: string;
      mode: CreditNoteWipMode;
      reason: string;
    }) => billingApi.createCreditNoteWip(organization.id, creditNoteId, { mode, reason }),
    onSettled: invalidate.creditNotes,
  });
}
