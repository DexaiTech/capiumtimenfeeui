import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  ClaimStatus,
  Disbursement,
  ExpenseClaimDetail,
  ExpenseLine,
  ExpenseType,
  Receipt,
} from '../types';
import {
  actionsFor,
  ada,
  ben,
  clients,
  claim as makeClaim,
  event,
  expensePractice,
  IDS,
  jobs,
  line as makeLine,
  receipt as makeReceipt,
  types as typeFixtures,
  vatCodes,
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
export interface ExpenseBackend {
  claims: ExpenseClaimDetail[];
  types: ExpenseType[];
  disbursements: Disbursement[];
  /** Every write (and every list request) in order, with its body or query. */
  calls: Call[];
  /** The caller is the claimant's manager (or reads everything): may approve and return. */
  canDecide: boolean;
  /** The caller holds `expense.manage`. */
  canManage: boolean;
  /** The id of the signed-in person. */
  userId: string;
  /** The receipt the next upload stores (jsdom does not carry the file name). */
  nextUpload: { file_name: string; content_type: string; size_bytes: number };
  /** The `Authorization` header of each receipt download. */
  fileRequests: Array<{ receiptId: string; authorization: string | null }>;
  /** Rows per page of the lists (everything when 0). */
  pageSize: number;
}

export function createBackend(initial: Partial<ExpenseBackend> = {}): ExpenseBackend {
  return {
    claims: [],
    types: structuredClone(typeFixtures),
    disbursements: [],
    calls: [],
    canDecide: false,
    canManage: false,
    userId: ada.id,
    nextUpload: { file_name: 'receipt.png', content_type: 'image/png', size_bytes: 69 },
    fileRequests: [],
    pageSize: 0,
    ...initial,
  };
}

const flag = (value: string | null): boolean | null => (value === null ? null : value === 'true');

function pageOf<T>(rows: T[], params: URLSearchParams, size: number) {
  if (!size) return { rows, meta: END };
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const halfUp = (numerator: number, denominator: number) =>
  Math.floor((numerator * 2 + denominator) / (denominator * 2));

/** Re-derives what the API derives from a claim's lines: totals, period, count and actions. */
export function refresh(backend: ExpenseBackend, target: ExpenseClaimDetail): ExpenseClaimDetail {
  const dates = target.lines.map((entry) => entry.incurred_on).sort();
  const sum = (pick: (entry: ExpenseLine) => number) =>
    target.lines.reduce((total, entry) => total + pick(entry), 0);
  target.line_count = target.lines.length;
  target.first_date = dates[0] ?? null;
  target.last_date = dates[dates.length - 1] ?? null;
  target.totals = {
    net: sum((entry) => entry.net),
    vat: sum((entry) => entry.vat),
    gross: sum((entry) => entry.gross),
    recharge: sum((entry) => entry.recharge_amount),
    reimbursable: sum((entry) => (entry.payer === 'staff' ? entry.gross : 0)),
  };
  target.actions = actionsFor(target.status, {
    canDecide: backend.canDecide && target.user_id !== backend.userId,
    canManage: backend.canManage,
  });
  for (const entry of target.lines) {
    entry.receipt_count = entry.receipts.length;
    entry.receipt_required =
      entry.miles === null && entry.gross > expensePractice.receipt_required_threshold;
  }
  return target;
}

const summary = (item: ExpenseClaimDetail): Partial<ExpenseClaimDetail> => {
  const copy: Partial<ExpenseClaimDetail> = { ...item };
  delete copy.lines;
  delete copy.events;
  return copy;
};

const text = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

/** The line the API stores for a request body (the sums as the API does them, minimal). */
function buildLine(
  backend: ExpenseBackend,
  body: Record<string, unknown>,
  id: string,
): ExpenseLine {
  const type = backend.types.find((entry) => entry.id === body.expense_type_id) ?? typeFixtures[0];
  const vatCode = vatCodes.find(
    (code) => code.id === (body.vat_rate_id ?? type?.default_vat_rate_id),
  );
  const rate = vatCode?.rate_bp ?? 0;
  const client = clients.find((entry) => entry.id === body.client_id) ?? null;
  const job = jobs.find((entry) => entry.id === body.job_id) ?? null;
  let net = typeof body.net === 'number' ? body.net : null;
  let vat = typeof body.vat === 'number' ? body.vat : null;
  const gross = typeof body.gross === 'number' ? body.gross : null;
  const miles = body.miles === undefined ? null : Number(body.miles);
  let rateApplied: number | null = null;
  if (type?.is_mileage && miles !== null) {
    rateApplied = expensePractice.mileage_rate;
    net = halfUp(Math.round(miles * 100) * rateApplied, 100);
  }
  if (net === null && gross !== null) {
    vat = vat ?? halfUp(gross * rate, 10_000 + rate);
    net = gross - vat;
  }
  net ??= 0;
  vat ??= halfUp(net * rate, 10_000);
  const billable = Boolean(body.is_billable) && client !== null;
  return makeLine({
    id,
    expense_type_id: type?.id ?? IDS.travel,
    expense_type: {
      id: type?.id ?? IDS.travel,
      name: type?.name ?? 'Travel',
      code: type?.code ?? 'TRAVEL',
      is_mileage: type?.is_mileage ?? false,
    },
    incurred_on: text(body.incurred_on, '2026-09-07'),
    description: text(body.description),
    client_id: client?.id ?? null,
    client,
    job_id: job?.id ?? null,
    job: job
      ? { id: job.id, number: job.number, name: job.name, billing_basis: job.billing_basis }
      : null,
    supplier: typeof body.supplier === 'string' ? body.supplier : null,
    vat_rate_id: vatCode?.id ?? null,
    vat_rate_bp: vatCode ? rate : null,
    net,
    vat,
    gross: net + vat,
    miles: miles === null ? null : miles.toFixed(2),
    mileage_rate_applied: rateApplied,
    is_billable: billable,
    markup_bp: expensePractice.expense_markup_bp,
    recharge_amount: billable
      ? typeof body.recharge_amount === 'number'
        ? body.recharge_amount
        : halfUp(net * (10_000 + expensePractice.expense_markup_bp), 10_000)
      : 0,
    payer: body.payer === 'practice' ? 'practice' : 'staff',
    receipts: [],
  });
}

const refusal = {
  notFound: () => fail(404, 'RESOURCE_NOT_FOUND', 'Expense claim not found.'),
  locked: (status: ClaimStatus) =>
    fail(409, 'EXPENSE_CLAIM_LOCKED', `The claim is ${status} and cannot be changed.`, {
      details: { status },
    }),
};

/**
 * The expense endpoints (and the lookups the pickers use) over an in-memory `backend`: the real
 * envelope shapes, the filters the pages send, and the rules the pages meet (receipts required
 * to submit, a reason to return or correct, a type in use cannot be deleted).
 */
export function expenseHandlers(backend: ExpenseBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown, params?: URLSearchParams) => {
    backend.calls.push({ method, path, body, params });
  };
  const find = (id: unknown) => backend.claims.find((entry) => entry.id === id);
  const findLine = (target: ExpenseClaimDetail, lineId: unknown) =>
    target.lines.find((entry) => entry.id === lineId);
  const allLines = () =>
    backend.claims.flatMap((owner) => owner.lines.map((entry) => ({ owner, entry })));
  let serial = 0;
  const newId = (prefix: string) => {
    serial += 1;
    return `0198c1f2-${prefix}-7000-8000-${String(serial).padStart(12, '1')}`;
  };

  const claimQuery = (params: URLSearchParams): ExpenseClaimDetail[] => {
    const statuses = params.getAll('status');
    const q = params.get('q')?.toLowerCase();
    const billable = flag(params.get('is_billable'));
    const from = params.get('date_from');
    const to = params.get('date_to');
    const lineFilters =
      billable !== null || params.has('client_id') || Boolean(from) || Boolean(to);
    // The same line must satisfy every line filter, as the API does it.
    const matchesLine = (item: ExpenseClaimDetail) =>
      item.lines.some(
        (entry) =>
          (billable === null || entry.is_billable === billable) &&
          (!params.get('client_id') || entry.client_id === params.get('client_id')) &&
          (!from || entry.incurred_on >= from) &&
          (!to || entry.incurred_on <= to),
      );
    const rows = backend.claims.filter(
      (item) =>
        (params.get('mine') !== 'true' || item.user_id === backend.userId) &&
        (statuses.length === 0 || statuses.includes(item.status)) &&
        (!params.get('user_id') || item.user_id === params.get('user_id')) &&
        (!q ||
          (item.title ?? '').toLowerCase().includes(q) ||
          (item.user_name ?? '').toLowerCase().includes(q)) &&
        (!lineFilters || matchesLine(item)),
    );
    const sort = params.get('sort') ?? 'created_at';
    const factor = (params.get('order') ?? (sort === 'user' ? 'asc' : 'desc')) === 'asc' ? 1 : -1;
    const key = (item: ExpenseClaimDetail) =>
      sort === 'total'
        ? item.totals.gross
        : sort === 'user'
          ? (item.user_name ?? '')
          : sort === 'submitted_at'
            ? (item.submitted_at ?? '')
            : item.created_at;
    return [...rows].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * factor);
  };

  return [
    /* ---------------------------------- Lookups --------------------------------- */
    http.get(orgApiPath('/vat-rates'), () => ok(vatCodes)),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
      return ok(
        clients.filter((entry) => !q || entry.name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = clients.find((entry) => entry.id === params.clientId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    http.get(orgApiPath('/jobs'), ({ request }) => {
      const search = new URL(request.url).searchParams;
      return ok(
        jobs.filter(
          (entry) => !search.get('client_id') || entry.client_id === search.get('client_id'),
        ),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/jobs/:jobId'), ({ params }) => {
      const found = jobs.find((entry) => entry.id === params.jobId);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Job not found.');
    }),
    http.get(orgApiPath('/staff'), () =>
      ok(
        [ada, ben].map((person) => ({
          id: person.id,
          code: person.name.slice(0, 3).toUpperCase(),
          full_name: person.name,
          email: null,
          has_login: true,
          status: 'active',
          is_selectable: true,
        })),
        { meta: END },
      ),
    ),

    /* ----------------------------------- Types ---------------------------------- */
    http.get(orgApiPath('/expense-types'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/expense-types', undefined, params);
      const active = flag(params.get('is_active'));
      const q = params.get('q')?.toLowerCase();
      const rows = backend.types.filter(
        (entry) =>
          (active === null || entry.is_active === active) &&
          (!q || entry.name.toLowerCase().includes(q) || entry.code.toLowerCase().includes(q)),
      );
      const sort = params.get('sort') === 'code' ? 'code' : 'name';
      const factor = params.get('order') === 'desc' ? -1 : 1;
      rows.sort((a, b) => a[sort].localeCompare(b[sort]) * factor);
      const result = pageOf(rows, params, backend.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.post(orgApiPath('/expense-types'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/expense-types', body);
      const taken = backend.types.find(
        (entry) => entry.is_active && entry.name.toLowerCase() === text(body.name).toLowerCase(),
      );
      if (taken) {
        return fail(409, 'EXPENSE_TYPE_NAME_TAKEN', 'An expense type with that name exists.', {
          details: [{ field: 'name', code: 'duplicate', message: 'That name is taken.' }],
        });
      }
      const created: ExpenseType = {
        id: newId('0f01'),
        name: text(body.name),
        code: text(body.code),
        default_vat_rate_id: (body.default_vat_rate_id as string | undefined) ?? null,
        is_mileage: Boolean(body.is_mileage),
        default_billable: Boolean(body.default_billable),
        is_active: body.is_active !== false,
        is_used: false,
        can_delete: true,
        created_at: '2026-10-18T09:00:00Z',
        updated_at: '2026-10-18T09:00:00Z',
      };
      backend.types.push(created);
      return ok(created, { status: 201, message: 'Expense type created' });
    }),
    http.patch(orgApiPath('/expense-types/:typeId'), async ({ request, params }) => {
      const body = (await request.json()) as Partial<ExpenseType>;
      record('PATCH', `/expense-types/${String(params.typeId)}`, body);
      const found = backend.types.find((entry) => entry.id === params.typeId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Expense type not found.');
      Object.assign(found, body);
      return ok(found);
    }),
    http.delete(orgApiPath('/expense-types/:typeId'), ({ params }) => {
      record('DELETE', `/expense-types/${String(params.typeId)}`);
      const found = backend.types.find((entry) => entry.id === params.typeId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Expense type not found.');
      if (found.is_used) {
        return fail(409, 'EXPENSE_TYPE_IN_USE', 'Expenses use this type: deactivate it instead.', {
          details: { expense_type_id: found.id, is_active: found.is_active },
        });
      }
      backend.types = backend.types.filter((entry) => entry.id !== found.id);
      return ok(null, { message: 'Expense type deleted' });
    }),

    /* ----------------------------------- Claims --------------------------------- */
    http.get(orgApiPath('/expense-claims/summary'), () => {
      const count = (status: ClaimStatus) =>
        backend.claims.filter((entry) => entry.status === status).length;
      const waiting = backend.claims.filter(
        (entry) => entry.status === 'submitted' && entry.user_id !== backend.userId,
      );
      return ok({
        counts: {
          draft: count('draft'),
          submitted: count('submitted'),
          approved: count('approved'),
          returned: count('returned'),
          total: backend.claims.length,
        },
        pending_gross: backend.claims
          .filter((entry) => entry.status === 'submitted')
          .reduce((total, entry) => total + entry.totals.gross, 0),
        awaiting_my_approval: {
          count: backend.canDecide ? waiting.length : 0,
          gross: backend.canDecide
            ? waiting.reduce((total, entry) => total + entry.totals.gross, 0)
            : 0,
        },
      });
    }),
    http.get(orgApiPath('/expense-claims'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/expense-claims', undefined, params);
      const result = pageOf(
        claimQuery(params).map((item) => summary(refresh(backend, item))),
        params,
        backend.pageSize,
      );
      return ok(result.rows, { meta: result.meta });
    }),
    http.post(orgApiPath('/expense-claims'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/expense-claims', body);
      const created = refresh(
        backend,
        makeClaim({
          id: newId('0d02'),
          title: (body.title as string | undefined) ?? null,
          user_id: (body.user_id as string | undefined) ?? backend.userId,
          user_name: body.user_id === ben.id ? ben.name : ada.name,
          created_by: backend.userId,
          created_by_name: ada.name,
          status: 'draft',
          created_at: '2026-10-18T09:00:00Z',
        }),
      );
      backend.claims.push(created);
      return ok(created, { status: 201, message: 'Expense claim created' });
    }),
    http.get(orgApiPath('/expense-claims/:claimId'), ({ params }) => {
      const found = find(params.claimId);
      return found ? ok(refresh(backend, found)) : refusal.notFound();
    }),
    http.patch(orgApiPath('/expense-claims/:claimId'), async ({ request, params }) => {
      const body = (await request.json()) as { title: string | null };
      record('PATCH', `/expense-claims/${String(params.claimId)}`, body);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      found.title = body.title;
      return ok(refresh(backend, found));
    }),
    http.delete(orgApiPath('/expense-claims/:claimId'), ({ params }) => {
      record('DELETE', `/expense-claims/${String(params.claimId)}`);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      if (found.status !== 'draft') return refusal.locked(found.status);
      backend.claims = backend.claims.filter((entry) => entry.id !== found.id);
      return ok(null, { message: 'Expense claim deleted' });
    }),

    /* ----------------------------------- Lines ---------------------------------- */
    http.post(orgApiPath('/expense-claims/:claimId/lines'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/expense-claims/${String(params.claimId)}/lines`, body);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      if (!found.actions.can_edit) return refusal.locked(found.status);
      const created = buildLine(backend, body, newId('0b02'));
      created.claim_id = found.id;
      found.lines.push(created);
      refresh(backend, found);
      return ok(created, { status: 201, message: 'Expense added' });
    }),
    http.patch(
      orgApiPath('/expense-claims/:claimId/lines/:lineId'),
      async ({ request, params }) => {
        const body = (await request.json()) as Record<string, unknown>;
        record(
          'PATCH',
          `/expense-claims/${String(params.claimId)}/lines/${String(params.lineId)}`,
          body,
        );
        const found = find(params.claimId);
        const target = found ? findLine(found, params.lineId) : undefined;
        if (!found || !target) return refusal.notFound();
        const correcting = found.status === 'approved';
        if (!correcting && !found.actions.can_edit) return refusal.locked(found.status);
        if (correcting && !body.reason) {
          return fail(422, 'EXPENSE_CORRECTION_REASON_REQUIRED', 'Say why you are correcting it.', {
            details: [{ field: 'reason', code: 'required', message: 'A reason is required.' }],
          });
        }
        const { reason, ...fields } = body;
        const merged = buildLine(
          backend,
          {
            expense_type_id: target.expense_type_id,
            incurred_on: target.incurred_on,
            description: target.description,
            client_id: target.client_id,
            job_id: target.job_id,
            supplier: target.supplier,
            vat_rate_id: target.vat_rate_id,
            net: target.net,
            is_billable: target.is_billable,
            payer: target.payer,
            ...fields,
          },
          target.id,
        );
        Object.assign(target, { ...merged, receipts: target.receipts, claim_id: found.id });
        if (correcting) {
          found.events.push(
            event({
              id: newId('0c02'),
              action: 'corrected',
              note: String(reason),
              created_at: '2026-10-18T09:00:00Z',
            }),
          );
        }
        refresh(backend, found);
        return ok(target, { message: 'Expense updated' });
      },
    ),
    http.delete(orgApiPath('/expense-claims/:claimId/lines/:lineId'), ({ params }) => {
      record('DELETE', `/expense-claims/${String(params.claimId)}/lines/${String(params.lineId)}`);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      if (!found.actions.can_edit) return refusal.locked(found.status);
      found.lines = found.lines.filter((entry) => entry.id !== params.lineId);
      refresh(backend, found);
      return ok(null, { message: 'Expense deleted' });
    }),
    http.get(orgApiPath('/expenses'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/expenses', undefined, params);
      const statuses = params.getAll('status');
      const rows = allLines()
        .filter(
          ({ owner, entry }) =>
            (statuses.length === 0 || statuses.includes(owner.status)) &&
            (params.get('needs_receipt') !== 'true' ||
              (entry.receipt_required && entry.receipt_count === 0)),
        )
        .map(({ owner, entry }) => ({
          ...entry,
          claim_status: owner.status,
          claim_title: owner.title,
          user_id: owner.user_id,
          user_name: owner.user_name,
        }));
      const result = pageOf(rows, params, backend.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),

    /* ---------------------------------- Workflow -------------------------------- */
    http.post(orgApiPath('/expense-claims/:claimId/submit'), ({ params }) => {
      record('POST', `/expense-claims/${String(params.claimId)}/submit`);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      if (!found.actions.can_submit) {
        return fail(409, 'INVALID_STATUS_TRANSITION', 'The claim cannot be submitted now.', {
          details: { from: found.status, to: 'submitted' },
        });
      }
      if (found.lines.length === 0) {
        return fail(422, 'EXPENSE_CLAIM_EMPTY', 'Add at least one expense first.', {
          details: [{ field: 'lines', code: 'empty', message: 'Add at least one expense.' }],
        });
      }
      refresh(backend, found);
      const missing = found.lines.filter(
        (entry) => entry.receipt_required && entry.receipt_count === 0,
      );
      if (missing.length > 0) {
        return fail(422, 'RECEIPT_REQUIRED', 'Some expenses need a receipt.', {
          details: missing.map((entry) => ({
            field: 'lines',
            code: 'receipt_required',
            message: `${entry.description} needs a receipt.`,
            line_id: entry.id,
          })),
        });
      }
      found.status = 'submitted';
      found.submitted_at = '2026-10-18T09:30:00Z';
      found.decision_note = null;
      found.events.push(
        event({ id: newId('0c02'), action: 'submitted', created_at: '2026-10-18T09:30:00Z' }),
      );
      return ok(refresh(backend, found), { message: 'Expense claim submitted' });
    }),
    http.post(orgApiPath('/expense-claims/:claimId/recall'), ({ params }) => {
      record('POST', `/expense-claims/${String(params.claimId)}/recall`);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      found.status = 'draft';
      found.submitted_at = null;
      found.events.push(event({ id: newId('0c02'), action: 'recalled' }));
      return ok(refresh(backend, found), { message: 'Expense claim recalled' });
    }),
    http.post(orgApiPath('/expense-claims/:claimId/approve'), async ({ request, params }) => {
      const body = (await request.json().catch(() => null)) as { note?: string } | null;
      record('POST', `/expense-claims/${String(params.claimId)}/approve`, body ?? undefined);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      found.status = 'approved';
      found.decided_by = ben.id;
      found.decided_by_name = ben.name;
      found.decided_at = '2026-10-18T10:00:00Z';
      found.decision_note = body?.note ?? null;
      found.events.push(
        event({
          id: newId('0c02'),
          action: 'approved',
          actor_name: ben.name,
          note: body?.note ?? null,
        }),
      );
      return ok(refresh(backend, found), { message: 'Expense claim approved' });
    }),
    http.post(orgApiPath('/expense-claims/:claimId/return'), async ({ request, params }) => {
      const body = (await request.json().catch(() => null)) as { reason?: string } | null;
      record('POST', `/expense-claims/${String(params.claimId)}/return`, body ?? undefined);
      const found = find(params.claimId);
      if (!found) return refusal.notFound();
      if (!body?.reason?.trim()) {
        return fail(
          422,
          'EXPENSE_RETURN_REASON_REQUIRED',
          'A reason is required to return a claim.',
          {
            details: [{ field: 'reason', code: 'required', message: 'Say why it is returned.' }],
          },
        );
      }
      found.status = 'returned';
      found.decided_by = ben.id;
      found.decided_by_name = ben.name;
      found.decided_at = '2026-10-18T10:00:00Z';
      found.decision_note = body.reason;
      found.events.push(
        event({ id: newId('0c02'), action: 'returned', actor_name: ben.name, note: body.reason }),
      );
      return ok(refresh(backend, found), { message: 'Expense claim returned' });
    }),
    http.get(orgApiPath('/expense-approvals'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/expense-approvals', undefined, params);
      const q = params.get('q')?.toLowerCase();
      const rows = backend.claims
        .filter(
          (item) =>
            item.status === 'submitted' &&
            item.user_id !== backend.userId &&
            (!params.get('user_id') || item.user_id === params.get('user_id')) &&
            (!q ||
              (item.title ?? '').toLowerCase().includes(q) ||
              (item.user_name ?? '').toLowerCase().includes(q)),
        )
        .sort((a, b) => (a.submitted_at ?? '').localeCompare(b.submitted_at ?? ''))
        .map((item) => summary(refresh(backend, item)));
      const result = pageOf(rows, params, backend.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.post(orgApiPath('/expense-approvals/bulk-approve'), async ({ request }) => {
      const body = (await request.json()) as { claim_ids: string[] };
      record('POST', '/expense-approvals/bulk-approve', body);
      const chosen = body.claim_ids.map((id) => find(id));
      if (chosen.some((entry) => entry === undefined)) return refusal.notFound();
      for (const entry of chosen) {
        if (entry) {
          entry.status = 'approved';
          entry.decided_by_name = ben.name;
        }
      }
      return ok(
        chosen.flatMap((entry) => (entry ? [summary(refresh(backend, entry))] : [])),
        { message: `${String(chosen.length)} expense claims approved` },
      );
    }),

    /* ---------------------------------- Receipts -------------------------------- */
    http.get(orgApiPath('/expense-receipts'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/expense-receipts', undefined, params);
      const statuses = params.getAll('status');
      const q = params.get('q')?.toLowerCase();
      const rows = allLines()
        .filter(({ owner }) => statuses.length === 0 || statuses.includes(owner.status))
        .flatMap(({ owner, entry }) =>
          entry.receipts
            .filter((item) => !q || item.file_name.toLowerCase().includes(q))
            .map((item) => ({
              ...item,
              claim_id: owner.id,
              claim_status: owner.status,
              claim_title: owner.title,
              user_id: owner.user_id,
              user_name: owner.user_name,
              description: entry.description,
              incurred_on: entry.incurred_on,
              gross: entry.gross,
              client: entry.client,
            })),
        );
      const result = pageOf(rows, params, backend.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.post(orgApiPath('/expenses/:lineId/receipts'), ({ params }) => {
      record('POST', `/expenses/${String(params.lineId)}/receipts`);
      const target = allLines().find(({ entry }) => entry.id === params.lineId);
      if (!target) return fail(404, 'RESOURCE_NOT_FOUND', 'Expense not found.');
      const stored: Receipt = makeReceipt({
        id: newId('0a02'),
        expense_id: target.entry.id,
        is_image: backend.nextUpload.content_type.startsWith('image/'),
        ...backend.nextUpload,
      });
      target.entry.receipts.push(stored);
      refresh(backend, target.owner);
      return ok(stored, { status: 201, message: 'Receipt uploaded' });
    }),
    http.get(orgApiPath('/expenses/:lineId/receipts/:receiptId'), ({ request, params }) => {
      backend.fileRequests.push({
        receiptId: String(params.receiptId),
        authorization: request.headers.get('Authorization'),
      });
      const found = allLines()
        .flatMap(({ entry }) => entry.receipts)
        .find((item) => item.id === params.receiptId);
      if (!found)
        return fail(404, 'RECEIPT_FILE_MISSING', 'The receipt file is no longer in storage.');
      return new HttpResponse(new Uint8Array([137, 80, 78, 71]), {
        headers: { 'Content-Type': found.content_type },
      });
    }),
    http.delete(orgApiPath('/expenses/:lineId/receipts/:receiptId'), ({ params }) => {
      record('DELETE', `/expenses/${String(params.lineId)}/receipts/${String(params.receiptId)}`);
      const target = allLines().find(({ entry }) => entry.id === params.lineId);
      if (!target) return fail(404, 'RESOURCE_NOT_FOUND', 'Expense not found.');
      target.entry.receipts = target.entry.receipts.filter((item) => item.id !== params.receiptId);
      refresh(backend, target.owner);
      return ok(null, { message: 'Receipt deleted' });
    }),

    /* ------------------------------- Disbursements ------------------------------ */
    http.get(orgApiPath('/disbursements'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      record('GET', '/disbursements', undefined, params);
      const statuses = params.getAll('billing_status');
      const billable = flag(params.get('is_billable'));
      const rows = backend.disbursements
        .filter(
          (entry) =>
            (statuses.length === 0 || statuses.includes(entry.billing_status)) &&
            (billable === null || entry.is_billable === billable) &&
            (!params.get('client_id') || entry.client_id === params.get('client_id')),
        )
        .sort((a, b) => b.incurred_on.localeCompare(a.incurred_on));
      const result = pageOf(rows, params, backend.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.post(orgApiPath('/disbursements'), async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', '/disbursements', body);
      const created: Disbursement = {
        id: newId('0e02'),
        client_id: text(body.client_id),
        job_id: (body.job_id as string | undefined) ?? null,
        incurred_on: text(body.incurred_on),
        description: text(body.description),
        supplier: (body.supplier as string | undefined) ?? null,
        amount: Number(body.amount),
        vat_rate_id: (body.vat_rate_id as string | undefined) ?? null,
        is_billable: body.is_billable !== false,
        billing_status: 'unbilled',
        created_by: backend.userId,
        created_at: '2026-10-18T09:00:00Z',
      };
      backend.disbursements.push(created);
      return ok(created, { status: 201 });
    }),
    http.patch(orgApiPath('/disbursements/:id'), async ({ request, params }) => {
      const body = (await request.json()) as Partial<Disbursement>;
      record('PATCH', `/disbursements/${String(params.id)}`, body);
      const found = backend.disbursements.find((entry) => entry.id === params.id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Disbursement not found.');
      if (found.billing_status !== 'unbilled') {
        return fail(409, 'DISBURSEMENT_LOCKED', 'A disbursement that is billed cannot be changed.');
      }
      Object.assign(found, body);
      return ok(found);
    }),
    http.delete(orgApiPath('/disbursements/:id'), ({ params }) => {
      record('DELETE', `/disbursements/${String(params.id)}`);
      const found = backend.disbursements.find((entry) => entry.id === params.id);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Disbursement not found.');
      if (found.billing_status !== 'unbilled') {
        return fail(409, 'DISBURSEMENT_LOCKED', 'A disbursement that is billed cannot be deleted.');
      }
      backend.disbursements = backend.disbursements.filter((entry) => entry.id !== found.id);
      return ok(null, { message: 'Disbursement deleted' });
    }),
  ];
}
