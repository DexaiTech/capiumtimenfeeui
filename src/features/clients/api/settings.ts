import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import { api } from '@/services/api';

import type { ClientRateCreate, ClientRateRead } from '../types';
import type { InvoiceTemplateOption, VatRateOption } from '../workspace/types';
import { clientKeys, org, seg, useInvalidateClients } from './clients';

/** The lookups of the settings cards and the client rate overrides (`rates.py`, `settings.py`). */
export const clientSettingsApi = {
  /** Live VAT rates, highest first. Any member. */
  vatRates: (organizationId: string, signal?: AbortSignal) =>
    api.get<VatRateOption[]>(`${org(organizationId)}/vat-rates`, { signal }),
  /** Active invoice templates, the default first. Any member. */
  invoiceTemplates: (organizationId: string, signal?: AbortSignal) =>
    api.get<InvoiceTemplateOption[]>(`${org(organizationId)}/invoice-templates`, { signal }),

  createRate: (organizationId: string, clientId: string, body: ClientRateCreate) =>
    api.post<ClientRateRead>(`${org(organizationId)}/clients/${seg(clientId)}/rates`, body),
  /** Changes the hourly rate (`rate.manage`). */
  updateRate: (organizationId: string, clientId: string, rateId: string, hourlyRate: number) =>
    api.patch<ClientRateRead>(
      `${org(organizationId)}/clients/${seg(clientId)}/rates/${seg(rateId)}`,
      { hourly_rate: hourlyRate },
    ),
  /** A client rate is a rate rule: `PATCH /rates/{id}` sets or clears its end date. */
  setRateEnd: (organizationId: string, rateId: string, effectiveTo: string | null) =>
    api.patch<unknown>(`${org(organizationId)}/rates/${seg(rateId)}`, {
      effective_to: effectiveTo,
    }),
  deleteRate: (organizationId: string, clientId: string, rateId: string) =>
    api.delete<null>(`${org(organizationId)}/clients/${seg(clientId)}/rates/${seg(rateId)}`),
};

export function useVatRates(enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.vatRates(organization.id),
    queryFn: ({ signal }) => clientSettingsApi.vatRates(organization.id, signal),
    staleTime: 5 * 60_000,
    enabled,
  });
}

export function useInvoiceTemplates(enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.invoiceTemplates(organization.id),
    queryFn: ({ signal }) => clientSettingsApi.invoiceTemplates(organization.id, signal),
    staleTime: 5 * 60_000,
    enabled,
  });
}

/**
 * A client rate is also a row of the Team & Rates lists and history: after a change the client's
 * own data and those lists are refreshed.
 */
function useInvalidateRates() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  const invalidateClients = useInvalidateClients();
  return async () => {
    await Promise.all([
      invalidateClients(),
      queryClient.invalidateQueries({ queryKey: queryKeys.org.rateRules(organization.id) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.org.rateHistory(organization.id) }),
    ]);
  };
}

export function useCreateClientRate() {
  const { organization } = useOrg();
  const invalidate = useInvalidateRates();
  return useMutation({
    mutationFn: ({ clientId, body }: { clientId: string; body: ClientRateCreate }) =>
      clientSettingsApi.createRate(organization.id, clientId, body),
    onSuccess: invalidate,
  });
}

export function useUpdateClientRate() {
  const { organization } = useOrg();
  const invalidate = useInvalidateRates();
  return useMutation({
    mutationFn: ({
      clientId,
      rateId,
      hourlyRate,
    }: {
      clientId: string;
      rateId: string;
      hourlyRate: number;
    }) => clientSettingsApi.updateRate(organization.id, clientId, rateId, hourlyRate),
    onSuccess: invalidate,
  });
}

export function useSetClientRateEnd() {
  const { organization } = useOrg();
  const invalidate = useInvalidateRates();
  return useMutation({
    mutationFn: ({ rateId, effectiveTo }: { rateId: string; effectiveTo: string | null }) =>
      clientSettingsApi.setRateEnd(organization.id, rateId, effectiveTo),
    onSuccess: invalidate,
  });
}

export function useDeleteClientRate() {
  const { organization } = useOrg();
  const invalidate = useInvalidateRates();
  return useMutation({
    mutationFn: ({ clientId, rateId }: { clientId: string; rateId: string }) =>
      clientSettingsApi.deleteRate(organization.id, clientId, rateId),
    onSuccess: invalidate,
  });
}
