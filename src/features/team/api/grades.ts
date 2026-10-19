import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { GradeCreate, GradeFilters, GradeUpdate } from '../types';
import { useTeamInvalidation } from './invalidation';
import { teamKeys } from './keys';
import { fetchEverything, nextCursor } from './pages';
import { teamApi } from './teamApi';

export function useGrades(filters: GradeFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.gradeList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listGrades(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** Every grade, in the practice's order: the choices of a grade select. */
export function useGradeOptions(options: { enabled?: boolean } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.gradeOptions(organization.id),
    queryFn: ({ signal }) =>
      fetchEverything((cursor) =>
        teamApi.listGrades(organization.id, {}, { cursor, signal, limit: 100 }),
      ),
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  });
}

export function useCreateGrade() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: GradeCreate) => teamApi.createGrade(organization.id, body),
    onSettled: invalidate.grades,
  });
}

export function useUpdateGrade() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ gradeId, body }: { gradeId: string; body: GradeUpdate }) =>
      teamApi.updateGrade(organization.id, gradeId, body),
    onSettled: invalidate.grades,
  });
}

/** Deletes an unused grade, or deactivates a used one; the result says which. */
export function useDeleteGrade() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (gradeId: string) => teamApi.deleteGrade(organization.id, gradeId),
    onSettled: invalidate.grades,
  });
}

export function useSetGradeActive() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ gradeId, active }: { gradeId: string; active: boolean }) =>
      teamApi.setGradeActive(organization.id, gradeId, active),
    onSettled: invalidate.grades,
  });
}
