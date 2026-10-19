import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { JOB_TRANSITIONS } from '../constants';
import type {
  Job,
  JobBudgetDetail,
  JobBudgetRow,
  JobStatus,
  Member,
  Rag,
  Task,
  TaskStatus,
} from '../types';
import {
  assignee,
  clients,
  event,
  IDS,
  job as makeJob,
  members as memberFixtures,
  services,
  task as makeTask,
} from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };

export interface Call {
  method: string;
  path: string;
  body?: unknown;
  params?: URLSearchParams;
}

/** The stand-in for the API: what the tests read and change, and what the page asked for. */
export interface JobsBackend {
  jobs: Job[];
  /** The tasks of every job (each knows its `job_id`). */
  tasks: Task[];
  members: Member[];
  /** Every write (and every list request) in order, with its body or query. */
  calls: Call[];
  /** Rows per page of the lists (everything when 0). */
  pageSize: number;
  /** Jobs something refers to: they cannot be deleted. */
  inUse: Set<string>;
  nextId: number;
  /** The id of the signed-in person (`me`). */
  userId: string;
}

export function createBackend(initial: Partial<JobsBackend> = {}): JobsBackend {
  return {
    jobs: [],
    tasks: [],
    members: structuredClone(memberFixtures),
    calls: [],
    pageSize: 0,
    inUse: new Set(),
    nextId: 0,
    userId: IDS.ada,
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

const named = (backend: JobsBackend, userId: string): Task['assignees'][number] => {
  const found = backend.members.find((entry) => entry.user_id === userId);
  return found ? assignee(found) : { user_id: userId, full_name: null };
};

const rowsOf = <T>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const sortRows = <T extends object>(rows: T[], sort: string): T[] => {
  const descending = sort.startsWith('-');
  const key = descending ? sort.slice(1) : sort;
  const direction = descending ? -1 : 1;
  const text = (value: unknown) => (typeof value === 'string' ? value : '~');
  return [...rows].sort((a, b) => {
    const left = (a as Record<string, unknown>)[key];
    const right = (b as Record<string, unknown>)[key];
    if (typeof left === 'number' && typeof right === 'number') return direction * (left - right);
    return direction * text(left).localeCompare(text(right));
  });
};

const ragOf = (usageBp: number | null): Rag | null =>
  usageBp === null ? null : usageBp >= 10000 ? 'red' : usageBp >= 8000 ? 'amber' : 'green';

const usageOf = (item: Job): number | null => {
  const values = [item.budget_minutes_used_bp, item.budget_fee_used_bp].filter(
    (value): value is number => value !== null,
  );
  return values.length > 0 ? Math.max(...values) : null;
};

/** Applies what a request body carries (undefined keys are left alone). */
function apply<T extends object>(target: T, body: Record<string, unknown>): T {
  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined) (target as Record<string, unknown>)[key] = value;
  }
  return target;
}

function syncCounts(backend: JobsBackend, target: Job) {
  const own = backend.tasks.filter((entry) => entry.job_id === target.id);
  target.task_counts = {
    total: own.length,
    completed: own.filter((entry) => entry.status === 'completed').length,
  };
}

function budgetRow(item: Job): JobBudgetRow {
  const usage = usageOf(item);
  return {
    job_id: item.id,
    number: item.number,
    name: item.name,
    status: item.status,
    billing_basis: item.billing_basis,
    client_id: item.client_id,
    client_code: item.client_code,
    client_name: item.client_name,
    service_id: item.service_id,
    service_name: item.service_name,
    manager_user_id: item.manager_user_id,
    manager_name:
      memberFixtures.find((entry) => entry.user_id === item.manager_user_id)?.full_name ?? null,
    partner_user_id: item.partner_user_id,
    partner_name: null,
    start_date: item.start_date,
    due_date: item.due_date,
    alerts: [],
    budget_minutes: item.budget_minutes,
    logged_minutes: item.logged_minutes,
    billable_minutes: item.billable_minutes,
    budget_minutes_used_bp: item.budget_minutes_used_bp,
    budget_fee: item.budget_fee,
    time_value: item.time_value,
    wip_value: item.wip_value,
    budget_fee_used_bp: item.budget_fee_used_bp,
    used_bp: usage,
    rag: ragOf(usage),
    cost_value: null,
    margin_value: null,
    margin_bp: null,
  };
}

