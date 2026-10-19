import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useOrg } from '@/features/organizations';

import type { TimeSummaryFilters, UtilisationFilters } from '../types';
import { timeKeys } from './keys';
import { timeApi } from './timeApi';

/** Time by person, client, job, activity, service or period (needs `report.read`). */
export function useTimeSummary(filters: TimeSummaryFilters, { enabled = true } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.timeSummary(organization.id, filters),
    queryFn: ({ signal }) => timeApi.timeSummary(organization.id, filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Utilisation per person against their target (needs `report.read`). */
export function useUtilisation(filters: UtilisationFilters, { enabled = true } = {}) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: timeKeys.utilisation(organization.id, filters),
    queryFn: ({ signal }) => timeApi.utilisation(organization.id, filters, signal),
    placeholderData: keepPreviousData,
    enabled,
  });
}
