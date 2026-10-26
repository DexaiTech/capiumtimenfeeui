import { http, HttpResponse, type HttpHandler, type JsonBodyType } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  BulkImportResult,
  ImportResult,
  IntegrationCard,
  Mappings,
  MappingsWrite,
  Onboarding,
  OpeningBalanceTimeImportResult,
  LockablePeriodType,
  LockedPeriod,
  PeriodLock,
  PeriodLockEvent,
  StepState,
  SyncItem,
  SyncLogEntry,
} from '../adminTypes';
import {
  ADA,
  NOT_LOCKED,
  cardsOf,
  itemsOf,
  logsOf,
  mappingsOf,
  onboardingSteps,
  withSummary,
} from './adminFixtures';
import { periodName, periodRange } from '../utils/periodLock';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };
const NOW = '2026-10-18T10:00:00Z';
const TODAY = '2026-10-18';

export interface Call {
  method: string;
  path: string;
  body?: unknown;
  params?: URLSearchParams;
}

export interface Refusal {
  status: number;
  code: string;
  message: string;
  details?: JsonBodyType;
}

/** The stand-in for the API: what the tests read and change, and what the pages asked for. */
export interface AdminBackend {
  lock: PeriodLock;
  /** Newest first. */
  history: PeriodLockEvent[];
  onboarding: Onboarding;
  cards: IntegrationCard[];
  items: SyncItem[];
  logs: SyncLogEntry[];
  mappings: Mappings;
  /** What a client import answers (the file itself is not readable under jsdom). */
  importResult: ImportResult;
  /** What a staff, rates or jobs import answers (the file itself is not readable under jsdom). */
  bulkResult: BulkImportResult;
  /** What an opening-balance time import answers. */
  openingBalanceResult: OpeningBalanceTimeImportResult;
  /** Rows per page of the lists (everything when 0). */
  pageSize: number;
  calls: Call[];
  /** Answers a route with an error: key `'POST /period-locks'`. */
  refusals: Record<string, Refusal>;
}

const emptyImport = (dryRun: boolean): ImportResult => ({
  dry_run: dryRun,
  total_rows: 3,
  valid_rows: 3,
  created: dryRun ? 0 : 3,
  columns: ['name', 'email'],
  ignored_columns: [],
  errors: [],
  clients: [],
});

const emptyBulkImport = (dryRun: boolean): BulkImportResult => ({
  dry_run: dryRun,
  total_rows: 3,
  valid_rows: 3,
  created: dryRun ? 0 : 3,
  columns: ['full_name', 'grade', 'start_date'],
  ignored_columns: [],
  errors: [],
  items: [],
  counts: {},
});

const emptyOpeningBalanceImport = (dryRun: boolean): OpeningBalanceTimeImportResult => ({
  dry_run: dryRun,
  total_rows: 2,
  valid_rows: 2,
  created: dryRun ? 0 : 2,
  columns: ['client', 'staff', 'date', 'hours'],
  ignored_columns: [],
  errors: [],
  entries: [],
});

export function createBackend(initial: Partial<AdminBackend> = {}): AdminBackend {
  return {
    lock: NOT_LOCKED,
    history: [],
    onboarding: withSummary(onboardingSteps()),
    cards: cardsOf(),
    items: itemsOf(),
    logs: logsOf(),
    mappings: mappingsOf(),
    importResult: emptyImport(true),
    bulkResult: emptyBulkImport(true),
    openingBalanceResult: emptyOpeningBalanceImport(true),
    pageSize: 0,
    calls: [],
    refusals: {},
    ...initial,
  };
}

export const callsOf = (backend: AdminBackend, method: string, path?: string) =>
  backend.calls.filter(
    (call) => call.method === method && (path === undefined || call.path === path),
  );

