import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import type {
  InvoiceTemplateCreate,
  InvoiceTemplateUpdate,
  Sequence,
  SequenceUpdate,
  VatRateCreate,
  VatRateUpdate,
} from '../billingTypes';
import { billingApi } from './billingApi';

/**
 * Keys of the billing settings, all under `['org', organizationId, …]`. The VAT list sits under
 * the `vat-rates` key the Team module's pickers also use, so a change here refreshes them.
 */
export const billingKeys = {
  vatRates: (organizationId: string) =>
    [...queryKeys.org.vatRates(organizationId), 'settings'] as const,
  sequences: (organizationId: string) =>
    [...queryKeys.org.sequences(organizationId), 'list'] as const,
  invoiceTemplates: (organizationId: string, includeInactive: boolean) =>
    [...queryKeys.org.invoiceTemplates(organizationId), 'list', { includeInactive }] as const,
};

type KeyRoot = (organizationId: string) => readonly unknown[];

/** Marks the data under each key root stale after a change; only what is shown is refetched. */
function useRefresh(...roots: KeyRoot[]) {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return () => {
    for (const root of roots) {
      void queryClient.invalidateQueries({ queryKey: root(organization.id) });
    }
  };
}

/* --------------------------------- VAT codes --------------------------------- */

/** Every VAT code, archived ones last (the list is bounded). Readable by any member. */
export function useVatRates() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.vatRates(organization.id),
    queryFn: ({ signal }) => billingApi.listVatRates(organization.id, signal),
  });
}

export function useCreateVatRate() {
  const { organization } = useOrg();
  const refresh = useRefresh(queryKeys.org.vatRates, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: (body: VatRateCreate) => billingApi.createVatRate(organization.id, body),
    onSettled: refresh,
  });
}

/** Changes, makes default, archives or restores: PATCH with the fields to change. */
export function useUpdateVatRate() {
  const { organization } = useOrg();
  const refresh = useRefresh(queryKeys.org.vatRates, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: ({ rateId, body }: { rateId: string; body: VatRateUpdate }) =>
      billingApi.updateVatRate(organization.id, rateId, body),
    onSettled: refresh,
  });
}

/** Deletes an unused VAT code; one that is used is archived instead (the outcome says which). */
export function useDeleteVatRate() {
  const { organization } = useOrg();
  const refresh = useRefresh(queryKeys.org.vatRates, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: (rateId: string) => billingApi.deleteVatRate(organization.id, rateId),
    onSettled: refresh,
  });
}

/* --------------------------------- Numbering --------------------------------- */

/** The number sequences with their next number, which moves as documents are issued. */
export function useSequences() {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.sequences(organization.id),
    queryFn: ({ signal }) => billingApi.listSequences(organization.id, signal),
    staleTime: 0,
  });
}

export function useUpdateSequence() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const refresh = useRefresh(queryKeys.org.sequences, queryKeys.org.auditLogs);
  return useMutation({
    mutationFn: ({ kind, body }: { kind: string; body: SequenceUpdate }) =>
      billingApi.updateSequence(organization.id, kind, body),
    onSuccess: (saved) => {
      queryClient.setQueryData<Sequence[]>(billingKeys.sequences(organization.id), (current) =>
        current?.map((item) => (item.kind === saved.kind ? saved : item)),
      );
    },
    // A refused number is answered with the current one: show it.
    onSettled: refresh,
  });
}

/* ----------------------------- Invoice templates ----------------------------- */

/**
 * The practice's invoice templates, the default first. Inactive ones are only listed to people
 * with `settings.manage` (the API refuses the request for anyone else), so they ask for them.
 */
export function useInvoiceTemplates(options: { includeInactive: boolean }) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.invoiceTemplates(organization.id, options.includeInactive),
    queryFn: ({ signal }) =>
      billingApi.listInvoiceTemplates(organization.id, options.includeInactive, signal),
  });
}

/** Templates are shown on the client's billing settings: a change reaches the clients too. */
function useTemplateRefresh() {
  return useRefresh(queryKeys.org.invoiceTemplates, queryKeys.org.clients, queryKeys.org.auditLogs);
}

export function useCreateInvoiceTemplate() {
  const { organization } = useOrg();
  const refresh = useTemplateRefresh();
  return useMutation({
    mutationFn: (body: InvoiceTemplateCreate) =>
      billingApi.createInvoiceTemplate(organization.id, body),
    onSettled: refresh,
  });
}

/** Changes the fields of a template, or activates and deactivates it with `status`. */
export function useUpdateInvoiceTemplate() {
  const { organization } = useOrg();
  const refresh = useTemplateRefresh();
  return useMutation({
    mutationFn: ({ templateId, body }: { templateId: string; body: InvoiceTemplateUpdate }) =>
      billingApi.updateInvoiceTemplate(organization.id, templateId, body),
    onSettled: refresh,
  });
}

export function useDeleteInvoiceTemplate() {
  const { organization } = useOrg();
  const refresh = useTemplateRefresh();
  return useMutation({
    mutationFn: (templateId: string) =>
      billingApi.deleteInvoiceTemplate(organization.id, templateId),
    onSettled: refresh,
  });
}

export function useMakeDefaultInvoiceTemplate() {
  const { organization } = useOrg();
  const refresh = useTemplateRefresh();
  return useMutation({
    mutationFn: (templateId: string) =>
      billingApi.makeDefaultInvoiceTemplate(organization.id, templateId),
    onSettled: refresh,
  });
}
