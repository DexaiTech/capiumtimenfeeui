import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type {
  Adjustment,
  AdjustmentCounts,
  AdjustmentFilters,
  AdjustmentInput,
  ExportFormat,
  HistoricFilters,
  HistoricItem,
  HistoricItemFilters,
  HistoricReport,
  ItemFilters,
  LedgerFilters,
  Member,
  Movement,
  SummaryFilters,
  Transfer,
  TransferFilters,
  TransferInput,
  WipItem,
  WipSummary,
  WriteOff,
  WriteOffFilters,
  WriteOffInput,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/** A blank search is left out: the API ignores it anyway. */
const text = (value: string | undefined) => (value?.trim() ? value.trim() : undefined);

/**
 * Typed wrappers over the WIP endpoints (`/wip/*`) and the historic report (`/reports/wip`).
 * Query values that are empty are left out by the client; a repeated value (`kind`, `status`)
 * is sent once per item.
 */
export const wipApi = {
  /* ---------------------------------- Views ---------------------------------- */
  /** Rows and totals in one object, paged with the cursor of `meta`. */
  summary: (organizationId: string, filters: SummaryFilters, page: PageRequest = {}) =>
    api.withMessage<WipSummary>(`${org(organizationId)}/wip/summary`, {
      query: {
        group_by: filters.group_by,
        client_id: filters.client_id,
        job_id: filters.job_id,
        partner_user_id: filters.partner_user_id,
        manager_user_id: filters.manager_user_id,
        service_id: filters.service_id,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  items: (organizationId: string, filters: ItemFilters, page: PageRequest = {}) =>
    api.list<WipItem>(`${org(organizationId)}/wip/items`, {
      query: {
        client_id: filters.client_id,
        job_id: filters.job_id,
        kind: filters.kind,
        partner_user_id: filters.partner_user_id,
        manager_user_id: filters.manager_user_id,
        service_id: filters.service_id,
        min_age_days: filters.min_age_days,
        q: text(filters.q),
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  ledger: (organizationId: string, filters: LedgerFilters, page: PageRequest = {}) =>
    api.list<Movement>(`${org(organizationId)}/wip/ledger`, {
      query: {
        client_id: filters.client_id,
        job_id: filters.job_id,
        kind: filters.kind,
        source_type: filters.source_type,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),

  /* ------------------------------- Adjustments ------------------------------- */
  listAdjustments: (organizationId: string, filters: AdjustmentFilters, page: PageRequest = {}) =>
    api.list<Adjustment>(`${org(organizationId)}/wip/adjustments`, {
      query: {
        status: filters.status,
        kind: filters.kind,
        client_id: filters.client_id,
        job_id: filters.job_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  adjustmentCounts: (organizationId: string, signal?: AbortSignal) =>
    api.get<AdjustmentCounts>(`${org(organizationId)}/wip/adjustments/counts`, { signal }),
  createAdjustment: (organizationId: string, body: AdjustmentInput) =>
    api.post<Adjustment>(`${org(organizationId)}/wip/adjustments`, body),
  approveAdjustment: (organizationId: string, adjustmentId: string, note?: string) =>
    api.post<Adjustment>(
      `${org(organizationId)}/wip/adjustments/${seg(adjustmentId)}/approve`,
      note ? { note } : {},
    ),
  rejectAdjustment: (organizationId: string, adjustmentId: string, reason: string) =>
    api.post<Adjustment>(`${org(organizationId)}/wip/adjustments/${seg(adjustmentId)}/reject`, {
      reason,
    }),
  reverseAdjustment: (organizationId: string, adjustmentId: string, reason: string) =>
    api.post<Adjustment>(`${org(organizationId)}/wip/adjustments/${seg(adjustmentId)}/reverse`, {
      reason,
    }),

  /* --------------------------------- Transfers --------------------------------- */
  listTransfers: (organizationId: string, filters: TransferFilters, page: PageRequest = {}) =>
    api.list<Transfer>(`${org(organizationId)}/wip/transfers`, {
      query: {
        status: filters.status,
        client_id: filters.client_id,
        job_id: filters.job_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  createTransfer: (organizationId: string, body: TransferInput) =>
    api.post<Transfer>(`${org(organizationId)}/wip/transfers`, body),
  reverseTransfer: (organizationId: string, transferId: string, reason: string) =>
    api.post<Transfer>(`${org(organizationId)}/wip/transfers/${seg(transferId)}/reverse`, {
      reason,
    }),

  /* --------------------------------- Write-offs --------------------------------- */
  /** Newest first. Item write-offs are not ledger movements: this is where they are listed. */
  listWriteOffs: (organizationId: string, filters: WriteOffFilters, page: PageRequest = {}) =>
    api.list<WriteOff>(`${org(organizationId)}/wip/write-offs`, {
      query: {
        client_id: filters.client_id,
        job_id: filters.job_id,
        date_from: filters.date_from,
        date_to: filters.date_to,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  createWriteOff: (organizationId: string, body: WriteOffInput) =>
    api.post<WriteOff>(`${org(organizationId)}/wip/write-offs`, body),
  reverseWriteOff: (organizationId: string, writeOffId: string) =>
    api.delete<null>(`${org(organizationId)}/wip/write-offs/${seg(writeOffId)}`),

  /* ------------------------------- Historic WIP ------------------------------- */
  historic: (organizationId: string, filters: HistoricFilters, signal?: AbortSignal) =>
    api.get<HistoricReport>(`${org(organizationId)}/reports/wip`, {
      query: {
        as_at: filters.as_at,
        group_by: filters.group_by,
        client_id: filters.client_id,
        job_id: filters.job_id,
        partner_user_id: filters.partner_user_id,
        manager_user_id: filters.manager_user_id,
        service_id: filters.service_id,
        format: 'json',
      },
      signal,
    }),
  historicItems: (organizationId: string, filters: HistoricItemFilters, page: PageRequest = {}) =>
    api.list<HistoricItem>(`${org(organizationId)}/reports/wip/items`, {
      query: {
        as_at: filters.as_at,
        client_id: filters.client_id,
        job_id: filters.job_id,
        billing_type: filters.billing_type,
        partner_user_id: filters.partner_user_id,
        manager_user_id: filters.manager_user_id,
        service_id: filters.service_id,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  /** The report as a download; the API asks for `report.export` as well. */
  exportHistoric: (organizationId: string, filters: HistoricFilters, format: ExportFormat) =>
    api.getBlob(`${org(organizationId)}/reports/wip`, {
      query: {
        as_at: filters.as_at,
        group_by: filters.group_by,
        client_id: filters.client_id,
        job_id: filters.job_id,
        partner_user_id: filters.partner_user_id,
        manager_user_id: filters.manager_user_id,
        service_id: filters.service_id,
        format,
      },
    }),

  /* ---------------------------------- People ---------------------------------- */
  listMembers: (organizationId: string, cursor: string | undefined, signal?: AbortSignal) =>
    api.list<Member>(`${org(organizationId)}/members`, {
      query: { status: ['active'], limit: 100, cursor },
      signal,
    }),
};
