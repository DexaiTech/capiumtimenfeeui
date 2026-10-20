import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  Estimate,
  EstimateDisplayStatus,
  EstimateLine,
  EstimateListSummary,
  LineInput,
} from '../types';
import { bright, clients, harbour, morgan, north } from './fixtures';
import type { Call, Refusal } from './handlers';
import { vatCodes } from './prepare';

const END = { next_cursor: null, has_more: false };
const TODAY = '2026-10-18';

/** One line of an estimate: quantity 1 at £200.00 under Standard VAT unless said otherwise. */
export function estimateLine(overrides: Partial<EstimateLine> = {}): EstimateLine {
  return {
    id: 'el-1',
    position: 1,
    description: 'Year-end accounts',
    job_id: null,
    service_id: null,
    quantity: '1.00',
    unit_amount: 20000,
    net_amount: 20000,
    vat_rate_id: 'vat-std',
    vat_rate_bp: 2000,
    vat_amount: 4000,
    ...overrides,
  };
}

/** A draft estimate for Harbour & Co: £200.00 + £40.00 VAT = £240.00. */
export function estimateOf(overrides: Partial<Estimate> = {}): Estimate {
  return {
    id: 'est-1',
    number: null,
    status: 'draft',
    display_status: 'draft',
    client: harbour,
    job_id: null,
    issue_date: null,
    expiry_date: '2026-11-30',
    reference: 'Year-end accounts',
    currency: 'GBP',
    net_total: 20000,
    vat_total: 4000,
    gross_total: 24000,
    sent_at: null,
    responded_at: null,
    converted_invoice_id: null,
    created_at: '2026-10-10T09:00:00Z',
    notes: 'Fixed price for the year to 31 March.',
    lines: [estimateLine()],
    ...overrides,
  };
}

/** One estimate of every status: draft, sent, accepted, declined and a sent one past its expiry. */
export const estimateRows = (): Estimate[] => [
  estimateOf(),
  estimateOf({
    id: 'est-2',
    number: 'EST-00001',
    status: 'sent',
    display_status: 'sent',
    client: bright,
    issue_date: '2026-10-01',
    expiry_date: '2026-10-31',
    reference: 'Bakery payroll',
    net_total: 10000,
    vat_total: 2000,
    gross_total: 12000,
    sent_at: '2026-10-01T09:00:00Z',
    notes: null,
    lines: [
      estimateLine({
        id: 'el-2',
        description: 'Payroll set-up',
        unit_amount: 10000,
        net_amount: 10000,
        vat_amount: 2000,
      }),
    ],
  }),
  estimateOf({
    id: 'est-3',
    number: 'EST-00002',
    status: 'accepted',
    display_status: 'accepted',
    client: north,
    issue_date: '2026-09-20',
    expiry_date: '2026-10-20',
    reference: null,
    net_total: 30000,
    vat_total: 6000,
    gross_total: 36000,
    sent_at: '2026-09-20T09:00:00Z',
    responded_at: '2026-09-25T09:00:00Z',
    notes: null,
    lines: [
      estimateLine({
        id: 'el-3',
        description: 'Practice review',
        unit_amount: 30000,
        net_amount: 30000,
        vat_amount: 6000,
      }),
    ],
  }),
  estimateOf({
    id: 'est-4',
    number: 'EST-00003',
    status: 'declined',
    display_status: 'declined',
    client: morgan,
    issue_date: '2026-09-01',
    expiry_date: '2026-10-01',
    reference: null,
    net_total: 5000,
    vat_total: 1000,
    gross_total: 6000,
    sent_at: '2026-09-01T09:00:00Z',
    responded_at: '2026-09-05T09:00:00Z',
    notes: null,
    lines: [
      estimateLine({
        id: 'el-4',
        description: 'Tax advice',
        unit_amount: 5000,
        net_amount: 5000,
        vat_amount: 1000,
      }),
    ],
  }),
  estimateOf({
    id: 'est-5',
    number: 'EST-00004',
    status: 'sent',
    display_status: 'expired',
    client: harbour,
    issue_date: '2026-08-15',
    expiry_date: '2026-09-30',
    reference: 'Old quote',
    net_total: 15000,
    vat_total: 3000,
    gross_total: 18000,
    sent_at: '2026-08-15T09:00:00Z',
    notes: null,
    lines: [
      estimateLine({
        id: 'el-5',
        description: 'Bookkeeping catch-up',
        unit_amount: 15000,
        net_amount: 15000,
        vat_amount: 3000,
      }),
    ],
  }),
];

