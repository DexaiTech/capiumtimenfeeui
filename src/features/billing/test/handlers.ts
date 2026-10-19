import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  DebtorInvoice,
  DebtorRow,
  ReminderLogEntry,
  ReminderPreview,
  ReminderResult,
  Statement,
  StatementRow,
} from '../types';
import {
  clients,
  debtorTotals,
  emailsOf,
  statementTotals,
  statement as statementFixture,
} from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };
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
}

/** The stand-in for the API: what the tests read and change, and what the pages asked for. */
export interface BillingBackend {
  debtors: DebtorRow[];
  /** A client's open invoices, by client id. */
  debtorInvoices: Record<string, DebtorInvoice[]>;
  reminders: ReminderLogEntry[];
  statements: StatementRow[];
  /** The statement of a client, by client id (an empty one when missing). */
  statementOf: Record<string, Statement>;
  calls: Call[];
  /** Rows per page of the lists (everything when 0). */
  pageSize: number;
  nextId: number;
  /** Answers a route with an error: key `'POST /debtors/reminders'`. */
  refusals: Record<string, Refusal>;
}

export function createBackend(initial: Partial<BillingBackend> = {}): BillingBackend {
  return {
    debtors: [],
    debtorInvoices: {},
    reminders: [],
    statements: [],
    statementOf: {},
    calls: [],
    pageSize: 0,
    nextId: 0,
    refusals: {},
    ...initial,
  };
}

export const callsOf = (backend: BillingBackend, method: string) =>
  backend.calls.filter((call) => call.method === method);

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

