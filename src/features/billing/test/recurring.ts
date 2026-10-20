import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type { LineInput, Schedule, ScheduleLine, ScheduleRun } from '../types';
import { bright, clients, harbour, north } from './fixtures';
import type { Call, Refusal } from './handlers';
import { vatCodes } from './prepare';

const END = { next_cursor: null, has_more: false };
const TODAY = '2026-10-18';

export function scheduleLine(overrides: Partial<ScheduleLine> = {}): ScheduleLine {
  return {
    id: 'sl-1',
    position: 1,
    description: 'Monthly bookkeeping',
    job_id: null,
    service_id: null,
    quantity: '1.00',
    unit_amount: 25000,
    vat_rate_id: 'vat-std',
    ...overrides,
  };
}

/** An active monthly schedule for Harbour & Co that has run twice: £250.00 net an invoice. */
export function scheduleOf(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: 'sch-1',
    name: 'Monthly bookkeeping',
    client: harbour,
    frequency: 'monthly',
    status: 'active',
    start_date: '2026-08-01',
    end_date: null,
    next_run_date: '2026-11-01',
    last_run_on: '2026-10-01',
    reference: 'BK-MONTHLY',
    net_estimate: 25000,
    failed_runs: 0,
    created_at: '2026-07-20T09:00:00Z',
    notes: 'Invoice on the first of the month.',
    lines: [scheduleLine()],
    ...overrides,
  };
}

export function runOf(overrides: Partial<ScheduleRun> = {}): ScheduleRun {
  return {
    id: 'run-1',
    schedule_id: 'sch-1',
    run_date: '2026-10-01',
    status: 'succeeded',
    invoice_id: 'inv-draft-1',
    invoice_number: null,
    error: null,
    attempts: 1,
    ran_at: '2026-10-01T02:00:00Z',
    ...overrides,
  };
}

/** Harbour is active with a failed run; Bright is paused and never ran; Northgate has ended. */
export const scheduleRows = (): Schedule[] => [
  scheduleOf({ failed_runs: 1 }),
  scheduleOf({
    id: 'sch-2',
    name: 'Quarterly VAT returns',
    client: bright,
    frequency: 'quarterly',
    status: 'paused',
    start_date: '2026-10-01',
    next_run_date: '2026-10-01',
    last_run_on: null,
    reference: null,
    net_estimate: 12000,
    notes: null,
    lines: [scheduleLine({ id: 'sl-2', description: 'VAT return', unit_amount: 12000 })],
  }),
  scheduleOf({
    id: 'sch-3',
    name: 'Annual accounts',
    client: north,
    frequency: 'annually',
    status: 'ended',
    start_date: '2025-04-01',
    end_date: '2026-04-01',
    next_run_date: null,
    last_run_on: '2026-04-01',
    reference: null,
    net_estimate: 90000,
    notes: null,
    lines: [scheduleLine({ id: 'sl-3', description: 'Annual accounts', unit_amount: 90000 })],
  }),
];

/** Harbour ran in August (invoice issued), September (failed) and October (drafted). */
export const runRows = (): Record<string, ScheduleRun[]> => ({
  'sch-1': [
    runOf({ id: 'run-3' }),
    runOf({
      id: 'run-2',
      run_date: '2026-09-01',
      status: 'failed',
      invoice_id: null,
      error: 'The client has no default VAT code.',
    }),
    runOf({
      id: 'run-1',
      run_date: '2026-08-01',
      invoice_id: 'inv-issued-1',
      invoice_number: 'INV-00042',
    }),
  ],
  'sch-3': [runOf({ id: 'run-9', schedule_id: 'sch-3', run_date: '2026-04-01' })],
});

/** The stand-in for the API behind the schedules: what is stored and what the page asked for. */
export interface RecurringBackend {
  schedules: Schedule[];
  /** The runs of each schedule, newest first. */
  runs: Record<string, ScheduleRun[]>;
  /** What a retry of a failed run comes to. */
  retryResult: 'succeeded' | 'failed';
  calls: Call[];
  nextId: number;
  /** Answers a route with an error: key `'POST /recurring/pause'` (no ids in the path). */
  refusals: Record<string, Refusal>;
}

