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
  Estimate,
  EstimateCreate,
  EstimateListFilters,
  EstimateSendBody,
  EstimateUpdate,
} from '../types';
import { billingApi } from './billingApi';
import { useBillingInvalidation } from './invalidation';
import { billingKeys } from './keys';
import { nextCursor } from './pages';

/** The estimate list, newest first: previous rows stay visible while a new filter loads. */
export function useEstimateList(filters: EstimateListFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: billingKeys.estimateList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      billingApi.listEstimates(organization.id, filters, {
        cursor: pageParam,
        limit: LIST_PAGE_SIZE,
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** The counts of the status tabs and the open value, for the client and search filters. */
export function useEstimateSummary(filters: EstimateListFilters) {
  const { organization } = useOrg();
  const scope = { client_id: filters.client_id, q: filters.q };
  return useQuery({
    queryKey: billingKeys.estimateSummary(organization.id, scope),
    queryFn: ({ signal }) => billingApi.estimateSummary(organization.id, scope, signal),
    placeholderData: keepPreviousData,
  });
}

/** One estimate with its lines. */
export function useEstimate(estimateId: string | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: billingKeys.estimate(organization.id, estimateId ?? ''),
    queryFn: ({ signal }) => billingApi.getEstimate(organization.id, estimateId ?? '', signal),
    enabled: estimateId !== null,
  });
}

/** Keeps the open estimate current with what a change returned, before the refetch lands. */
function useDetailCache() {
  const queryClient = useQueryClient();
  const { organization } = useOrg();
  return (estimate: Estimate) =>
    queryClient.setQueryData(billingKeys.estimate(organization.id, estimate.id), estimate);
}

export function useCreateEstimate() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: EstimateCreate) => billingApi.createEstimate(organization.id, body),
    onSuccess: cache,
    onSettled: invalidate.estimates,
  });
}

export function useUpdateEstimate(estimateId: string) {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (body: EstimateUpdate) =>
      billingApi.updateEstimate(organization.id, estimateId, body),
    onSuccess: cache,
    onSettled: invalidate.estimates,
  });
}

/** Deletes a draft. Takes the id so a list can use it per row. */
export function useDeleteEstimate() {
  const { organization } = useOrg();
  const queryClient = useQueryClient();
  const invalidate = useBillingInvalidation();
  return useMutation({
    mutationFn: (estimateId: string) => billingApi.deleteEstimate(organization.id, estimateId),
    onSuccess: (_result, estimateId) =>
      queryClient.removeQueries({ queryKey: billingKeys.estimate(organization.id, estimateId) }),
    onSettled: invalidate.estimates,
  });
}

export function useSendEstimate() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: ({ estimateId, body }: { estimateId: string; body?: EstimateSendBody }) =>
      billingApi.sendEstimate(organization.id, estimateId, body),
    onSuccess: cache,
    onSettled: invalidate.estimates,
  });
}

export function useAcceptEstimate() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (estimateId: string) => billingApi.acceptEstimate(organization.id, estimateId),
    onSuccess: cache,
    onSettled: invalidate.estimates,
  });
}

export function useDeclineEstimate() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (estimateId: string) => billingApi.declineEstimate(organization.id, estimateId),
    onSuccess: cache,
    onSettled: invalidate.estimates,
  });
}

/** Drafts an invoice from the estimate; the result carries the new invoice's id. */
export function useConvertEstimate() {
  const { organization } = useOrg();
  const invalidate = useBillingInvalidation();
  const cache = useDetailCache();
  return useMutation({
    mutationFn: (estimateId: string) => billingApi.convertEstimate(organization.id, estimateId),
    onSuccess: (result) => cache(result.estimate),
    onSettled: invalidate.estimateConverted,
  });
}
