import { keepPreviousData, useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { OvertimeRateCreate, OvertimeRateFilters, StaffHoursCreate } from '../types';
import { useTeamInvalidation } from './invalidation';
import { teamKeys } from './keys';
import { nextCursor } from './pages';
import { teamApi } from './teamApi';

/** A person's standard hours, each period dated, current first (`member.read`). */
export function useStaffHours(staffId: string) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: teamKeys.staffHours(organization.id, staffId),
    queryFn: ({ signal }) => teamApi.listStaffHours(organization.id, staffId, signal),
  });
}

/** New standard hours from a date; the API ends the open-ended period the day before. */
export function useAddStaffHours(staffId: string) {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: StaffHoursCreate) => teamApi.addStaffHours(organization.id, staffId, body),
    onSettled: invalidate.hours,
  });
}

export function useOvertimeRates(filters: OvertimeRateFilters) {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: teamKeys.overtimeRateList(organization.id, filters),
    queryFn: ({ pageParam, signal }) =>
      teamApi.listOvertimeRates(organization.id, filters, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
  });
}

export function useCreateOvertimeRate() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (body: OvertimeRateCreate) => teamApi.createOvertimeRate(organization.id, body),
    onSettled: invalidate.overtimeRates,
  });
}

/** Sets the last day an overtime rate applies. */
export function useEndOvertimeRate() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: ({ rateId, effectiveTo }: { rateId: string; effectiveTo: string }) =>
      teamApi.endOvertimeRate(organization.id, rateId, effectiveTo),
    onSettled: invalidate.overtimeRates,
  });
}

export function useDeleteOvertimeRate() {
  const { organization } = useOrg();
  const invalidate = useTeamInvalidation();
  return useMutation({
    mutationFn: (rateId: string) => teamApi.deleteOvertimeRate(organization.id, rateId),
    onSettled: invalidate.overtimeRates,
  });
}
