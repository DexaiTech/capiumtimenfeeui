import { useMutation, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { OvertimeFilters } from '../types';
import { useTimeInvalidation } from './invalidation';
import { timeKeys } from './keys';
import { fetchEverything } from './pages';
import { timeApi } from './timeApi';

/** Every overtime portion that matches (a sheet's week, or everything pending), all pages. */
export function useOvertime(
  filters: OvertimeFilters,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.overtime(organization.id, filters),
    queryFn: ({ signal }) =>
      fetchEverything((cursor) =>
        timeApi.listOvertime(organization.id, filters, { cursor, signal }),
      ),
    enabled,
  });
}

export function useApproveOvertime() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: (overtimeId: string) => timeApi.approveOvertime(organization.id, overtimeId),
    onSettled: invalidate.sheets,
  });
}

/** Rejecting removes only the overtime premium: the hours stay at their standard cost. */
export function useRejectOvertime() {
  const { organization } = useOrg();
  const invalidate = useTimeInvalidation();
  return useMutation({
    mutationFn: ({ overtimeId, note }: { overtimeId: string; note: string }) =>
      timeApi.rejectOvertime(organization.id, overtimeId, note),
    onSettled: invalidate.sheets,
  });
}
