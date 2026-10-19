import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  Adjustment,
  HistoricGroup,
  HistoricItem,
  HistoricRow,
  Member,
  Movement,
  SnapshotInfo,
  Transfer,
  WipGroup,
  WipGroupRow,
  WipItem,
  WriteOff,
} from '../types';
import {
  IDS,
  clients,
  historicReport,
  jobs as jobFixtures,
  members as memberFixtures,
  person,
  services,
  totalsOf,
  type JobFixture,
} from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };

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
  details?: { field: string; message: string }[];
}

/** The stand-in for the API: what the tests read and change, and what the page asked for. */
export interface WipBackend {
  /** Summary rows by grouping, as the API would return them; the handler sorts, searches, pages. */
  summary: Partial<Record<WipGroup, WipGroupRow[]>>;
  items: WipItem[];
  adjustments: Adjustment[];
  transfers: Transfer[];
  movements: Movement[];
  writeOffs: WriteOff[];
  historic: Partial<Record<HistoricGroup, HistoricRow[]>>;
  historicItems: HistoricItem[];
  snapshot: SnapshotInfo | null;
  members: Member[];
  jobs: JobFixture[];
  /** Every request in order, with its body or query. */
  calls: Call[];
  /** Rows per page of the lists (everything when 0). */
  pageSize: number;
  nextId: number;
  /** The id of the signed-in person. */
  userId: string;
  /** An adjustment above this many pence needs approval. */
  threshold: number;
  /** Nobody approves their own request. */
  selfApprovalForbidden: boolean;
  /** Answers a route with an error: key `'POST /wip/transfers'`. */
  refusals: Record<string, Refusal>;
}

export function createBackend(initial: Partial<WipBackend> = {}): WipBackend {
  return {
    summary: {},
    items: [],
    adjustments: [],
    transfers: [],
    movements: [],
    writeOffs: [],
    historic: {},
    historicItems: [],
    snapshot: null,
    members: structuredClone(memberFixtures),
    jobs: structuredClone(jobFixtures),
    calls: [],
    pageSize: 0,
    nextId: 0,
    userId: IDS.ada,
    threshold: 50000,
    selfApprovalForbidden: false,
    refusals: {},
    ...initial,
  };
}