export function createRecurringBackend(initial: Partial<RecurringBackend> = {}): RecurringBackend {
  return {
    schedules: scheduleRows(),
    runs: runRows(),
    retryResult: 'succeeded',
    calls: [],
    nextId: 0,
    refusals: {},
    ...initial,
  };
}

/** The calls of a kind to a path (`'/recurring'`, `'/recurring/sch-1/pause'`). */
export const recurringCalls = (backend: RecurringBackend, method: string, path: string) =>
  backend.calls.filter((call) => call.method === method && call.path === path);

function lineOf(line: LineInput, index: number): ScheduleLine {
  return {
    id: `sl-new-${String(index + 1)}`,
    position: index + 1,
    description: line.description,
    job_id: line.job_id ?? null,
    service_id: line.service_id ?? null,
    quantity: line.quantity,
    unit_amount: line.unit_amount,
    vat_rate_id: line.vat_rate_id ?? null,
  };
}

const netOf = (lines: ScheduleLine[]) =>
  lines.reduce((sum, line) => sum + Math.round(Number(line.quantity) * line.unit_amount), 0);

/** Handlers for the schedules and their runs, and the client and VAT lookups of the form. */
export function recurringHandlers(backend: RecurringBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message) : null;
  };
  const find = (id: unknown) => backend.schedules.find((schedule) => schedule.id === id);
  const store = (next: Schedule) => {
    backend.schedules = backend.schedules.map((schedule) =>
      schedule.id === next.id ? next : schedule,
    );
    return next;
  };
  const missing = () => fail(404, 'RESOURCE_NOT_FOUND', 'Schedule not found.');
  const failedCount = (scheduleId: string) =>
    (backend.runs[scheduleId] ?? []).filter((run) => run.status === 'failed').length;

  return [
    http.get(orgApiPath('/vat-rates'), () => ok(vatCodes)),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = clients.find((entry) => entry.id === params.clientId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
      return ok(
        clients.filter((entry) => !q || entry.name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/recurring'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/recurring', undefined, params);
      const failed = refusal('GET', '/recurring');
      if (failed) return failed;
      const statuses = params.getAll('status');
      const q = params.get('q')?.toLowerCase();
      return ok(
        backend.schedules.filter(
          (schedule) =>
            (!params.get('client_id') || schedule.client?.id === params.get('client_id')) &&
            (statuses.length === 0 || statuses.includes(schedule.status)) &&
            (!q ||
              [schedule.name, schedule.reference, schedule.client?.name].some((text) =>
                text?.toLowerCase().includes(q),
              )),
        ),
        { meta: END },
      );
    }),
    http.post(orgApiPath('/recurring'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/recurring', body);
      const failed = refusal('POST', '/recurring');
      if (failed) return failed;
      backend.nextId += 1;
      const lines = (body.lines as LineInput[]).map(lineOf);
      const created = scheduleOf({
        id: `sch-new-${String(backend.nextId)}`,
        name: body.name as string,
        client: clients.find((entry) => entry.id === body.client_id) ?? null,
        frequency: body.frequency as Schedule['frequency'],
        start_date: body.start_date as string,
        end_date: (body.end_date as string | undefined) ?? null,
        next_run_date: body.start_date as string,
        last_run_on: null,
        reference: (body.reference as string | undefined) ?? null,
        notes: (body.notes as string | undefined) ?? null,
        net_estimate: netOf(lines),
        created_at: `${TODAY}T10:00:00Z`,
        lines,
      });
      backend.schedules = [created, ...backend.schedules];
      return ok(created, { status: 201 });
    }),
    http.get(orgApiPath('/recurring/:scheduleId/runs'), ({ request, params }) => {
      const path = `/recurring/${String(params.scheduleId)}/runs`;
      record('GET', path, undefined, new URL(request.url).searchParams);
      const failed = refusal('GET', '/recurring/runs');
      if (failed) return failed;
      return ok(backend.runs[String(params.scheduleId)] ?? [], { meta: END });
    }),
    http.post(orgApiPath('/recurring/runs/:runId/retry'), ({ params }) => {
      record('POST', `/recurring/runs/${String(params.runId)}/retry`);
      const failed = refusal('POST', '/recurring/runs/retry');
      if (failed) return failed;
      for (const [scheduleId, runs] of Object.entries(backend.runs)) {
        const run = runs.find((entry) => entry.id === params.runId);
        if (!run) continue;
        if (run.status !== 'failed') {
          return fail(409, 'RUN_NOT_FAILED', 'Only a failed run can be retried.');
        }
        const retried: ScheduleRun =
          backend.retryResult === 'succeeded'
            ? {
                ...run,
                status: 'succeeded',
                invoice_id: 'inv-retried',
                error: null,
                attempts: run.attempts + 1,
              }
            : { ...run, attempts: run.attempts + 1, error: 'The client still has no VAT code.' };
        backend.runs[scheduleId] = runs.map((entry) => (entry.id === run.id ? retried : entry));
        const schedule = find(scheduleId);
        if (schedule) store({ ...schedule, failed_runs: failedCount(scheduleId) });
        return ok(retried);
      }
      return fail(404, 'RESOURCE_NOT_FOUND', 'Run not found.');
    }),
    http.get(orgApiPath('/recurring/:scheduleId'), ({ params }) => {
      record('GET', `/recurring/${String(params.scheduleId)}`);
      const failed = refusal('GET', '/recurring/id');
      if (failed) return failed;
      const found = find(params.scheduleId);
      return found ? ok(found) : missing();
    }),
    http.patch(orgApiPath('/recurring/:scheduleId'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('PATCH', `/recurring/${String(params.scheduleId)}`, body);
      const failed = refusal('PATCH', '/recurring/id');
      if (failed) return failed;
      const found = find(params.scheduleId);
      if (!found) return missing();
      if (found.status === 'ended') {
        return fail(409, 'SCHEDULE_ENDED', 'An ended schedule cannot be changed.');
      }
      let next: Schedule = { ...found };
      for (const key of ['name', 'frequency', 'end_date', 'reference', 'notes'] as const) {
        if (key in body) next = { ...next, [key]: body[key] };
      }
      if (body.lines) {
        const lines = (body.lines as LineInput[]).map(lineOf);
        next = { ...next, lines, net_estimate: netOf(lines) };
      }
      return ok(store(next));
    }),
    http.delete(orgApiPath('/recurring/:scheduleId'), ({ params }) => {
      record('DELETE', `/recurring/${String(params.scheduleId)}`);
      const failed = refusal('DELETE', '/recurring/id');
      if (failed) return failed;
      const found = find(params.scheduleId);
      if (!found) return missing();
      if ((backend.runs[found.id] ?? []).length > 0) {
        return fail(
          409,
          'SCHEDULE_HAS_RUNS',
          'This schedule has already run. Pause it or set an end date instead.',
        );
      }
      backend.schedules = backend.schedules.filter((schedule) => schedule.id !== found.id);
      return new HttpResponse(null, { status: 204 });
    }),
    ...(['pause', 'resume'] as const).map((action) =>
      http.post(orgApiPath(`/recurring/:scheduleId/${action}`), ({ params }) => {
        record('POST', `/recurring/${String(params.scheduleId)}/${action}`);
        const failed = refusal('POST', `/recurring/${action}`);
        if (failed) return failed;
        const found = find(params.scheduleId);
        if (!found) return missing();
        const from = action === 'pause' ? 'active' : 'paused';
        if (found.status !== from) {
          return fail(
            409,
            action === 'pause' ? 'SCHEDULE_NOT_ACTIVE' : 'SCHEDULE_NOT_PAUSED',
            `Only ${from} schedules can be ${action}d.`,
          );
        }
        return ok(store({ ...found, status: action === 'pause' ? 'paused' : 'active' }));
      }),
    ),
  ];
}
