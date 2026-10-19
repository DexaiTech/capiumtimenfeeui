import { api } from '@/services/api';

import type { ExportFormat, ReportData } from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;

/** The filters of a run: what the endpoint takes, as it takes it (empty values are left out). */
export type ReportQuery = Readonly<Record<string, string | undefined>>;

/** Typed wrappers over the report endpoints (`docs/modules/reports.md`). */
export const reportsApi = {
  /** Runs a report: every row (no paging) with the totals of the whole report. */
  run: <TRow, TTotals>(
    organizationId: string,
    endpoint: string,
    query: ReportQuery,
    signal?: AbortSignal,
  ) =>
    api.get<ReportData<TRow, TTotals>>(`${org(organizationId)}/reports/${endpoint}`, {
      query,
      signal,
    }),
  /** The report as a file (it needs `report.export`): every row, with the same filters. */
  download: (organizationId: string, endpoint: string, query: ReportQuery, format: ExportFormat) =>
    api.getBlob(`${org(organizationId)}/reports/${endpoint}`, {
      query: { ...query, format },
      accept:
        format === 'csv'
          ? 'text/csv'
          : format === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
};
