import { useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { VatOption } from '../types';
import { billingApi } from './billingApi';
import { billingKeys } from './keys';

/** `GET /clients/{id}/statement` for the dates picked; read once a client is chosen. */
export function useStatement(clientId: string | null, range: { from: string; to: string }) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.statement(organization.id, clientId ?? '', range.from, range.to),
    queryFn: ({ signal }) =>
      billingApi.getStatement(
        organization.id,
        clientId ?? '',
        { from: range.from || undefined, to: range.to || undefined },
        signal,
      ),
    enabled: clientId !== null,
  });
}

/** The client's WIP items, read when the preparation reaches the items step. */
export function useClientWip(clientId: string | null, jobId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.clientWip(organization.id, clientId ?? '', jobId ?? ''),
    queryFn: ({ signal }) =>
      billingApi.getClientWip(organization.id, clientId ?? '', jobId ?? undefined, signal),
    enabled: clientId !== null,
    // The items move as people bill and log time: always read them fresh.
    staleTime: 0,
  });
}

/** What the client's billing settings give an invoice: terms, VAT code, template. */
export function useClientBilling(clientId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.clientBilling(organization.id, clientId ?? ''),
    queryFn: ({ signal }) => billingApi.getClientBilling(organization.id, clientId ?? '', signal),
    enabled: clientId !== null,
  });
}

/** The practice's active VAT codes (Standard, Reduced, Zero, Exempt, Outside scope, …). */
export function useVatOptions(): { options: VatOption[]; isPending: boolean; isError: boolean } {
  const { organization } = useOrg();
  const query = useQuery({
    queryKey: billingKeys.vatOptions(organization.id),
    queryFn: ({ signal }) => billingApi.listVatRates(organization.id, signal),
    staleTime: 5 * 60_000,
  });
  return {
    options: (query.data ?? []).filter((option) => !option.is_archived),
    isPending: query.isPending,
    isError: query.isError,
  };
}
