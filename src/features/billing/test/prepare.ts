import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  Breakdown,
  ClientBillingSummary,
  ClientWip,
  InvoiceCreate,
  InvoiceDetail,
  JobBilling,
  JobRef,
  VatOption,
  WipItem,
} from '../types';
import type { Call, Refusal } from './handlers';
import { clients, harbour } from './fixtures';

const END = { next_cursor: null, has_more: false };

export const booksJob: JobRef = {
  id: 'j-books',
  number: 'J00001',
  name: 'Bookkeeping 2026/27',
  billing_basis: 'hourly',
};
export const vatJob: JobRef = {
  id: 'j-vat',
  number: 'J00002',
  name: 'VAT returns 2026/27',
  billing_basis: 'hourly',
};
export const accountsJob: JobRef = {
  id: 'j-accs',
  number: 'J00003',
  name: 'Partnership accounts',
  billing_basis: 'fixed',
};

/** A line of recorded time: 1.5 hours at £120 an hour unless said otherwise. */
export function timeItem(overrides: Partial<WipItem> = {}): WipItem {
  return {
    kind: 'time',
    id: 't-1',
    date: '2026-09-07',
    age_days: 41,
    job: booksJob,
    person: { user_id: 'u-grace', full_name: 'Grace Hopper' },
    description: 'Bank reconciliation',
    minutes: 90,
    hours: '1.50',
    rate: 12000,
    value: 18000,
    charge_value: 18000,
    component: 'time',
    selectable: true,
    supplier: null,
    ...overrides,
  };
}

export function disbursementItem(overrides: Partial<WipItem> = {}): WipItem {
  return {
    kind: 'disbursement',
    id: 'd-1',
    date: '2026-09-10',
    job: booksJob,
    person: null,
    description: 'Filing fee',
    minutes: null,
    hours: null,
    rate: null,
    value: 3400,
    selectable: true,
    supplier: 'Companies House',
    ...overrides,
  };
}

export function expenseItem(overrides: Partial<WipItem> = {}): WipItem {
  return {
    kind: 'expense',
    id: 'e-1',
    date: '2026-09-12',
    job: vatJob,
    person: { user_id: 'u-grace', full_name: 'Grace Hopper' },
    description: 'Train to Bath',
    minutes: null,
    hours: null,
    rate: null,
    value: 3140,
    selectable: true,
    supplier: 'GWR',
    ...overrides,
  };
}

/** A fixed fee of £2,400 of which £400 is billed: £2,000 is left, and two time entries bill it. */
export function fixedFeeItem(overrides: Partial<WipItem> = {}): WipItem {
  return {
    kind: 'fixed_fee',
    id: 'j-accs',
    date: '2026-08-31',
    job: accountsJob,
    person: null,
    description: null,
    minutes: null,
    hours: null,
    rate: null,
    value: 200000,
    selectable: false,
    supplier: null,
    fixed_fee: {
      fee: 240000,
      recognised: 240000,
      billed: 40000,
      mode: 'on_completion',
      progress_bp: null,
      time_entry_ids: ['t-5', 't-6'],
    },
    ...overrides,
  };
}

/** Harbour's WIP: books and VAT time, a disbursement, an expense, and a recognised fixed fee. */
export const harbourItems = (): WipItem[] => [
  timeItem({
    id: 't-5',
    date: '2026-08-03',
    job: accountsJob,
    value: 0,
    charge_value: 24000,
    minutes: 120,
    hours: '2.00',
    component: 'fixed_fee',
    description: 'Draft accounts',
  }),
  timeItem({
    id: 't-6',
    date: '2026-08-04',
    job: accountsJob,
    value: 0,
    charge_value: 36000,
    minutes: 180,
    hours: '3.00',
    component: 'fixed_fee',
    description: 'Review',
  }),
  fixedFeeItem(),
  timeItem(),
  timeItem({
    id: 't-2',
    date: '2026-09-08',
    minutes: 60,
    hours: '1.00',
    value: 12000,
    charge_value: 12000,
    description: 'Payroll queries',
  }),
  disbursementItem(),
  expenseItem(),
  timeItem({
    id: 't-3',
    date: '2026-09-22',
    minutes: 120,
    hours: '2.00',
    value: 24000,
    charge_value: 24000,
    description: 'VAT workings',
  }),
  timeItem({
    id: 't-4',
    date: '2026-10-01',
    job: vatJob,
    minutes: 30,
    hours: '0.50',
    value: 6000,
    charge_value: 6000,
    description: 'VAT return',
  }),
];

