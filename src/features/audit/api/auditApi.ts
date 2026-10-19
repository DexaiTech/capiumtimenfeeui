import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type { AuditExportFilters, ExportFormat, HistoryEntry, HistoryQuery } from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** Typed wrappers over the record history and the export of the audit log. */
export const auditApi = {
  history: (organizationId: string, query: HistoryQuery, page: PageRequest = {}) =>
    api.list<HistoryEntry>(`${org(organizationId)}/audit-logs/history`, {
      query: {
        target_type: query.targetType,
        target_id: query.targetId,
        include_related: query.includeRelated ? true : undefined,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),

  /** The file as a blob; the API answers 403 without `audit_log.read` and `audit_log.export`. */
  exportLog: (
    organizationId: string,
    format: ExportFormat,
    filters: AuditExportFilters,
    signal?: AbortSignal,
  ) =>
    api.getBlob(`${org(organizationId)}/audit-logs/export`, {
      query: { ...filters, format },
      signal,
    }),
};