function pageOf<T>(rows: T[], params: URLSearchParams, size: number) {
  if (!size) return { rows, meta: END };
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const compare = (left: string | number | null, right: string | number | null) => {
  if (left === right) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  return left < right ? -1 : 1;
};

const sorted = <T>(rows: T[], key: (row: T) => string | number | null, order: string) =>
  [...rows].sort((a, b) => (order === 'desc' ? -1 : 1) * compare(key(a), key(b)));

const today = '2026-10-18';

/** Handlers for every endpoint the WIP screens call (and the pickers they embed). */
export function wipHandlers(backend: WipBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message, { details: found.details }) : null;
  };
  const id = (prefix: string) => {
    backend.nextId += 1;
    return `${prefix}-new-${String(backend.nextId)}`;
  };
  const me = person(backend.userId, 'Ada Lovelace');
  const jobRef = (jobId: unknown) => {
    const found = backend.jobs.find((entry) => entry.id === jobId);
    return found ? { id: found.id, number: found.number, name: found.name } : null;
  };
  const clientOf = (clientId: unknown) => clients.find((entry) => entry.id === clientId) ?? null;
  const reasonMissing = (body: Record<string, unknown>) =>
    typeof body.reason !== 'string' || body.reason.trim() === ''
      ? fail(422, 'VALIDATION_ERROR', 'Check the highlighted fields.', {
          details: [{ field: 'reason', message: 'A reason is required.' }],
        })
      : null;

  return [
    /* ------------------------------ Lookups ------------------------------ */
    http.get(orgApiPath('/members'), ({ request }) => {
      record('GET', '/members', undefined, new URL(request.url).searchParams);
      return ok(backend.members, { meta: END });
    }),
    http.get(orgApiPath('/services'), () => ok(services)),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = clientOf(params.clientId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
      return ok(
        clients.filter((entry) => !q || entry.name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = backend.jobs.find((entry) => entry.id === params.jobId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Job not found.');
    }),
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      const q = params.get('q')?.toLowerCase();
      const clientId = params.get('client_id');
      return ok(
        backend.jobs.filter(
          (entry) =>
            (!clientId || entry.client_id === clientId) &&
            (!q || `${entry.number} ${entry.name}`.toLowerCase().includes(q)),
        ),
        { meta: END },
      );
    }),

    /* -------------------------------- Views ------------------------------- */
    http.get(orgApiPath('/wip/summary'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/summary', undefined, params);
      const failed = refusal('GET', '/wip/summary');
      if (failed) return failed;
      const group = (params.get('group_by') ?? 'client') as WipGroup;
      const q = params.get('q')?.toLowerCase();
      const all = (backend.summary[group] ?? []).filter(
        (row) => !q || `${row.name} ${row.code ?? ''}`.toLowerCase().includes(q),
      );
      const accessor: Record<string, (row: WipGroupRow) => string | number | null> = {
        name: (row) => row.name,
        total: (row) => row.total,
        time: (row) => row.time,
        fixed_fee: (row) => row.fixed_fee,
        expense: (row) => row.expense,
        oldest: (row) => row.oldest_date,
        over_90: (row) => row.over_90_bp,
        items: (row) => row.item_count,
      };
      const key = accessor[params.get('sort') ?? 'name'] ?? accessor.name;
      const ordered = sorted(all, key ?? ((row) => row.name), params.get('order') ?? 'asc');
      const page = pageOf(ordered, params, backend.pageSize);
      return ok(
        { group_by: group, as_at: today, rows: page.rows, totals: totalsOf(all) },
        { meta: page.meta },
      );
    }),
    http.get(orgApiPath('/wip/items'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/items', undefined, params);
      const failed = refusal('GET', '/wip/items');
      if (failed) return failed;
      const kinds = params.getAll('kind');
      const q = params.get('q')?.toLowerCase();
      const minAge = params.get('min_age_days');
      const rows = backend.items.filter(
        (entry) =>
          (!params.get('client_id') || entry.client?.id === params.get('client_id')) &&
          (!params.get('job_id') || entry.job?.id === params.get('job_id')) &&
          (kinds.length === 0 || kinds.includes(entry.kind)) &&
          (minAge === null || (entry.age_days ?? 0) >= Number(minAge)) &&
          (!q ||
            `${entry.description ?? ''} ${entry.client?.name ?? ''} ${entry.job?.name ?? ''}`
              .toLowerCase()
              .includes(q)),
      );
      const accessor: Record<string, (row: WipItem) => string | number | null> = {
        date: (row) => row.date,
        value: (row) => row.value,
        client: (row) => row.client?.name ?? null,
      };
      const ordered = sorted(
        rows,
        accessor[params.get('sort') ?? 'date'] ?? ((row) => row.date),
        params.get('order') ?? 'asc',
      );
      const page = pageOf(ordered, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.get(orgApiPath('/wip/ledger'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/ledger', undefined, params);
      const kinds = params.getAll('kind');
      const rows = backend.movements.filter(
        (entry) =>
          (kinds.length === 0 || kinds.includes(entry.kind)) &&
          (!params.get('source_type') || entry.source_type === params.get('source_type')) &&
          (!params.get('client_id') || entry.client?.id === params.get('client_id')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),

    /* ------------------------------ Write-offs ----------------------------- */
    http.get(orgApiPath('/wip/write-offs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/write-offs', undefined, params);
      const failed = refusal('GET', '/wip/write-offs');
      if (failed) return failed;
      const clientId = params.get('client_id');
      const jobId = params.get('job_id');
      const from = params.get('date_from');
      const to = params.get('date_to');
      const rows = backend.writeOffs.filter(
        (entry) =>
          (!clientId || entry.client?.id === clientId) &&
          (!jobId || entry.job_id === jobId) &&
          (!from || entry.written_off_on >= from) &&
          (!to || entry.written_off_on <= to),
      );
      const page = pageOf(
        sorted(rows, (row) => row.written_off_on, 'desc'),
        params,
        backend.pageSize,
      );
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/wip/write-offs'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/wip/write-offs', body);
      const failed = refusal('POST', '/wip/write-offs') ?? reasonMissing(body);
      if (failed) return failed;
      const refs = (body.items as Record<string, string>[] | undefined) ?? [];
      const wanted = new Set(refs.map((ref) => Object.values(ref)[0]));
      const taken = backend.items.filter((entry) => wanted.has(entry.id));
      backend.items = backend.items.filter((entry) => !wanted.has(entry.id));
      const created: WriteOff = {
        id: id('wo'),
        client: clientOf(body.client_id),
        job_id: null,
        written_off_on: (body.written_off_on as string | undefined) ?? today,
        reason: body.reason as string,
        total_wip_value: taken.reduce((sum, entry) => sum + entry.value, 0),
        item_count: taken.length,
        created_by: backend.userId,
        created_at: `${today}T10:00:00Z`,
      };
      backend.writeOffs.push(created);
      return ok(created, { status: 201 });
    }),
    http.delete(orgApiPath('/wip/write-offs/:writeOffId'), ({ params }) => {
      record('DELETE', `/wip/write-offs/${String(params.writeOffId)}`);
      const failed = refusal('DELETE', '/wip/write-offs');
      if (failed) return failed;
      backend.writeOffs = backend.writeOffs.filter((entry) => entry.id !== params.writeOffId);
      return ok(null);
    }),

    /* ----------------------------- Adjustments ---------------------------- */
    http.get(orgApiPath('/wip/adjustments/counts'), () => {
      const count = (status: Adjustment['status']) =>
        backend.adjustments.filter((entry) => entry.status === status).length;
      return ok({
        pending: count('pending'),
        approved: count('approved'),
        rejected: count('rejected'),
        reversed: count('reversed'),
        pending_value: backend.adjustments
          .filter((entry) => entry.status === 'pending')
          .reduce((sum, entry) => sum + entry.amount, 0),
      });
    }),
    http.get(orgApiPath('/wip/adjustments'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/adjustments', undefined, params);
      const statuses = params.getAll('status');
      const rows = backend.adjustments.filter(
        (entry) =>
          (statuses.length === 0 || statuses.includes(entry.status)) &&
          (!params.get('kind') || entry.kind === params.get('kind')) &&
          (!params.get('client_id') || entry.client?.id === params.get('client_id')) &&
          (!params.get('job_id') || entry.job?.id === params.get('job_id')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/wip/adjustments'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/wip/adjustments', body);
      const failed = refusal('POST', '/wip/adjustments') ?? reasonMissing(body);
      if (failed) return failed;
      const amount = body.amount as number;
      const needsApproval = amount > backend.threshold;
      const created: Adjustment = {
        id: id('a'),
        client: clientOf(body.client_id),
        job: jobRef(body.job_id),
        kind: body.kind as Adjustment['kind'],
        component: (body.component as Adjustment['component'] | undefined) ?? 'time',
        amount,
        signed_amount: body.kind === 'write_on' ? amount : -amount,
        effective_date: (body.effective_date as string | undefined) ?? today,
        reason: body.reason as string,
        status: needsApproval ? 'pending' : 'approved',
        approval_required: needsApproval,
        threshold: backend.threshold,
        requested_by: me,
        requested_at: `${today}T10:00:00Z`,
        decided_by: needsApproval ? null : me,
        decided_at: needsApproval ? null : `${today}T10:00:00Z`,
        decision_note: null,
        reversed_by: null,
        reversed_at: null,
        reversal_reason: null,
        in_force: !needsApproval,
        movement_id: null,
      };
      backend.adjustments.unshift(created);
      return ok(created, {
        status: 201,
        message: needsApproval ? 'Adjustment sent for approval' : 'WIP adjusted',
      });
    }),
    http.post(orgApiPath('/wip/adjustments/:adjustmentId/approve'), async ({ params, request }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      record('POST', `/wip/adjustments/${String(params.adjustmentId)}/approve`, body);
      const failed = refusal('POST', '/wip/adjustments/approve');
      if (failed) return failed;
      const found = backend.adjustments.find((entry) => entry.id === params.adjustmentId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Adjustment not found.');
      if (backend.selfApprovalForbidden && found.requested_by.user_id === backend.userId) {
        return fail(403, 'SELF_APPROVAL_FORBIDDEN', 'You cannot approve your own request.');
      }
      if (found.status !== 'pending') {
        return fail(409, 'ADJUSTMENT_NOT_PENDING', 'This adjustment has been decided already.');
      }
      Object.assign(found, {
        status: 'approved',
        in_force: true,
        decided_by: me,
        decided_at: `${today}T11:00:00Z`,
        decision_note: (body.note as string | undefined) ?? null,
      });
      return ok(found);
    }),
    http.post(orgApiPath('/wip/adjustments/:adjustmentId/reject'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/wip/adjustments/${String(params.adjustmentId)}/reject`, body);
      const failed = refusal('POST', '/wip/adjustments/reject') ?? reasonMissing(body);
      if (failed) return failed;
      const found = backend.adjustments.find((entry) => entry.id === params.adjustmentId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Adjustment not found.');
      if (found.status !== 'pending') {
        return fail(409, 'ADJUSTMENT_NOT_PENDING', 'This adjustment has been decided already.');
      }
      Object.assign(found, {
        status: 'rejected',
        decided_by: me,
        decided_at: `${today}T11:00:00Z`,
        decision_note: body.reason as string,
      });
      return ok(found);
    }),
    http.post(orgApiPath('/wip/adjustments/:adjustmentId/reverse'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/wip/adjustments/${String(params.adjustmentId)}/reverse`, body);
      const failed = refusal('POST', '/wip/adjustments/reverse') ?? reasonMissing(body);
      if (failed) return failed;
      const found = backend.adjustments.find((entry) => entry.id === params.adjustmentId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Adjustment not found.');
      if (found.status !== 'approved') {
        return fail(
          409,
          'ADJUSTMENT_NOT_REVERSIBLE',
          'Only an approved adjustment can be reversed.',
        );
      }
      Object.assign(found, {
        status: 'reversed',
        in_force: false,
        reversed_by: me,
        reversed_at: `${today}T12:00:00Z`,
        reversal_reason: body.reason as string,
      });
      return ok(found);
    }),

    /* ------------------------------ Transfers ----------------------------- */
    http.get(orgApiPath('/wip/transfers'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/wip/transfers', undefined, params);
      const rows = backend.transfers.filter(
        (entry) =>
          (!params.get('status') || entry.status === params.get('status')) &&
          (!params.get('client_id') || entry.client?.id === params.get('client_id')) &&
          (!params.get('job_id') ||
            entry.from_job?.id === params.get('job_id') ||
            entry.to_job?.id === params.get('job_id')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/wip/transfers'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/wip/transfers', body);
      const failed = refusal('POST', '/wip/transfers') ?? reasonMissing(body);
      if (failed) return failed;
      const from = backend.jobs.find((entry) => entry.id === body.from_job_id);
      const to = backend.jobs.find((entry) => entry.id === body.to_job_id);
      if (!from || !to) return fail(404, 'RESOURCE_NOT_FOUND', 'Job not found.');
      if (from.id === to.id) return fail(422, 'SAME_JOB', 'Choose two different jobs.');
      if (from.client_id !== to.client_id) {
        return fail(422, 'CLIENT_MISMATCH', 'Both jobs must belong to the same client.');
      }
      const refs =
        (body.items as { kind: 'time' | 'disbursement' | 'expense'; id: string }[] | null) ?? [];
      const moved = backend.items.filter((entry) => refs.some((ref) => ref.id === entry.id));
      const created: Transfer = {
        id: id('tr'),
        client: clientOf(from.client_id),
        from_job: jobRef(from.id),
        to_job: jobRef(to.id),
        component: (body.component as Transfer['component'] | undefined) ?? 'time',
        amount:
          (body.amount as number | null | undefined) ??
          moved.reduce((sum, entry) => sum + entry.value, 0),
        effective_date: (body.effective_date as string | undefined) ?? today,
        reason: body.reason as string,
        items: moved.map((entry) => ({
          kind: entry.kind as 'time' | 'disbursement' | 'expense',
          id: entry.id,
          value: entry.value,
        })),
        status: 'applied',
        created_by: me,
        created_at: `${today}T10:00:00Z`,
        reversed_by: null,
        reversed_at: null,
        reversal_reason: null,
      };
      backend.transfers.unshift(created);
      return ok(created, { status: 201 });
    }),
    http.post(orgApiPath('/wip/transfers/:transferId/reverse'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/wip/transfers/${String(params.transferId)}/reverse`, body);
      const failed = refusal('POST', '/wip/transfers/reverse') ?? reasonMissing(body);
      if (failed) return failed;
      const found = backend.transfers.find((entry) => entry.id === params.transferId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Transfer not found.');
      if (found.status !== 'applied') {
        return fail(409, 'TRANSFER_NOT_REVERSIBLE', 'This transfer has been reversed already.');
      }
      Object.assign(found, {
        status: 'reversed',
        reversed_by: me,
        reversed_at: `${today}T12:00:00Z`,
        reversal_reason: body.reason as string,
      });
      return ok(found);
    }),

    /* ----------------------------- Historic WIP ----------------------------- */
    http.get(orgApiPath('/reports/wip/items'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/reports/wip/items', undefined, params);
      const rows = backend.historicItems.filter(
        (entry) =>
          (!params.get('client_id') || entry.client.id === params.get('client_id')) &&
          (!params.get('job_id') || entry.job_id === params.get('job_id')) &&
          (!params.get('billing_type') || entry.billing_type === params.get('billing_type')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.get(orgApiPath('/reports/wip'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/reports/wip', undefined, params);
      const failed = refusal('GET', '/reports/wip');
      if (failed) return failed;
      const format = params.get('format') ?? 'json';
      if (format === 'csv') {
        return new HttpResponse('Client,Total\nAcme Ltd,1100.00\n', {
          headers: { 'Content-Type': 'text/csv; charset=utf-8' },
        });
      }
      if (format === 'xlsx') {
        return new HttpResponse(new Uint8Array([80, 75, 3, 4]), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          },
        });
      }
      const group = (params.get('group_by') ?? 'client') as HistoricGroup;
      const report = historicReport(backend.historic[group] ?? [], {
        filters: { as_at: params.get('as_at') ?? today, group_by: group },
        ...(backend.snapshot ? { snapshot: backend.snapshot } : {}),
      });
      return ok(report);
    }),
  ];
}

/** The calls of one kind, for an assertion: `callsOf(backend, 'POST')`. */
export const callsOf = (backend: WipBackend, method: string) =>
  backend.calls.filter((call) => call.method === method);