export function wipOf(items: WipItem[], client = harbour): ClientWip {
  const time = items.filter((item) => item.kind === 'time');
  const minutes = time.reduce((sum, item) => sum + (item.minutes ?? 0), 0);
  const disbursement = items.filter((item) => item.kind === 'disbursement');
  const timeValue = time.reduce((sum, item) => sum + item.value, 0);
  const disbursementValue = disbursement.reduce((sum, item) => sum + item.value, 0);
  return {
    client,
    items,
    totals: {
      minutes,
      hours: (minutes / 60).toFixed(2),
      time_value: timeValue,
      disbursement_value: disbursementValue,
      total: items.reduce((sum, item) => sum + item.value, 0),
    },
  };
}

const NOTHING: Breakdown = {
  logged_minutes: 0,
  billable_minutes: 0,
  non_billable_minutes: 0,
  billed_minutes: 0,
  ready_minutes: 0,
  awaiting_approval_minutes: 0,
  company_time_value: 0,
  contract_time_value: 0,
  ready_time_value: 0,
  billed_time_value: 0,
  fixed_fee: null,
  fixed_fee_billed: 0,
  other_costs: 0,
  billable_total: 0,
  actual_cost: null,
  budgeted_cost: null,
  agreed_price: null,
  basis_values: { contract: 0, job: null, team: null },
};

export function jobBilling(overrides: Partial<JobBilling> = {}): JobBilling {
  return {
    job_id: 'j-books',
    number: 'J00001',
    name: 'Bookkeeping 2026/27',
    status: 'in_progress',
    billing_basis: 'hourly',
    fixed_fee: null,
    hourly_rate: null,
    budget_minutes: null,
    terms: 'Hourly at the rates agreed with the client or the practice’s own rates',
    breakdown: NOTHING,
    ...overrides,
  };
}

/** Bookkeeping (hourly, 3h of time ready, worth £360 at its rates, costing £120) and a fixed fee job. */
export function harbourSummary(): ClientBillingSummary {
  const books = jobBilling({
    breakdown: {
      ...NOTHING,
      logged_minutes: 420,
      billable_minutes: 390,
      non_billable_minutes: 30,
      ready_minutes: 180,
      awaiting_approval_minutes: 60,
      company_time_value: 12000,
      contract_time_value: 24000,
      ready_time_value: 36000,
      other_costs: 3400,
      billable_total: 39400,
      actual_cost: 28000,
      budgeted_cost: 30000,
      agreed_price: 50000,
      basis_values: { contract: 39400, job: 53400, team: 15400 },
    },
  });
  const accounts = jobBilling({
    job_id: 'j-accs',
    number: 'J00003',
    name: 'Partnership accounts',
    billing_basis: 'fixed',
    fixed_fee: 240000,
    terms: 'Fixed fee of £2,400.00',
    breakdown: {
      ...NOTHING,
      logged_minutes: 300,
      billable_minutes: 300,
      ready_minutes: 300,
      ready_time_value: 60000,
      fixed_fee: 240000,
      fixed_fee_billed: 40000,
      billable_total: 200000,
      actual_cost: 20000,
      agreed_price: 240000,
      basis_values: { contract: 200000, job: 200000, team: 20000 },
    },
  });
  return {
    client: harbour,
    jobs: [books, accounts],
    totals: {
      ...NOTHING,
      logged_minutes: 720,
      billable_minutes: 690,
      non_billable_minutes: 30,
      ready_minutes: 480,
      other_costs: 3400,
      billable_total: 239400,
      basis_values: { contract: 239400, job: 253400, team: 35400 },
    },
    show_cost: true,
    // t-1 (1.5h) costs £60, t-2 (1h) £40, t-3 (2h) £80, t-4 (0.5h) £20; t-5 and t-6 sit on the fixed fee.
    time_costs: { 't-1': 6000, 't-2': 4000, 't-3': 8000, 't-4': 2000, 't-5': 8000, 't-6': 12000 },
  };
}

