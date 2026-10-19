import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';

import { reportsApi, type ReportQuery } from './reportsApi';

/** One run of a report; the previous rows stay on screen while another filter loads. */
export function useReport<TRow, TTotals>(endpoint: string, query: ReportQuery) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: [...queryKeys.org.reports(organization.id), endpoint, query] as const,
    queryFn: ({ signal }) =>
      reportsApi.run<TRow, TTotals>(organization.id, endpoint, query, signal),
    placeholderData: keepPreviousData,
  });
}
