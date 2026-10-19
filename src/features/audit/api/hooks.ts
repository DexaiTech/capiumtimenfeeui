import {
  useInfiniteQuery,
  useMutation,
  type InfiniteData,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import type { ApiResult } from '@/services/api';
import type { PageMeta } from '@/types/api';

import type { AuditExportFilters, ExportFormat, HistoryEntry, HistoryQuery } from '../types';
import { auditApi } from './auditApi';

type Page<TItem> = ApiResult<TItem[], PageMeta>;

/**
 * Keys of the audit data, under the practice's `audit-logs` key: whatever refreshes the audit
 * log of the practice (a role change, a staff edit …) refreshes every record history too.
 */
export const auditKeys = {
  history: (organizationId: string, query: HistoryQuery) =>
    [
      ...queryKeys.org.auditLogs(organizationId),
      'history',
      query.targetType,
      query.targetId,
      query.includeRelated ?? false,
    ] as const,
};

/** Flattens the pages of an infinite list. */
export function flattenPages<TItem>(data: InfiniteData<Page<TItem>> | undefined): TItem[] {
  return data?.pages.flatMap((page) => page.data) ?? [];
}

/** The history of one record, newest first, a page at a time. */
export function useRecordHistory(
  query: HistoryQuery,
  options: { enabled?: boolean } = {},
): UseInfiniteQueryResult<InfiniteData<Page<HistoryEntry>>> {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: auditKeys.history(organization.id, query),
    queryFn: ({ pageParam, signal }) =>
      auditApi.history(organization.id, query, { cursor: pageParam, signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: Page<HistoryEntry>) => last.meta?.next_cursor ?? undefined,
    enabled: options.enabled ?? true,
  });
}

export interface ExportVariables {
  format: ExportFormat;
  filters: AuditExportFilters;
}

/** Makes the export file of the audit log; resolves to the file. */
export function useExportAuditLog() {
  const { organization } = useOrg();
  return useMutation({
    mutationFn: ({ format, filters }: ExportVariables) =>
      auditApi.exportLog(organization.id, format, filters),
  });
}