/** Handlers for the debtors and the statements, and the client lookups their pickers use. */
export function billingHandlers(backend: BillingBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message) : null;
  };
  const id = (prefix: string) => {
    backend.nextId += 1;
    return `${prefix}-new-${String(backend.nextId)}`;
  };

  /** What the reminder emails would be, for the invoices that are overdue and have an address. */
  const remindersFor = (body: Record<string, unknown>): ReminderResult => {
    const wantedClients = new Set((body.client_ids as string[] | undefined) ?? []);
    const wantedInvoices = new Set((body.invoice_ids as string[] | undefined) ?? []);
    const template =
      (body.template as ReminderResult['template'] | undefined) ?? 'client_payment_reminder';
    const result: ReminderResult = {
      dry_run: body.dry_run === true,
      template,
      emails_queued: 0,
      invoices_queued: 0,
      clients: [],
      skipped: [],
    };
    for (const [clientId, invoices] of Object.entries(backend.debtorInvoices)) {
      const client = clients.find((entry) => entry.id === clientId);
      if (!client) continue;
      const picked = invoices.filter((invoice) =>
        wantedInvoices.size > 0 ? wantedInvoices.has(invoice.id) : wantedClients.has(clientId),
      );
      const due = picked.filter((invoice) => invoice.days_overdue > 0);
      for (const invoice of picked) {
        if (invoice.days_overdue === 0) {
          result.skipped.push({
            invoice_id: invoice.id,
            number: invoice.number,
            client_id: clientId,
            reason: 'not_overdue',
          });
        }
      }
      const to = emailsOf[clientId] ?? [];
      if (due.length === 0) continue;
      if (to.length === 0) {
        for (const invoice of due) {
          result.skipped.push({
            invoice_id: invoice.id,
            number: invoice.number,
            client_id: clientId,
            reason: 'no_recipient',
          });
        }
        continue;
      }
      const preview: ReminderPreview = {
        client,
        to,
        subject: 'Payment reminder from Acme Accountants',
        text: `Dear ${client.name},\n\nOur records show that ${String(due.length)} invoice(s) are overdue.`,
        total_due: due.reduce((sum, invoice) => sum + invoice.outstanding, 0),
        invoices: due.map((invoice) => ({
          invoice_id: invoice.id,
          number: invoice.number,
          due_date: invoice.due_date ?? TODAY,
          days_overdue: invoice.days_overdue,
          outstanding: invoice.outstanding,
        })),
      };
      result.clients.push(preview);
    }
    if (!result.dry_run) {
      result.emails_queued = result.clients.length;
      result.invoices_queued = result.clients.reduce(
        (sum, email) => sum + email.invoices.length,
        0,
      );
    }
    return result;
  };

  return [
    /* ------------------------------ Lookups ------------------------------ */
    http.get(orgApiPath('/clients/:clientId/statement/pdf'), ({ request, params }) => {
      const query = new URL(request.url).searchParams;
      record('GET', `/clients/${String(params.clientId)}/statement/pdf`, undefined, query);
      const failed = refusal('GET', '/clients/statement/pdf');
      if (failed) return failed;
      return new HttpResponse('%PDF-1.4 statement', {
        headers: { 'Content-Type': 'application/pdf' },
      });
    }),
    http.get(orgApiPath('/clients/:clientId/statement'), ({ request, params }) => {
      const query = new URL(request.url).searchParams;
      record('GET', `/clients/${String(params.clientId)}/statement`, undefined, query);
      const failed = refusal('GET', '/clients/statement');
      if (failed) return failed;
      const found = backend.statementOf[String(params.clientId)];
      const client = clients.find((entry) => entry.id === params.clientId);
      if (!client) return fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
      const base =
        found ??
        statementFixture({
          client,
          entries: [],
          invoiced: 0,
          paid: 0,
          closing_balance: 0,
        });
      return ok({
        ...base,
        date_from: query.get('date_from') ?? null,
        date_to: query.get('date_to') ?? TODAY,
      });
    }),
    http.post(orgApiPath('/clients/:clientId/statement/send'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      const clientId = String(params.clientId);
      record('POST', `/clients/${clientId}/statement/send`, body);
      const failed = refusal('POST', '/clients/statement/send');
      if (failed) return failed;
      const to = (body.to as string[] | undefined) ?? emailsOf[clientId] ?? [];
      if (to.length === 0) {
        return fail(422, 'NO_RECIPIENT', 'There is no email address to send the statement to.');
      }
      const row = backend.statements.find((entry) => entry.client.id === clientId);
      return ok(
        {
          id: id('st'),
          client_id: clientId,
          to,
          date_from: (body.date_from as string | undefined) ?? null,
          date_to: (body.date_to as string | undefined) ?? TODAY,
          closing_balance: row?.balance ?? 0,
          queued: true,
        },
        { status: 202 },
      );
    }),
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

    /* ------------------------------- Debtors ------------------------------- */
    http.get(orgApiPath('/debtors/reminders'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/debtors/reminders', undefined, params);
      const failed = refusal('GET', '/debtors/reminders');
      if (failed) return failed;
      const rows = backend.reminders.filter(
        (entry) =>
          (!params.get('status') || entry.status === params.get('status')) &&
          (!params.get('source') || entry.source === params.get('source')) &&
          (!params.get('client_id') || entry.client.id === params.get('client_id')),
      );
      const page = pageOf(rows, params, backend.pageSize);
      return ok(page.rows, { meta: page.meta });
    }),
    http.post(orgApiPath('/debtors/reminders'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/debtors/reminders', body);
      const failed = refusal('POST', '/debtors/reminders');
      if (failed) return failed;
      const result = remindersFor(body);
      if (!result.dry_run) {
        for (const email of result.clients) {
          for (const invoice of email.invoices) {
            backend.reminders.unshift({
              id: id('rem'),
              client: email.client,
              invoice: { id: invoice.invoice_id, number: invoice.number },
              template: result.template,
              source: 'manual',
              status: 'queued',
              sent_on: TODAY,
              to: email.to,
              days_overdue: invoice.days_overdue,
              amount_due: invoice.outstanding,
              sent_by: { user_id: 'u-ada', full_name: 'Ada Lovelace' },
              sent_at: null,
              error: null,
              created_at: `${TODAY}T10:00:00Z`,
            });
          }
        }
      }
      return ok(result, { status: result.dry_run ? 200 : 202 });
    }),
    http.get(orgApiPath('/debtors/:clientId/invoices'), ({ request, params }) => {
      const query = new URL(request.url).searchParams;
      record('GET', `/debtors/${String(params.clientId)}/invoices`, undefined, query);
      const failed = refusal('GET', '/debtors/invoices');
      if (failed) return failed;
      const client = clients.find((entry) => entry.id === params.clientId);
      if (!client) return fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
      const invoices = backend.debtorInvoices[client.id] ?? [];
      const row = backend.debtors.find((entry) => entry.client.id === client.id);
      return ok({
        client,
        as_at: query.get('as_at') ?? TODAY,
        totals: {
          current: row?.current ?? 0,
          days_1_30: row?.days_1_30 ?? 0,
          days_31_60: row?.days_31_60 ?? 0,
          days_61_90: row?.days_61_90 ?? 0,
          days_90_plus: row?.days_90_plus ?? 0,
          total: invoices.reduce((sum, invoice) => sum + invoice.outstanding, 0),
        },
        invoices,
      });
    }),
    http.get(orgApiPath('/debtors'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/debtors', undefined, params);
      const failed = refusal('GET', '/debtors');
      if (failed) return failed;
      const min = Number(params.get('min_balance') ?? 0);
      const rows = backend.debtors.filter(
        (row) =>
          (!params.get('client_id') || row.client.id === params.get('client_id')) &&
          row.total >= min,
      );
      const sort = params.get('sort') ?? 'client';
      const accessor: Record<string, (row: DebtorRow) => string | number | null> = {
        client: (row) => row.client.name,
        total: (row) => row.total,
        current: (row) => row.current,
        days_1_30: (row) => row.days_1_30,
        days_31_60: (row) => row.days_31_60,
        days_61_90: (row) => row.days_61_90,
        days_90_plus: (row) => row.days_90_plus,
        oldest_due: (row) => row.oldest_due_date,
      };
      const ordered = sorted(
        rows,
        accessor[sort] ?? accessor.client ?? ((row) => row.client.name),
        params.get('order') ?? (sort === 'client' ? 'asc' : 'desc'),
      );
      const page = pageOf(ordered, params, backend.pageSize);
      return ok(
        {
          as_at: params.get('as_at') ?? TODAY,
          currency: 'GBP',
          totals: debtorTotals(rows),
          rows: page.rows,
        },
        { meta: page.meta },
      );
    }),

    /* ------------------------------ Statements ------------------------------ */
    http.get(orgApiPath('/statements'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/statements', undefined, params);
      const failed = refusal('GET', '/statements');
      if (failed) return failed;
      const q = params.get('q')?.toLowerCase();
      const rows = backend.statements.filter(
        (row) =>
          (!q || `${row.client.name} ${row.client.code}`.toLowerCase().includes(q)) &&
          (!params.get('client_id') || row.client.id === params.get('client_id')) &&
          (params.get('overdue_only') !== 'true' || row.overdue > 0) &&
          (params.get('never_sent') !== 'true' || row.last_statement_sent_at === null),
      );
      const sort = params.get('sort') ?? 'client';
      const accessor: Record<string, (row: StatementRow) => string | number | null> = {
        client: (row) => row.client.name,
        balance: (row) => row.balance,
        overdue: (row) => row.overdue,
        last_sent: (row) => row.last_statement_sent_at,
      };
      const ordered = sorted(
        rows,
        accessor[sort] ?? accessor.client ?? ((row) => row.client.name),
        params.get('order') ?? (sort === 'client' ? 'asc' : 'desc'),
      );
      const page = pageOf(ordered, params, backend.pageSize);
      return ok({ totals: statementTotals(rows), rows: page.rows }, { meta: page.meta });
    }),
  ];
}
