import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import { clients, jobs, members, services } from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };
const TODAY = '2026-10-18';

export interface Call {
  method: string;
  path: string;
  params?: URLSearchParams;
}

export interface Refusal {
  status: number;
  code: string;
  message: string;
}

/** What a report answers: its rows and totals (the filters are echoed from the request). */
export interface Answer {
  rows: unknown[];
  totals: unknown;
}

/** The stand-in for the API: what a report answers, and what the page asked for. */
export interface ReportsBackend {
  /** The answer of each report, by endpoint (`utilisation`, `billing-summary`). */
  reports: Record<string, Answer>;
  /** The answer when a grouping is asked for, by endpoint then `group_by`. */
  grouped: Record<string, Record<string, Answer>>;
  /** Every request in order, with its query. */
  calls: Call[];
  /** Answers a route with an error: key `'GET /reports/payments'`, or `'… (file)'` for a download. */
  refusals: Record<string, Refusal>;
}

export function createBackend(initial: Partial<ReportsBackend> = {}): ReportsBackend {
  return { reports: {}, grouped: {}, calls: [], refusals: {}, ...initial };
}

/** The runs of one report (not its downloads). */
export const runsOf = (backend: ReportsBackend, endpoint: string) =>
  backend.calls.filter(
    (call) => call.path === `/reports/${endpoint}` && !call.params?.has('format'),
  );

/** The downloads of one report. */
export const downloadsOf = (backend: ReportsBackend, endpoint: string) =>
  backend.calls.filter(
    (call) => call.path === `/reports/${endpoint}` && call.params?.has('format'),
  );

const FILES: Record<string, { type: string; body: string }> = {
  csv: { type: 'text/csv', body: 'name,total\nAcme Ltd,100\n' },
  xlsx: {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    body: 'PK-xlsx',
  },
  pdf: { type: 'application/pdf', body: '%PDF-1.4 report' },
};

/** Handlers for the report endpoints, and the lookups the filters' pickers use. */
export function reportsHandlers(backend: ReportsBackend): HttpHandler[] {
  return [
    http.get(orgApiPath('/staff/:staffId'), ({ params }) => {
      const found = members.find((entry) => entry.id === params.staffId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Staff member not found.');
    }),
    http.get(orgApiPath('/staff'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
      return ok(
        members.filter((entry) => !q || entry.full_name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/services'), () => ok(services)),
    http.get(orgApiPath('/activity-codes'), () => ok([])),
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
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = jobs.find((entry) => entry.id === params.jobId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Job not found.');
    }),
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const clientId = new URL(request.url).searchParams.get('client_id');
      return ok(
        jobs.filter((entry) => !clientId || entry.client_id === clientId),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/reports/:endpoint'), ({ request, params }) => {
      const endpoint = String(params.endpoint);
      const query = new URL(request.url).searchParams;
      backend.calls.push({ method: 'GET', path: `/reports/${endpoint}`, params: query });
      const format = query.get('format');
      const file = format ? FILES[format] : undefined;

      const refused = backend.refusals[`GET /reports/${endpoint}${file ? ' (file)' : ''}`];
      if (refused) return fail(refused.status, refused.code, refused.message);
      if (file) return new HttpResponse(file.body, { headers: { 'Content-Type': file.type } });

      const answer =
        backend.grouped[endpoint]?.[query.get('group_by') ?? ''] ?? backend.reports[endpoint];
      if (!answer) return fail(404, 'RESOURCE_NOT_FOUND', 'Unknown report.');
      return ok({
        rows: answer.rows,
        totals: answer.totals,
        filters: {
          date_from: query.get('date_from') ?? '2026-10-01',
          date_to: query.get('date_to') ?? TODAY,
          as_at: query.get('as_at') ?? TODAY,
          group_by: query.get('group_by'),
          week_from: query.get('week_from') ?? '2026-09-21',
          week_to: query.get('week_to') ?? '2026-10-12',
        },
      });
    }),
  ];
}
