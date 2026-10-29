import { PAGE_SIZE } from '@/constants/limits';
import { api } from '@/services/api';

import type {
  BulkImportResult,
  ImportResult,
  IntegrationCard,
  IntegrationKey,
  IntegrationUpdate,
  MappingsWrite,
  Mappings,
  MockAvailability,
  Onboarding,
  OpeningBalanceTimeImportResult,
  PeriodLock,
  PeriodLockCalendar,
  PeriodLockCreate,
  PeriodLockEvent,
  PeriodLockReopen,
  PeriodLockSettingsUpdate,
  RetryFailedResult,
  StepState,
  SyncItem,
  SyncItemFilters,
  SyncItemRetried,
  SyncLogEntry,
  SyncLogFilters,
  SyncRunResult,
} from '../adminTypes';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const id = encodeURIComponent;

/** A CSV upload as a multipart form (`file`) to a bulk import route. */
function uploadCsv(path: string, file: File, query: Record<string, boolean>) {
  const body = new FormData();
  body.append('file', file, file.name);
  return api.upload<BulkImportResult>(path, body, { query });
}

interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
}

/** Typed wrappers over the period-lock, onboarding, integration and client import/export endpoints. */
export const adminApi = {
  /* ------------------------------ Period lock ------------------------------ */
  getPeriodLock: (organizationId: string, signal?: AbortSignal) =>
    api.get<PeriodLock>(`${org(organizationId)}/period-locks`, { signal }),
  listPeriodLockHistory: (organizationId: string, page: PageRequest = {}) =>
    api.list<PeriodLockEvent>(`${org(organizationId)}/period-locks/history`, {
      query: { limit: PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  getPeriodLockCalendar: (organizationId: string, year?: number, signal?: AbortSignal) =>
    api.get<PeriodLockCalendar>(`${org(organizationId)}/period-locks/calendar`, {
      query: { year },
      signal,
    }),
  updatePeriodLockSettings: (organizationId: string, body: PeriodLockSettingsUpdate) =>
    api.put<PeriodLock>(`${org(organizationId)}/period-locks/settings`, body),
  lockPeriod: (organizationId: string, body: PeriodLockCreate) =>
    api.post<PeriodLock>(`${org(organizationId)}/period-locks`, body),
  reopenPeriod: (organizationId: string, body: PeriodLockReopen) =>
    api.post<PeriodLock>(`${org(organizationId)}/period-locks/reopen`, body),

  /* ------------------------------- Onboarding ------------------------------ */
  getOnboarding: (organizationId: string, signal?: AbortSignal) =>
    api.get<Onboarding>(`${org(organizationId)}/onboarding`, { signal }),
  setOnboardingStep: (organizationId: string, key: string, state: StepState) =>
    api.put<Onboarding>(`${org(organizationId)}/onboarding/steps/${id(key)}`, { state }),

  /* ------------------------------ Integrations ----------------------------- */
  listIntegrations: (organizationId: string, signal?: AbortSignal) =>
    api.get<IntegrationCard[]>(`${org(organizationId)}/integrations`, { signal }),
  updateIntegration: (organizationId: string, key: IntegrationKey, body: IntegrationUpdate) =>
    api.patch<IntegrationCard>(`${org(organizationId)}/integrations/${id(key)}`, body),
  runIntegration: (organizationId: string, key: IntegrationKey) =>
    api.post<SyncRunResult>(`${org(organizationId)}/integrations/${id(key)}/sync`),
  retryFailed: (organizationId: string, key: IntegrationKey) =>
    api.post<RetryFailedResult>(`${org(organizationId)}/integrations/${id(key)}/retry-failed`),
  setMockAvailability: (organizationId: string, key: IntegrationKey, available: boolean) =>
    api.post<MockAvailability>(`${org(organizationId)}/integrations/${id(key)}/mock/availability`, {
      available,
    }),
  listSyncItems: (organizationId: string, filters: SyncItemFilters, page: PageRequest = {}) =>
    api.list<SyncItem>(`${org(organizationId)}/integrations/sync-items`, {
      query: { ...filters, limit: PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  retrySyncItem: (organizationId: string, itemId: string) =>
    api.post<SyncItemRetried>(`${org(organizationId)}/integrations/sync-items/${id(itemId)}/retry`),
  listSyncLogs: (organizationId: string, filters: SyncLogFilters, page: PageRequest = {}) =>
    api.list<SyncLogEntry>(`${org(organizationId)}/integrations/sync-logs`, {
      query: { ...filters, limit: PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  getMappings: (organizationId: string, signal?: AbortSignal) =>
    api.get<Mappings>(`${org(organizationId)}/integrations/bookkeeping/mappings`, { signal }),
  putMappings: (organizationId: string, body: MappingsWrite) =>
    api.put<Mappings>(`${org(organizationId)}/integrations/bookkeeping/mappings`, body),

  /* ----------------------------- Import / export ---------------------------- */
  /** The CSV of every client (the clients list's default filters and order). */
  exportClients: (organizationId: string) =>
    api.getBlob(`${org(organizationId)}/clients/export`, {
      query: { format: 'csv' },
      accept: 'text/csv',
    }),
  importClients: (organizationId: string, file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return api.upload<ImportResult>(`${org(organizationId)}/imports/clients`, body, {
      query: { dry_run: dryRun },
    });
  },
  /** The CSV of every staff member (rate columns only with `rate.read`). */
  exportStaff: (organizationId: string) =>
    api.getBlob(`${org(organizationId)}/staff/export`, { accept: 'text/csv' }),
  /** The CSV of every rate rule, of every level. */
  exportRates: (organizationId: string) =>
    api.getBlob(`${org(organizationId)}/rates/export`, { accept: 'text/csv' }),
  /** The CSV of every job that is not deleted. */
  exportJobs: (organizationId: string) =>
    api.getBlob(`${org(organizationId)}/jobs/export`, { accept: 'text/csv' }),
  importStaff: (organizationId: string, file: File, dryRun: boolean) =>
    uploadCsv(`${org(organizationId)}/imports/staff`, file, { dry_run: dryRun }),
  importRates: (organizationId: string, file: File, dryRun: boolean, closePrevious: boolean) =>
    uploadCsv(`${org(organizationId)}/imports/rates`, file, {
      dry_run: dryRun,
      close_previous: closePrevious,
    }),
  importJobs: (organizationId: string, file: File, dryRun: boolean) =>
    uploadCsv(`${org(organizationId)}/imports/jobs`, file, { dry_run: dryRun }),
  importOpeningBalanceTime: (organizationId: string, file: File, dryRun: boolean) => {
    const body = new FormData();
    body.append('file', file, file.name);
    return api.upload<OpeningBalanceTimeImportResult>(
      `${org(organizationId)}/imports/opening_balance_time`,
      body,
      { query: { dry_run: dryRun } },
    );
  },
};