/** The stand-in for the API behind the estimates: what is stored and what the page asked for. */
export interface EstimateBackend {
  estimates: Estimate[];
  calls: Call[];
  nextId: number;
  /** Answers a route with an error: key `'POST /estimates/send'` (no ids in the path). */
  refusals: Record<string, Refusal>;
}

export function createEstimateBackend(initial: Partial<EstimateBackend> = {}): EstimateBackend {
  return { estimates: estimateRows(), calls: [], nextId: 0, refusals: {}, ...initial };
}

/** The calls of a kind to a path (`'/estimates'`, `'/estimates/est-1/send'`). */
export const estimateCalls = (backend: EstimateBackend, method: string, path: string) =>
  backend.calls.filter((call) => call.method === method && call.path === path);

const SENT_OR_ACCEPTED = new Set(['sent', 'accepted']);

/** What the API stores for lines as sent: net and VAT per line, rounded half up. */
function priced(lines: LineInput[]): EstimateLine[] {
  return lines.map((line, index) => {
    const rate = vatCodes.find((code) => code.id === (line.vat_rate_id ?? 'vat-std'));
    const net = Math.round(Number(line.quantity) * line.unit_amount);
    return {
      id: `el-new-${String(index + 1)}`,
      position: index + 1,
      description: line.description,
      job_id: line.job_id ?? null,
      service_id: line.service_id ?? null,
      quantity: line.quantity,
      unit_amount: line.unit_amount,
      net_amount: net,
      vat_rate_id: rate?.id ?? null,
      vat_rate_bp: rate?.rate_bp ?? 0,
      vat_amount: Math.round((net * (rate?.rate_bp ?? 0)) / 10000),
    };
  });
}

function withTotals(estimate: Estimate, lines: EstimateLine[]): Estimate {
  const net = lines.reduce((sum, line) => sum + line.net_amount, 0);
  const vat = lines.reduce((sum, line) => sum + line.vat_amount, 0);
  return { ...estimate, lines, net_total: net, vat_total: vat, gross_total: net + vat };
}

