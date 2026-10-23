import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import { LIST_PAGE_SIZE } from '../constants';
import type {
  InvoiceBulkRequest,
  InvoiceCreate,
  InvoiceDetail,
  InvoiceHeaderUpdate,
  InvoiceIssueBody,
  InvoiceLineCreate,
  InvoiceLineUpdate,
  InvoiceListFilters,
} from '../types';
import { billingApi } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { nextCursor } from './pages';

/** The invoice list, newest first: previous rows stay visible while a new filter loads. */
export function useInvoiceList(filters: InvoiceListFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.invoiceList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listInvoices(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** The counts of the status tabs and the money figures for the list's filters (not the status). */
export function useInvoiceSummary(filters: InvoiceListFilters) {
  const { organization } = useOrg();
  const { client_id, date_from, date_to, q } = filters;
  const scope = { client_id, date_from, date_to, q };
  return useQuery({
    queryKey: billingKeys.invoiceSummary(organization.id, scope),
    queryFn: ({ signal }) => billingApi.invoiceSummary(organization.id, scope, signal),
    placeholderData: keepPreviousData,
  });
}

/** One invoice with its lines, WIP, payments and credit notes. */
export function useInvoice(invoiceId: string | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.invoice(organization.id, invoiceId ?? ''),
    queryFn: ({ signal }) => billingApi.getInvoice(organization.id, invoiceId ?? '', signal),
    enabled: Boolean(invoiceId),
  });
}

/** Keeps the detail on screen current with what a change returned, before the refetch lands. */
function useDetailCache() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return (invoice: InvoiceDetail) =>
    queryClient.setQueryData(billingKeys.invoice(organization.id, invoice.id), invoice);
}

export function useCreateInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: InvoiceCreate) => billingApi.createInvoice(organization.id, body),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

export function useUpdateInvoice(invoiceId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: InvoiceHeaderUpdate) =>
      billingApi.updateInvoice(organization.id, invoiceId, body),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

/** Deletes a draft; its WIP goes back to unbilled. Takes the id so a list can use it per row. */
export function useDeleteInvoice() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (invoiceId: string) => billingApi.deleteInvoice(organization.id, invoiceId),
    onSuccess: (_result, invoiceId) =>
      queryClient.removeQueries({ queryKey: billingKeys.invoice(organization.id, invoiceId) }),
    onSettled: invalidate.invoices,
  });
}

/** Deletes the selected drafts: all or nothing (`POST /invoices/bulk`). */
export function useBulkInvoices() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (body: InvoiceBulkRequest) => billingApi.bulkInvoices(organization.id, body),
    onSuccess: (_result, body) => {
      for (const invoiceId of body.invoice_ids) {
        queryClient.removeQueries({ queryKey: billingKeys.invoice(organization.id, invoiceId) });
      }
    },
    onSettled: invalidate.invoices,
  });
}

export function useAddInvoiceLine(invoiceId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: InvoiceLineCreate) => billingApi.addLine(organization.id, invoiceId, body),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

export function useUpdateInvoiceLine(invoiceId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ lineId, body }: { lineId: string; body: InvoiceLineUpdate }) =>
      billingApi.updateLine(organization.id, invoiceId, lineId, body),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

export function useDeleteInvoiceLine(invoiceId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (lineId: string) => billingApi.deleteLine(organization.id, invoiceId, lineId),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

/** Issues a draft (numbers it, WIP becomes billed). Takes the id so a list can issue several. */
export function useIssueInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ invoiceId, body }: { invoiceId: string; body?: InvoiceIssueBody }) =>
      billingApi.issueInvoice(organization.id, invoiceId, body ?? {}),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

export function useVoidInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      billingApi.voidInvoice(organization.id, invoiceId, reason),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

/** Queues the email of an issued invoice (to the given addresses, else the client's). */
export function useSendInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: ({ invoiceId, to }: { invoiceId: string; to?: string[] }) =>
      billingApi.sendInvoice(organization.id, invoiceId, to),
    onSettled: invalidate.invoices,
  });
}

/** Sends a draft for approval. Takes the id so the wizard can submit what it just created. */
export function useSubmitInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ invoiceId, note }: { invoiceId: string; note?: string }) =>
      billingApi.submitInvoice(organization.id, invoiceId, note),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

export function useApproveInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ invoiceId, note }: { invoiceId: string; note?: string }) =>
      billingApi.approveInvoice(organization.id, invoiceId, note),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}

/** Rejects an invoice that is awaiting approval (or approved): it goes back to draft. */
export function useRejectInvoice() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ invoiceId, reason }: { invoiceId: string; reason: string }) =>
      billingApi.rejectInvoice(organization.id, invoiceId, reason),
    onSuccess: cache,
    onSettled: invalidate.invoices,
  });
}
