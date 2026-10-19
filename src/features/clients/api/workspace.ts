import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
  type InfiniteData,
  type QueryKey,
  type UseInfiniteQueryResult,
} from '@tanstack/react-query';

import { queryKeys } from '@/constants/queryKeys';
import { useOrg } from '@/features/organizations';
import { api, type RequestOptions } from '@/services/api';

import { RECORD_PAGE_SIZE } from '../workspace/constants';
import type {
  BillingStatus,
  ClientOverview,
  ClientWip,
  CreditNoteRow,
  InvoiceDisplayStatus,
  InvoiceRow,
  JobRow,
  JobStatus,
  PaymentMethod,
  PaymentRow,
  PaymentState,
  TimeEntryRow,
} from '../workspace/types';
import { clientKeys, nextCursor, org, seg, type Page } from './clients';

type Query = NonNullable<RequestOptions['query']>;

/** The list a tab shows: pages followed with the cursor ("Load more"). */
export type RecordListQuery<TRow> = UseInfiniteQueryResult<InfiniteData<Page<TRow>>>;

interface RecordListOptions {
  queryKey: QueryKey;
  path: string;
  query: Query;
  enabled?: boolean;
}

/**
 * One cursor-paginated list of a tab: `GET <path>?client_id=…` with the tab's filters. Rows of
 * another filter stay on screen while the new ones load.
 */
export function useRecordList<TRow>(options: RecordListOptions): RecordListQuery<TRow> {
  const { organization } = useOrg();
  return useInfiniteQuery({
    queryKey: options.queryKey,
    queryFn: ({ pageParam, signal }) =>
      api.list<TRow>(`${org(organization.id)}${options.path}`, {
        query: { ...options.query, limit: RECORD_PAGE_SIZE, cursor: pageParam },
        signal,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: nextCursor,
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

/* ------------------------------------ Overview ------------------------------------ */

/** The figures behind the tabs (`client.read`); a section the caller may not see is null. */
export function useClientOverview(clientId: string | undefined) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: clientKeys.overview(organization.id, clientId ?? ''),
    queryFn: ({ signal }) =>
      api.get<ClientOverview>(`${org(organization.id)}/clients/${seg(clientId ?? '')}/overview`, {
        signal,
      }),
    enabled: Boolean(clientId),
  });
}

/* -------------------------------------- Jobs -------------------------------------- */

export type JobSort =
  'due_date' | '-due_date' | 'number' | '-number' | 'created_at' | '-created_at';

export interface JobFilters {
  q: string;
  status: JobStatus | '';
  sort: JobSort;
}

/** `GET /jobs?client_id=` (`job.read`), with the sort done by the server. */
export function useClientJobs(clientId: string, filters: JobFilters, enabled = true) {
  const { organization } = useOrg();
  return useRecordList<JobRow>({
    queryKey: [...queryKeys.org.jobs(organization.id), 'by-client', clientId, filters],
    path: '/jobs',
    query: {
      client_id: clientId,
      q: filters.q || undefined,
      status: filters.status || undefined,
      sort: filters.sort,
    },
    enabled,
  });
}

/* -------------------------------------- Time -------------------------------------- */

export interface TimeFilters {
  from: string;
  to: string;
  billable: '' | 'true' | 'false';
  billing_status: BillingStatus | '';
}

/**
 * `GET /time-entries?client_id=`: every person's time with `time.read_all`, otherwise the
 * caller's own.
 */
export function useClientTime(
  clientId: string,
  filters: TimeFilters,
  scope: 'all' | 'own',
  enabled = true,
) {
  const { organization } = useOrg();
  return useRecordList<TimeEntryRow>({
    queryKey: [...queryKeys.org.time(organization.id), 'by-client', clientId, scope, filters],
    path: '/time-entries',
    query: {
      client_id: clientId,
      user_id: scope === 'all' ? 'all' : 'me',
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
      billable: filters.billable || undefined,
      billing_status: filters.billing_status || undefined,
    },
    enabled,
  });
}

/* -------------------------------------- WIP -------------------------------------- */

/** `GET /clients/{id}/wip` (`wip.read`): bounded, every WIP item of the client. */
export function useClientWip(clientId: string, enabled = true) {
  const { organization } = useOrg();
  return useQuery({
    queryKey: [...queryKeys.org.wip(organization.id), 'by-client', clientId],
    queryFn: ({ signal }) =>
      api.get<ClientWip>(`${org(organization.id)}/clients/${seg(clientId)}/wip`, { signal }),
    enabled,
  });
}

/* ---------------------------------- Invoices ---------------------------------- */

export interface InvoiceFilters {
  q: string;
  status: InvoiceDisplayStatus | '';
  from: string;
  to: string;
}

/** `GET /invoices?client_id=` (`invoice.read`); the date range filters the issue date. */
export function useClientInvoices(clientId: string, filters: InvoiceFilters, enabled = true) {
  const { organization } = useOrg();
  return useRecordList<InvoiceRow>({
    queryKey: [...queryKeys.org.invoices(organization.id), 'by-client', clientId, filters],
    path: '/invoices',
    query: {
      client_id: clientId,
      q: filters.q || undefined,
      status: filters.status || undefined,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
    },
    enabled,
  });
}

export interface CreditNoteFilters {
  q: string;
  from: string;
  to: string;
}

/** `GET /credit-notes?client_id=` (`invoice.read`). */
export function useClientCreditNotes(clientId: string, filters: CreditNoteFilters, enabled = true) {
  const { organization } = useOrg();
  return useRecordList<CreditNoteRow>({
    queryKey: [...queryKeys.org.creditNotes(organization.id), 'by-client', clientId, filters],
    path: '/credit-notes',
    query: {
      client_id: clientId,
      q: filters.q || undefined,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
    },
    enabled,
  });
}

/** The statement PDF of the client (`invoice.read` and `payment.read`), read with the Bearer header. */
export function fetchStatementPdf(
  organizationId: string,
  clientId: string,
  range: { from: string; to: string },
) {
  return api.getBlob(`${org(organizationId)}/clients/${seg(clientId)}/statement/pdf`, {
    query: { date_from: range.from || undefined, date_to: range.to || undefined },
    accept: 'application/pdf',
  });
}

/* ---------------------------------- Payments ---------------------------------- */

export interface PaymentFilters {
  q: string;
  state: PaymentState | 'on_account' | '';
  method: PaymentMethod | '';
  from: string;
  to: string;
}

/** `GET /payments?client_id=` (`payment.read`); the date range filters the date received. */
export function useClientPayments(clientId: string, filters: PaymentFilters, enabled = true) {
  const { organization } = useOrg();
  return useRecordList<PaymentRow>({
    queryKey: [...queryKeys.org.payments(organization.id), 'by-client', clientId, filters],
    path: '/payments',
    query: {
      client_id: clientId,
      q: filters.q || undefined,
      state: filters.state || undefined,
      method: filters.method || undefined,
      date_from: filters.from || undefined,
      date_to: filters.to || undefined,
    },
    enabled,
  });
}