/** Handlers for the estimates, and the client and VAT lookups the form and the filter use. */
export function estimateHandlers(backend: EstimateBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message) : null;
  };
  const find = (id: unknown) => backend.estimates.find((estimate) => estimate.id === id);
  const store = (next: Estimate) => {
    backend.estimates = backend.estimates.map((estimate) =>
      estimate.id === next.id ? next : estimate,
    );
    return next;
  };
  const missing = () => fail(404, 'RESOURCE_NOT_FOUND', 'Estimate not found.');
  const matching = (params: URLSearchParams, withStatus: boolean) => {
    const statuses = params.getAll('status');
    const q = params.get('q')?.toLowerCase();
    return backend.estimates.filter(
      (estimate) =>
        (!params.get('client_id') || estimate.client?.id === params.get('client_id')) &&
        (!withStatus || statuses.length === 0 || statuses.includes(estimate.display_status)) &&
        (!q ||
          [estimate.number, estimate.reference, estimate.client?.name].some((text) =>
            text?.toLowerCase().includes(q),
          )),
    );
  };

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
    http.get(orgApiPath('/estimates/summary'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/estimates/summary', undefined, params);
      const failed = refusal('GET', '/estimates/summary');
      if (failed) return failed;
      const rows = matching(params, false);
      const count = (status: EstimateDisplayStatus) =>
        rows.filter((estimate) => estimate.display_status === status).length;
      const summary: EstimateListSummary = {
        counts: {
          draft: count('draft'),
          sent: count('sent'),
          accepted: count('accepted'),
          declined: count('declined'),
          expired: count('expired'),
          total: rows.length,
        },
        open_gross: rows
          .filter((estimate) => estimate.display_status === 'sent')
          .reduce((sum, estimate) => sum + estimate.gross_total, 0),
      };
      return ok(summary);
    }),
    http.get(orgApiPath('/estimates'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/estimates', undefined, params);
      const failed = refusal('GET', '/estimates');
      if (failed) return failed;
      return ok(matching(params, true), { meta: END });
    }),
    http.post(orgApiPath('/estimates'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/estimates', body);
      const failed = refusal('POST', '/estimates');
      if (failed) return failed;
      backend.nextId += 1;
      const client = clients.find((entry) => entry.id === body.client_id) ?? null;
      const created = withTotals(
        estimateOf({
          id: `est-new-${String(backend.nextId)}`,
          client,
          expiry_date: (body.expiry_date as string | undefined) ?? null,
          reference: (body.reference as string | undefined) ?? null,
          notes: (body.notes as string | undefined) ?? null,
          created_at: `${TODAY}T10:00:00Z`,
        }),
        priced(body.lines as LineInput[]),
      );
      backend.estimates = [created, ...backend.estimates];
      return ok(created, { status: 201 });
    }),
    http.get(orgApiPath('/estimates/:estimateId'), ({ params }) => {
      record('GET', `/estimates/${String(params.estimateId)}`);
      const failed = refusal('GET', '/estimates/id');
      if (failed) return failed;
      const found = find(params.estimateId);
      return found ? ok(found) : missing();
    }),
    http.patch(orgApiPath('/estimates/:estimateId'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('PATCH', `/estimates/${String(params.estimateId)}`, body);
      const failed = refusal('PATCH', '/estimates/id');
      if (failed) return failed;
      const found = find(params.estimateId);
      if (!found) return missing();
      if (found.status !== 'draft') {
        return fail(409, 'ESTIMATE_NOT_DRAFT', 'Only a draft estimate can be changed.');
      }
      let next: Estimate = { ...found };
      for (const key of ['job_id', 'expiry_date', 'reference', 'notes'] as const) {
        if (key in body) next = { ...next, [key]: body[key] as string | null };
      }
      if (body.lines) next = withTotals(next, priced(body.lines as LineInput[]));
      return ok(store(next));
    }),
    http.delete(orgApiPath('/estimates/:estimateId'), ({ params }) => {
      record('DELETE', `/estimates/${String(params.estimateId)}`);
      const failed = refusal('DELETE', '/estimates/id');
      if (failed) return failed;
      const found = find(params.estimateId);
      if (!found) return missing();
      if (found.status !== 'draft') {
        return fail(409, 'ESTIMATE_NOT_DRAFT', 'Only a draft estimate can be deleted.');
      }
      backend.estimates = backend.estimates.filter((estimate) => estimate.id !== found.id);
      return new HttpResponse(null, { status: 204 });
    }),
    http.post(orgApiPath('/estimates/:estimateId/send'), async ({ request, params }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      record('POST', `/estimates/${String(params.estimateId)}/send`, body);
      const failed = refusal('POST', '/estimates/send');
      if (failed) return failed;
      const found = find(params.estimateId);
      if (!found) return missing();
      if (found.status !== 'draft') {
        return fail(409, 'ESTIMATE_NOT_DRAFT', 'Only a draft estimate can be sent.');
      }
      return ok(
        store({
          ...found,
          number: 'EST-00005',
          status: 'sent',
          display_status: 'sent',
          issue_date: (body.issue_date as string | undefined) ?? TODAY,
          sent_at: `${TODAY}T10:00:00Z`,
        }),
      );
    }),
    ...(['accept', 'decline'] as const).map((action) =>
      http.post(orgApiPath(`/estimates/:estimateId/${action}`), ({ params }) => {
        record('POST', `/estimates/${String(params.estimateId)}/${action}`);
        const failed = refusal('POST', `/estimates/${action}`);
        if (failed) return failed;
        const found = find(params.estimateId);
        if (!found) return missing();
        if (found.status !== 'sent') {
          return fail(409, 'ESTIMATE_NOT_SENT', 'Only a sent estimate can be answered.');
        }
        const status = action === 'accept' ? 'accepted' : 'declined';
        return ok(
          store({
            ...found,
            status,
            display_status: status,
            responded_at: `${TODAY}T10:00:00Z`,
          }),
        );
      }),
    ),
    http.post(orgApiPath('/estimates/:estimateId/convert'), ({ params }) => {
      record('POST', `/estimates/${String(params.estimateId)}/convert`);
      const failed = refusal('POST', '/estimates/convert');
      if (failed) return failed;
      const found = find(params.estimateId);
      if (!found) return missing();
      if (found.converted_invoice_id) {
        return fail(409, 'ESTIMATE_ALREADY_CONVERTED', 'This estimate is already an invoice.');
      }
      if (!SENT_OR_ACCEPTED.has(found.status)) {
        return fail(409, 'ESTIMATE_NOT_CONVERTIBLE', 'Send the estimate before converting it.');
      }
      const estimate = store({ ...found, converted_invoice_id: 'inv-from-est' });
      return ok({ estimate, invoice_id: 'inv-from-est' });
    }),
  ];
}