function pageOf<T>(rows: T[], params: URLSearchParams, size: number) {
  if (!size) return { rows, meta: END };
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const invalid = (code: string, field: string, message: string) =>
  fail(422, code, message, { details: [{ field, code, message }] });

/** Handlers for the period lock, the onboarding checklist, the integrations and the client import. */
export function adminHandlers(backend: AdminBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message, { details: found.details }) : null;
  };
  const cardOf = (key: unknown) => backend.cards.find((entry) => entry.key === key);

  const record_event = (event: Partial<PeriodLockEvent>): PeriodLockEvent => {
    const made: PeriodLockEvent = {
      id: `ev-new-${String(backend.history.length + 1)}`,
      event_type: 'locked',
      period_type: null,
      period_start: null,
      period_end: null,
      period_label: null,
      previous_locked_through: null,
      locked_through: null,
      reason: null,
      actor_user_id: ADA,
      actor_name: 'Ada Lovelace',
      created_at: NOW,
      ...event,
    };
    backend.history = [made, ...backend.history];
    return made;
  };

  const markStep = (key: string, state: StepState): Onboarding | null => {
    const found = backend.onboarding.steps.find((entry) => entry.key === key);
    if (!found) return null;
    const steps = backend.onboarding.steps.map((entry) => {
      if (entry.key !== key) return entry;
      if (state === 'todo') {
        // Taking a decision back lets the data speak again.
        const counted = entry.detected === true;
        return {
          ...entry,
          state: counted ? ('done' as const) : ('todo' as const),
          source: entry.detected === null ? ('manual' as const) : ('auto' as const),
          updated_by_name: null,
          updated_at: null,
        };
      }
      return {
        ...entry,
        state,
        source: 'manual' as const,
        updated_by_name: 'Ada Lovelace',
        updated_at: NOW,
      };
    });
    backend.onboarding = withSummary(steps);
    return backend.onboarding;
  };

  return [
    /* ----------------------------- Period lock ----------------------------- */
    http.get(orgApiPath('/period-locks/history'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/period-locks/history', undefined, params);
      const failed = refusal('GET', '/period-locks/history');
      if (failed) return failed;
      const page = pageOf(backend.history, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.get(orgApiPath('/period-locks'), () => {
      record('GET', '/period-locks');
      return refusal('GET', '/period-locks') ?? ok(backend.lock);
    }),
    http.post(orgApiPath('/period-locks/reopen'), async ({ request }) => {
      const body = (await request.json()) as { lock_id: string; reason?: string | null };
      record('POST', '/period-locks/reopen', body);
      const failed = refusal('POST', '/period-locks/reopen');
      if (failed) return failed;
      if (!body.reason?.trim()) {
        return invalid('PERIOD_LOCK_REASON_REQUIRED', 'reason', 'Say why the period is unlocked.');
      }
      const found = backend.lock.periods.find((entry) => entry.id === body.lock_id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'That period is not locked.');
      const event = record_event({
        event_type: 'reopened',
        period_type: found.period_type,
        period_start: found.start_date,
        period_end: found.end_date,
        period_label: found.label,
        reason: body.reason.trim(),
      });
      backend.lock = {
        periods: backend.lock.periods.filter((entry) => entry.id !== found.id),
        last_event: event,
      };
      return ok(backend.lock, { message: 'Period unlocked' });
    }),
    http.post(orgApiPath('/period-locks'), async ({ request }) => {
      const body = (await request.json()) as {
        period_type: LockablePeriodType;
        year: number;
        period?: number;
        reason?: string | null;
      };
      record('POST', '/period-locks', body);
      const failed = refusal('POST', '/period-locks');
      if (failed) return failed;
      const index = body.period ?? 1;
      const { start, end } = periodRange(body.period_type, body.year, index);
      const label = periodName(body.period_type, body.year, index);
      if (end > TODAY) {
        return invalid('PERIOD_LOCK_IN_FUTURE', 'period', `${label} has not ended yet.`);
      }
      const clash = backend.lock.periods.find(
        (entry) => entry.start_date <= end && entry.end_date >= start,
      );
      if (clash) {
        return invalid(
          'PERIOD_LOCK_OVERLAPS',
          'period',
          `${label} overlaps a period that is already locked (${clash.label}).`,
        );
      }
      const event = record_event({
        period_type: body.period_type,
        period_start: start,
        period_end: end,
        period_label: label,
        reason: body.reason?.trim() || null,
      });
      const period: LockedPeriod = {
        id: `lp-new-${String(backend.lock.periods.length + 1)}`,
        period_type: body.period_type,
        start_date: start,
        end_date: end,
        label,
        reason: event.reason,
        locked_by: ADA,
        locked_by_name: 'Ada Lovelace',
        locked_at: NOW,
      };
      backend.lock = {
        periods: [...backend.lock.periods, period].sort((a, b) =>
          a.start_date.localeCompare(b.start_date),
        ),
        last_event: event,
      };
      return ok(backend.lock, { message: 'Period locked' });
    }),

    /* ----------------------------- Onboarding ------------------------------ */
    http.get(orgApiPath('/onboarding'), () => {
      record('GET', '/onboarding');
      return refusal('GET', '/onboarding') ?? ok(backend.onboarding);
    }),
    http.put(orgApiPath('/onboarding/steps/:key'), async ({ request, params }) => {
      const body = (await request.json()) as { state: StepState };
      record('PUT', `/onboarding/steps/${String(params.key)}`, body);
      const failed = refusal('PUT', '/onboarding/steps');
      if (failed) return failed;
      const next = markStep(String(params.key), body.state);
      return next
        ? ok(next, { message: 'Step updated' })
        : fail(404, 'RESOURCE_NOT_FOUND', 'Unknown step.');
    }),

    /* ---------------------------- Integrations ----------------------------- */
    http.get(orgApiPath('/integrations/sync-items'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/integrations/sync-items', undefined, params);
      const failed = refusal('GET', '/integrations/sync-items');
      if (failed) return failed;
      const q = params.get('q')?.toLowerCase();
      const rows = backend.items.filter(
        (item) =>
          (!params.get('integration') || item.integration === params.get('integration')) &&
          (!params.get('status') || item.status === params.get('status')) &&
          (!q || `${item.label ?? ''} ${item.last_error ?? ''}`.toLowerCase().includes(q)),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/integrations/sync-items/:itemId/retry'), ({ params }) => {
      record('POST', `/integrations/sync-items/${String(params.itemId)}/retry`);
      const failed = refusal('POST', '/integrations/sync-items/retry');
      if (failed) return failed;
      const found = backend.items.find((item) => item.id === params.itemId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Sync item not found.');
      const item: SyncItem = {
        ...found,
        status: 'ok',
        attempts: 1,
        last_error: null,
        last_error_code: null,
        external_ref: 'BK-NEW',
      };
      backend.items = backend.items.map((entry) => (entry.id === item.id ? item : entry));
      return ok({ outcome: 'sent', item }, { message: 'Sync item retried' });
    }),
    http.get(orgApiPath('/integrations/sync-logs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/integrations/sync-logs', undefined, params);
      const failed = refusal('GET', '/integrations/sync-logs');
      if (failed) return failed;
      const rows = backend.logs.filter(
        (entry) =>
          (!params.get('integration') || entry.integration === params.get('integration')) &&
          (!params.get('status') || entry.status === params.get('status')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.get(orgApiPath('/integrations/bookkeeping/mappings'), () => {
      record('GET', '/integrations/bookkeeping/mappings');
      return refusal('GET', '/integrations/bookkeeping/mappings') ?? ok(backend.mappings);
    }),
    http.put(orgApiPath('/integrations/bookkeeping/mappings'), async ({ request }) => {
      const body = (await request.json()) as MappingsWrite;
      record('PUT', '/integrations/bookkeeping/mappings', body);
      const failed = refusal('PUT', '/integrations/bookkeeping/mappings');
      if (failed) return failed;
      const services = backend.mappings.services.map((row) => {
        const set = body.services.find((entry) => entry.service_id === row.service_id);
        return {
          ...row,
          account_code: set?.account_code ?? null,
          account_name: set?.account_name ?? null,
        };
      });
      const vatRates = backend.mappings.vat_rates.map((row) => {
        const set = body.vat_rates.find((entry) => entry.vat_rate_id === row.vat_rate_id);
        return { ...row, tax_code: set?.tax_code ?? null, tax_name: set?.tax_name ?? null };
      });
      backend.mappings = {
        services,
        vat_rates: vatRates,
        unmapped_services: services.filter((row) => !row.account_code).length,
        unmapped_vat_rates: vatRates.filter((row) => !row.tax_code).length,
      };
      return ok(backend.mappings, { message: 'Mappings saved' });
    }),
    http.get(orgApiPath('/integrations'), () => {
      record('GET', '/integrations');
      return refusal('GET', '/integrations') ?? ok(backend.cards);
    }),
    http.post(orgApiPath('/integrations/:key/mock/availability'), async ({ request, params }) => {
      const body = (await request.json()) as { available: boolean };
      record('POST', `/integrations/${String(params.key)}/mock/availability`, body);
      const found = cardOf(params.key);
      if (!found?.mock) return fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
      backend.cards = backend.cards.map((entry) =>
        entry.key === found.key ? { ...entry, mock: { available: body.available } } : entry,
      );
      return ok(
        { integration: found.key, available: body.available },
        { message: 'Mock service updated' },
      );
    }),
    http.post(orgApiPath('/integrations/:key/retry-failed'), ({ params }) => {
      record('POST', `/integrations/${String(params.key)}/retry-failed`);
      const failed = refusal('POST', `/integrations/${String(params.key)}/retry-failed`);
      if (failed) return failed;
      const found = cardOf(params.key);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
      if (!found.enabled)
        return fail(409, 'INTEGRATION_DISABLED', `${found.name} is switched off.`);
      const requeued = backend.items.filter(
        (item) => item.integration === found.key && item.status === 'failed',
      ).length;
      backend.items = backend.items.map((item) =>
        item.integration === found.key && item.status === 'failed'
          ? { ...item, status: 'ok' as const, last_error: null, last_error_code: null }
          : item,
      );
      backend.cards = backend.cards.map((entry) =>
        entry.key === found.key
          ? { ...entry, failed_items: 0, status: 'connected' as const }
          : entry,
      );
      return ok(
        { requeued, ok: requeued, failed: 0, remaining: 0 },
        { message: 'Failed items retried' },
      );
    }),
    http.post(orgApiPath('/integrations/:key/sync'), ({ params }) => {
      record('POST', `/integrations/${String(params.key)}/sync`);
      const failed = refusal('POST', `/integrations/${String(params.key)}/sync`);
      if (failed) return failed;
      const found = cardOf(params.key);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
      if (!found.enabled)
        return fail(409, 'INTEGRATION_DISABLED', `${found.name} is switched off.`);
      const available = found.mock?.available ?? true;
      return ok(
        {
          integration: found.key,
          available,
          queued: available ? 2 : 0,
          processed: available ? 2 : 0,
          ok: available ? 2 : 0,
          retrying: 0,
          failed: 0,
          skipped: 0,
          pending: available ? 0 : 3,
          details: {},
          message: available
            ? '2 documents sent.'
            : `${found.name} is not available: the work stays queued.`,
        },
        { message: 'Synchronisation run' },
      );
    }),
    http.patch(orgApiPath('/integrations/:key'), async ({ request, params }) => {
      const body = (await request.json()) as {
        enabled?: boolean;
        config?: Record<string, unknown>;
      };
      record('PATCH', `/integrations/${String(params.key)}`, body);
      const failed = refusal('PATCH', `/integrations/${String(params.key)}`);
      if (failed) return failed;
      const found = cardOf(params.key);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Not found.');
      if (body.enabled === false && found.always_on) {
        return fail(409, 'INTEGRATION_ALWAYS_ON', `${found.name} cannot be switched off.`);
      }
      const unknown = Object.keys(body.config ?? {}).filter((key) => !(key in found.config));
      if (unknown.length > 0) {
        return invalid('VALIDATION_ERROR', `config.${unknown[0] ?? ''}`, 'Unknown setting.');
      }
      const enabled = body.enabled ?? found.enabled;
      const updated: IntegrationCard = {
        ...found,
        enabled,
        status: enabled ? (found.status === 'disabled' ? 'ready' : found.status) : 'disabled',
        config: { ...found.config, ...body.config },
      };
      backend.cards = backend.cards.map((entry) => (entry.key === updated.key ? updated : entry));
      return ok(updated, { message: 'Integration updated' });
    }),

    /* --------------------------- Import and export -------------------------- */
    http.get(orgApiPath('/clients/export'), ({ request }) => {
      record('GET', '/clients/export', undefined, new URL(request.url).searchParams);
      const failed = refusal('GET', '/clients/export');
      if (failed) return failed;
      return new HttpResponse('code,name\nC0001,Acme Ltd\n', {
        headers: { 'Content-Type': 'text/csv' },
      });
    }),
    http.post(orgApiPath('/imports/clients'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const dryRun = params.get('dry_run') === 'true';
      record('POST', '/imports/clients', undefined, params);
      const failed = refusal('POST', '/imports/clients');
      if (failed) return failed;
      return ok({
        ...backend.importResult,
        dry_run: dryRun,
        created: dryRun ? 0 : backend.importResult.valid_rows,
      });
    }),
    ...(['staff', 'rates', 'jobs'] as const).flatMap((kind) => [
      http.get(orgApiPath(`/${kind}/export`), ({ request }) => {
        record('GET', `/${kind}/export`, undefined, new URL(request.url).searchParams);
        const failed = refusal('GET', `/${kind}/export`);
        if (failed) return failed;
        return new HttpResponse('code,name\nX001,Example\n', {
          headers: { 'Content-Type': 'text/csv' },
        });
      }),
      http.post(orgApiPath(`/imports/${kind}`), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const dryRun = params.get('dry_run') === 'true';
        record('POST', `/imports/${kind}`, undefined, params);
        const failed = refusal('POST', `/imports/${kind}`);
        if (failed) return failed;
        return ok({
          ...backend.bulkResult,
          dry_run: dryRun,
          created: dryRun ? 0 : backend.bulkResult.valid_rows,
        });
      }),
    ]),
    http.post(orgApiPath('/imports/opening_balance_time'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const dryRun = params.get('dry_run') === 'true';
      record('POST', '/imports/opening_balance_time', undefined, params);
      const failed = refusal('POST', '/imports/opening_balance_time');
      if (failed) return failed;
      return ok({
        ...backend.openingBalanceResult,
        dry_run: dryRun,
        created: dryRun ? 0 : backend.openingBalanceResult.valid_rows,
      });
    }),
  ];
}