/** Handlers for every endpoint the jobs screens call (and the pickers they embed). */
export function jobHandlers(backend: JobsBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const find = (jobId: unknown) => backend.jobs.find((entry) => entry.id === jobId);
  const me = (value: string | null) => (value === 'me' ? backend.userId : value);
  const notFound = () => fail(404, 'RESOURCE_NOT_FOUND', 'Job not found.');
  const taskOf = (jobId: unknown, taskId: unknown) =>
    backend.tasks.find((entry) => entry.job_id === jobId && entry.id === taskId);

  const filtered = (params: URLSearchParams) => {
    const statuses = params.getAll('status');
    const q = params.get('q')?.toLowerCase();
    const manager = me(params.get('manager_user_id'));
    const assigned = me(params.get('assignee'));
    const dueFrom = params.get('due_from');
    const dueTo = params.get('due_to');
    return backend.jobs.filter(
      (entry) =>
        (statuses.length === 0 || statuses.includes(entry.status)) &&
        (!q || `${entry.number} ${entry.name} ${entry.client_name}`.toLowerCase().includes(q)) &&
        (!params.get('client_id') || entry.client_id === params.get('client_id')) &&
        (!manager || entry.manager_user_id === manager) &&
        (!assigned || entry.assignee_user_ids.includes(assigned)) &&
        (!dueFrom || (entry.due_date !== null && entry.due_date >= dueFrom)) &&
        (!dueTo || (entry.due_date !== null && entry.due_date <= dueTo)),
    );
  };

  return [
    /* ------------------------------ Lookups ------------------------------ */
    http.get(orgApiPath('/members'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/members', undefined, params);
      return ok(backend.members, { meta: END });
    }),
    http.get(orgApiPath('/services'), () => ok(services)),
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

    /* ------------------------ Budgets and calendar ----------------------- */
    http.get(orgApiPath('/jobs/budgets'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/jobs/budgets', undefined, params);
      const from = params.get('used_from_bp');
      const to = params.get('used_to_bp');
      const sort = params.get('sort') ?? 'used';
      const order = params.get('order') ?? (sort === 'used' ? 'desc' : 'asc');
      const rows = filtered(params)
        .filter((entry) => entry.budget_minutes !== null || entry.budget_fee !== null)
        .map(budgetRow)
        .filter(
          (row) =>
            (from === null || (row.used_bp ?? -1) >= Number(from)) &&
            (to === null || (row.used_bp ?? Infinity) <= Number(to)),
        );
      const sortKey: Record<string, string> = {
        used: 'used_bp',
        number: 'number',
        name: 'name',
        client: 'client_name',
        due_date: 'due_date',
        logged_minutes: 'logged_minutes',
        time_value: 'time_value',
      };
      const ordered = sortRows(rows, `${order === 'desc' ? '-' : ''}${sortKey[sort] ?? 'used_bp'}`);
      const page = pageOf(ordered, params, backend.pageSize);
      const count = (rag: Rag) => rows.filter((row) => row.rag === rag).length;
      return ok(
        {
          rows: page.rows,
          totals: {
            jobs: rows.length,
            green: count('green'),
            amber: count('amber'),
            red: count('red'),
            budget_minutes: rows.reduce((sum, row) => sum + (row.budget_minutes ?? 0), 0),
            logged_minutes: rows.reduce((sum, row) => sum + row.logged_minutes, 0),
            budget_minutes_used_bp: rows.length > 0 ? 5000 : null,
            budget_fee: rows.reduce((sum, row) => sum + (row.budget_fee ?? 0), 0),
            time_value: rows.reduce((sum, row) => sum + row.time_value, 0),
            wip_value: rows.reduce((sum, row) => sum + row.wip_value, 0),
            budget_fee_used_bp: null,
            cost_value: null,
            margin_value: null,
            margin_bp: null,
          },
        },
        { meta: page.meta },
      );
    }),
    http.get(orgApiPath('/jobs/calendar'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/jobs/calendar', undefined, params);
      const from = params.get('from') ?? '';
      const to = params.get('to') ?? '';
      const assigned = me(params.get('assignee_user_id'));
      const events = [
        ...backend.jobs
          .filter((entry) => entry.start_date !== null || entry.due_date !== null)
          .filter((entry) => !assigned || entry.assignee_user_ids.includes(assigned))
          .filter(
            (entry) =>
              (entry.start_date ?? entry.due_date ?? '') <= to &&
              (entry.due_date ?? entry.start_date ?? '') >= from,
          )
          .map((entry) =>
            event({
              id: entry.id,
              job_id: entry.id,
              job_number: entry.number,
              title: entry.name,
              client_name: entry.client_name,
              start: entry.start_date ?? entry.due_date ?? from,
              end: entry.due_date,
              status: entry.status,
              due: entry.due_date,
            }),
          ),
        ...backend.tasks
          .filter(
            (entry) => entry.due_date !== null && entry.due_date >= from && entry.due_date <= to,
          )
          .map((entry) => {
            const owner = find(entry.job_id);
            return event({
              type: 'task',
              id: entry.id,
              job_id: entry.job_id,
              job_number: owner?.number ?? '',
              title: entry.title,
              client_name: owner?.client_name ?? '',
              start: entry.due_date ?? from,
              end: entry.due_date,
              status: entry.status,
              due: entry.due_date,
              assignees: entry.assignees,
            });
          }),
      ];
      return ok({ from, to, events });
    }),

    /* ------------------------------ Task list ----------------------------- */
    http.get(orgApiPath('/tasks'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/tasks', undefined, params);
      const statuses = params.getAll('status');
      const q = params.get('q')?.toLowerCase();
      const assigned = me(params.get('assignee_user_id'));
      const rows = backend.tasks
        .map((entry) => ({ entry, owner: find(entry.job_id) }))
        .filter(
          (pair): pair is { entry: Task; owner: Job } =>
            pair.owner !== undefined &&
            (statuses.length === 0 || statuses.includes(pair.entry.status)) &&
            (!q ||
              `${pair.entry.title} ${pair.owner.name} ${pair.owner.client_name}`
                .toLowerCase()
                .includes(q)) &&
            (!assigned || pair.entry.assignees.some((a) => a.user_id === assigned)) &&
            (!params.get('job_id') || pair.entry.job_id === params.get('job_id')),
        )
        .map(({ entry, owner }) => ({
          ...entry,
          job_number: owner.number,
          job_name: owner.name,
          job_status: owner.status,
          client_id: owner.client_id,
          client_name: owner.client_name,
        }));
      const sort = params.get('sort') ?? 'due_date';
      const key = sort.replace(/^-/, '').replace('job', 'job_number');
      const page = pageOf(
        sortRows(rows, `${sort.startsWith('-') ? '-' : ''}${key}`),
        params,
        backend.pageSize,
      );
      return ok(page.rows, { meta: page.meta });
    }),

    /* -------------------------------- Jobs -------------------------------- */
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/jobs', undefined, params);
      const page = pageOf(
        sortRows(filtered(params), params.get('sort') ?? '-created_at'),
        params,
        backend.pageSize,
      );
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/jobs'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/jobs', body);
      const client = clients.find((entry) => entry.id === body.client_id);
      if (!client) return fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
      if (body.billing_basis === 'fixed' && body.fixed_fee === undefined && !body.service_id) {
        return fail(422, 'VALIDATION_ERROR', 'Some fields are not valid.', {
          details: [
            { field: 'fixed_fee', code: 'required', message: 'A fixed-fee job needs a fee.' },
          ],
        });
      }
      backend.nextId += 1;
      const created = apply(
        makeJob({
          id: `j-new-${String(backend.nextId)}`,
          number: `J${String(100 + backend.nextId).padStart(5, '0')}`,
          client_name: client.name,
          client_code: client.code,
          status: 'planned',
          assignee_user_ids: [],
          logged_minutes: 0,
          billable_minutes: 0,
          time_value: 0,
          wip_value: 0,
          budget_minutes: null,
          budget_minutes_used_bp: null,
          start_date: null,
          due_date: null,
          manager_user_id: null,
        }),
        body,
      );
      backend.jobs.push(created);
      return ok(created, { status: 201, message: 'Job created' });
    }),
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = find(params.jobId);
      return found ? ok(found) : notFound();
    }),
    http.patch(orgApiPath('/jobs/:jobId'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('PATCH', `/jobs/${String(params.jobId)}`, body);
      const found = find(params.jobId);
      if (!found) return notFound();
      return ok(apply(found, body), { message: 'Job updated' });
    }),
    http.delete(orgApiPath('/jobs/:jobId'), ({ params }) => {
      record('DELETE', `/jobs/${String(params.jobId)}`);
      const found = find(params.jobId);
      if (!found) return notFound();
      if (backend.inUse.has(found.id)) {
        return fail(
          409,
          'JOB_IN_USE',
          'Time is recorded against this job: complete or cancel it instead.',
        );
      }
      backend.jobs = backend.jobs.filter((entry) => entry.id !== found.id);
      backend.tasks = backend.tasks.filter((entry) => entry.job_id !== found.id);
      return ok(null, { message: 'Job deleted' });
    }),
    http.post(orgApiPath('/jobs/:jobId/status'), async ({ params, request }) => {
      const body = (await request.json()) as { status: JobStatus };
      record('POST', `/jobs/${String(params.jobId)}/status`, body);
      const found = find(params.jobId);
      if (!found) return notFound();
      if (!JOB_TRANSITIONS[found.status].some((transition) => transition.to === body.status)) {
        return fail(
          409,
          'INVALID_STATUS_TRANSITION',
          `A job cannot go from ${found.status} to ${body.status}.`,
        );
      }
      found.status = body.status;
      return ok(found, { message: 'Job status changed' });
    }),
    http.post(orgApiPath('/jobs/:jobId/copy'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/jobs/${String(params.jobId)}/copy`, body);
      const source = find(params.jobId);
      if (!source) return notFound();
      backend.nextId += 1;
      const copy: Job = {
        ...structuredClone(source),
        id: `j-copy-${String(backend.nextId)}`,
        number: `J${String(100 + backend.nextId).padStart(5, '0')}`,
        name: typeof body.name === 'string' ? body.name : `Copy of ${source.name}`,
        status: 'planned',
        logged_minutes: 0,
        wip_value: 0,
        time_value: 0,
        assignee_user_ids: body.copy_assignees === false ? [] : source.assignee_user_ids,
      };
      backend.jobs.push(copy);
      if (body.copy_tasks !== false) {
        for (const original of backend.tasks.filter((entry) => entry.job_id === source.id)) {
          backend.tasks.push({
            ...structuredClone(original),
            id: `${original.id}-copy-${String(backend.nextId)}`,
            job_id: copy.id,
            status: 'not_started',
          });
        }
      }
      syncCounts(backend, copy);
      return ok(copy, { status: 201, message: 'Job copied' });
    }),
    http.put(orgApiPath('/jobs/:jobId/assignees'), async ({ params, request }) => {
      const body = (await request.json()) as { user_ids: string[] };
      record('PUT', `/jobs/${String(params.jobId)}/assignees`, body);
      const found = find(params.jobId);
      if (!found) return notFound();
      found.assignee_user_ids = body.user_ids;
      return ok(found, { message: 'Assignees updated' });
    }),

    /* ---------------------------- Budget of a job ---------------------------- */
    http.get(orgApiPath('/jobs/:jobId/budget'), ({ params }) => {
      const found = find(params.jobId);
      if (!found) return notFound();
      const own = backend.tasks.filter((entry) => entry.job_id === found.id);
      const usage = usageOf(found);
      const detail: JobBudgetDetail = {
        job_id: found.id,
        number: found.number,
        name: found.name,
        status: found.status,
        billing_basis: found.billing_basis,
        client_id: found.client_id,
        client_name: found.client_name,
        due_date: found.due_date,
        billed_value: found.billed_value,
        written_off_value: found.written_off_value,
        remaining_minutes:
          found.budget_minutes === null ? null : found.budget_minutes - found.logged_minutes,
        remaining_fee: found.budget_fee === null ? null : found.budget_fee - found.time_value,
        by_task: [
          ...own.map((entry) => ({
            task_id: entry.id,
            title: entry.title,
            status: entry.status,
            budget_minutes: entry.budget_minutes,
            minutes: entry.logged_minutes,
            used_bp: entry.budget_used_bp,
            value: 0,
            cost_value: null,
          })),
          {
            task_id: null,
            title: null,
            status: null,
            budget_minutes: null,
            minutes:
              found.logged_minutes - own.reduce((sum, entry) => sum + entry.logged_minutes, 0),
            used_bp: null,
            value: found.time_value,
            cost_value: null,
          },
        ],
        by_person: [
          {
            user_id: IDS.ada,
            full_name: 'Ada Lovelace',
            minutes: found.logged_minutes,
            billable_minutes: found.billable_minutes,
            value: found.time_value,
            cost_value: null,
          },
        ],
        alerts: [],
        budget_minutes: found.budget_minutes,
        logged_minutes: found.logged_minutes,
        billable_minutes: found.billable_minutes,
        budget_minutes_used_bp: found.budget_minutes_used_bp,
        budget_fee: found.budget_fee,
        time_value: found.time_value,
        wip_value: found.wip_value,
        budget_fee_used_bp: found.budget_fee_used_bp,
        used_bp: usage,
        rag: ragOf(usage),
        cost_value: null,
        margin_value: null,
        margin_bp: null,
      };
      return ok(detail);
    }),
    http.post(orgApiPath('/jobs/:jobId/budget/evaluate'), ({ params }) => {
      record('POST', `/jobs/${String(params.jobId)}/budget/evaluate`);
      const found = find(params.jobId);
      if (!found) return notFound();
      return ok(
        {
          job_id: found.id,
          used_bp: usageOf(found),
          rag: ragOf(usageOf(found)),
          triggered: [],
          cleared: [],
          alerts: [],
        },
        { message: 'Budget evaluated' },
      );
    }),

    /* -------------------------------- Tasks -------------------------------- */
    http.get(orgApiPath('/jobs/:jobId/tasks'), ({ params }) => {
      if (!find(params.jobId)) return notFound();
      return ok(backend.tasks.filter((entry) => entry.job_id === params.jobId));
    }),
    http.post(orgApiPath('/jobs/:jobId/tasks'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/jobs/${String(params.jobId)}/tasks`, body);
      const owner = find(params.jobId);
      if (!owner) return notFound();
      if (owner.status === 'closed' || owner.status === 'cancelled') {
        return fail(409, 'JOB_CLOSED', 'A closed or cancelled job cannot be changed.');
      }
      backend.nextId += 1;
      const ids = rowsOf<string>(body.assignee_user_ids);
      const created = makeTask({
        id: `t-new-${String(backend.nextId)}`,
        job_id: owner.id,
        title: String(body.title),
        description: (body.description as string | undefined) ?? null,
        status: (body.status as TaskStatus | undefined) ?? 'not_started',
        due_date: (body.due_date as string | undefined) ?? null,
        budget_minutes: (body.budget_minutes as number | undefined) ?? null,
        assignees: ids.map((id) => named(backend, id)),
      });
      backend.tasks.push(created);
      syncCounts(backend, owner);
      return ok(created, { status: 201, message: 'Task added' });
    }),
    http.patch(orgApiPath('/jobs/:jobId/tasks/:taskId'), async ({ params, request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('PATCH', `/jobs/${String(params.jobId)}/tasks/${String(params.taskId)}`, body);
      const found = taskOf(params.jobId, params.taskId);
      return found ? ok(apply(found, body)) : fail(404, 'RESOURCE_NOT_FOUND', 'Task not found.');
    }),
    http.delete(orgApiPath('/jobs/:jobId/tasks/:taskId'), ({ params }) => {
      record('DELETE', `/jobs/${String(params.jobId)}/tasks/${String(params.taskId)}`);
      const found = taskOf(params.jobId, params.taskId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Task not found.');
      if (found.logged_minutes > 0) {
        return fail(409, 'TASK_IN_USE', 'Time is recorded against this task.');
      }
      backend.tasks = backend.tasks.filter((entry) => entry.id !== found.id);
      const owner = find(params.jobId);
      if (owner) syncCounts(backend, owner);
      return ok(null, { message: 'Task deleted' });
    }),
    http.post(orgApiPath('/jobs/:jobId/tasks/:taskId/status'), async ({ params, request }) => {
      const body = (await request.json()) as { status: TaskStatus };
      record('POST', `/jobs/${String(params.jobId)}/tasks/${String(params.taskId)}/status`, body);
      const found = taskOf(params.jobId, params.taskId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Task not found.');
      found.status = body.status;
      const owner = find(params.jobId);
      if (owner) syncCounts(backend, owner);
      return ok(found);
    }),
    http.put(orgApiPath('/jobs/:jobId/tasks/:taskId/assignees'), async ({ params, request }) => {
      const body = (await request.json()) as { user_ids: string[] };
      record('PUT', `/jobs/${String(params.jobId)}/tasks/${String(params.taskId)}/assignees`, body);
      const found = taskOf(params.jobId, params.taskId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Task not found.');
      found.assignees = body.user_ids.map((id) => named(backend, id));
      return ok(found);
    }),
  ];
}

/** The calls of one kind, for an assertion: `writes(backend, 'POST')`. */
export const callsOf = (backend: JobsBackend, method: string) =>
  backend.calls.filter((call) => call.method === method);