export const vatCodes: VatOption[] = [
  {
    id: 'vat-std',
    name: 'Standard',
    code: 'standard',
    rate_bp: 2000,
    is_default: true,
    is_archived: false,
  },
  { id: 'vat-zero', name: 'Zero', code: 'zero', rate_bp: 0, is_default: false, is_archived: false },
];

/** The stand-in for the API behind the preparation: what is read and what the page created. */
export interface PrepareBackend {
  /** The client's WIP, by client id. */
  wip: Record<string, ClientWip>;
  /** The billing summary, by client id. */
  summary: Record<string, ClientBillingSummary>;
  vat: VatOption[];
  /** The client's payment terms in days. */
  termsDays: number;
  calls: Call[];
  /** Answers a route with an error: key `'POST /invoices'`. */
  refusals: Record<string, Refusal>;
}

export function createPrepareBackend(initial: Partial<PrepareBackend> = {}): PrepareBackend {
  return {
    wip: { [harbour.id]: wipOf(harbourItems()) },
    summary: { [harbour.id]: harbourSummary() },
    vat: vatCodes,
    termsDays: 30,
    calls: [],
    refusals: {},
    ...initial,
  };
}

export const postsOf = (backend: PrepareBackend, path: string) =>
  backend.calls.filter((call) => call.method === 'POST' && call.path === path);

/** Handlers for what the Prepare Invoice page reads, and for making, issuing and sending a draft. */
export function prepareHandlers(backend: PrepareBackend): HttpHandler[] {
  const record = (method: string, path: string, body?: unknown) => {
    backend.calls.push({ method, path, body });
  };
  const refusal = (method: string, path: string) => {
    const found = backend.refusals[`${method} ${path}`];
    return found ? fail(found.status, found.code, found.message) : null;
  };
  const draftOf = (request: InvoiceCreate): InvoiceDetail =>
    ({
      id: 'inv-new-1',
      number: null,
      status: 'draft',
      display_status: 'draft',
      client: harbour,
      currency: 'GBP',
      gross_total: 36000,
      request,
    }) as unknown as InvoiceDetail;

  return [
    http.get(orgApiPath('/clients/:clientId/wip'), ({ params }) => {
      const found = backend.wip[String(params.clientId)];
      record('GET', `/clients/${String(params.clientId)}/wip`);
      const failed = refusal('GET', '/clients/wip');
      if (failed) return failed;
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    http.get(orgApiPath('/clients/:clientId/billing-summary'), ({ params }) => {
      const found = backend.summary[String(params.clientId)];
      record('GET', `/clients/${String(params.clientId)}/billing-summary`);
      return found ? ok(found) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const found = clients.find((entry) => entry.id === params.clientId);
      if (!found) return fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
      return ok({
        ...found,
        payment_terms_days: backend.termsDays,
        default_vat_rate_id: null,
        invoice_email: null,
        invoice_template_id: null,
      });
    }),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const q = new URL(request.url).searchParams.get('q')?.toLowerCase();
      return ok(
        clients.filter((entry) => !q || entry.name.toLowerCase().includes(q)),
        { meta: END },
      );
    }),
    http.get(orgApiPath('/vat-rates'), () => ok(backend.vat)),
    http.post(orgApiPath('/invoices/:invoiceId/issue'), async ({ request, params }) => {
      const body = (await request.json()) as Record<string, unknown>;
      record('POST', `/invoices/${String(params.invoiceId)}/issue`, body);
      const failed = refusal('POST', '/invoices/issue');
      if (failed) return failed;
      return ok({ ...draftOf({} as InvoiceCreate), status: 'issued', number: 'INV-00099' });
    }),
    http.post(orgApiPath('/invoices/:invoiceId/submit'), async ({ request, params }) => {
      const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
      record('POST', `/invoices/${String(params.invoiceId)}/submit`, body);
      const failed = refusal('POST', '/invoices/submit');
      if (failed) return failed;
      return ok({ ...draftOf({} as InvoiceCreate), status: 'awaiting_approval' });
    }),
    http.post(orgApiPath('/invoices'), async ({ request }) => {
      const body = (await request.json()) as InvoiceCreate;
      record('POST', '/invoices', body);
      const failed = refusal('POST', '/invoices');
      if (failed) return failed;
      return ok(draftOf(body), { status: 201 });
    }),
  ];
}
