import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type {
  RateHistoryFilters,
  RateRuleCreate,
  RateRuleFilters,
  RateRuleUpdate,
  RerateApply,
  RerateRequest,
  ResolveQuery,
  RerunItemOutcome,
} from '../types';
import { useTeamInvalidation } from './invalidation';
import { teamKeys } from './keys';
import { nextCursor } from './pages';
import { teamApi } from './teamApi';

export function useRateRules(filters: RateRuleFilters, options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.rateRuleList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listRateRules(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useCreateRateRule() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: RateRuleCreate) => teamApi.createRateRule(organization.id, body),
    onSettled: invalidate.rates,
  });
}

export function useUpdateRateRule() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: RateRuleUpdate }) =>
      teamApi.updateRateRule(organization.id, ruleId, body),
    onSettled: invalidate.rates,
  });
}

export function useDeleteRateRule() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (ruleId: string) => teamApi.deleteRateRule(organization.id, ruleId),
    onSettled: invalidate.rates,
  });
}

/**
 * "What rate would this person get?" for a submitted query (null: nothing asked yet). Nothing
 * is written, and a repeated question is asked again rather than answered from the cache.
 */
export function useRateResolution(query: ResolveQuery | null) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.rateResolution(organization.id, query ?? { user_id: '' }),
    queryFn: ({ signal }) =>
      query
        ? teamApi.resolveRate(organization.id, query, signal)
        : Promise.reject(new Error('No query')),
    enabled: query !== null,
    staleTime: 0,
  });
}

export function useRateHistory(filters: RateHistoryFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.rateHistoryList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listRateHistory(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** Nothing is changed by a preview; the result carries the token the apply must send back. */
export function usePreviewRerate() {
  const { organization } = useOrg();
  return useMutation({
    mutationFn: (body: RerateRequest) => teamApi.previewRerate(organization.id, body),
  });
}

export function useApplyRerate() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: RerateApply) => teamApi.applyRerate(organization.id, body),
    onSettled: invalidate.rerate,
  });
}

/** Earlier re-rating runs, newest first (needs `rate.read`). */
export function useReruns(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.rerunList(organization.id),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listReruns(organization.id, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    enabled: options.enabled ?? true,
  });
}

/** The entries one run changed or skipped, by entry date. */
export function useRerunItems(
  runId: string,
  outcome: RerunItemOutcome | undefined,
  options: { enabled?: boolean } = {},
) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.rerunItems(organization.id, runId, outcome),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listRerunItems(organization.id, runId, outcome, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}
