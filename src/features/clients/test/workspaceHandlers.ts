import { http, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type { CentralClient, CentralSearchResult } from '../central/types';
import type { ClientDetail, MemberRead, ServiceRead } from '../types';
import type {
  ClientOverview,
  ClientWip,
  CreditNoteRow,
  DisbursementRow,
  InvoiceRow,
  InvoiceTemplateOption,
  JobRow,
  PaymentRow,
  TimeEntryRow,
  VatRateOption,
} from '../workspace/types';
import { techwaveDetail, testMembers, testServices } from './fixtures';
import {
  centralClients,
  creditNotes,
  disbursements,
  invoices,
  invoiceTemplates,
  jobs,
  payments,
  techwaveOverview,
  techwaveWip,
  timeEntries,
  vatRates,
} from './workspaceFixtures';

const END = { next_cursor: null, has_more: false };

export interface WorkspaceData {
  /** Every client the practice has, by id: the detail endpoint answers 404 for any other. */
  clients?: ClientDetail[];
  overview?: ClientOverview;
  wip?: ClientWip;
  jobs?: JobRow[];
  time?: TimeEntryRow[];
  disbursements?: DisbursementRow[];
  invoices?: InvoiceRow[];
  creditNotes?: CreditNoteRow[];
  payments?: PaymentRow[];
  vatRates?: VatRateOption[];
  invoiceTemplates?: InvoiceTemplateOption[];
  members?: MemberRead[];
  services?: ServiceRead[];
  /** Receives the endpoint (`jobs`, `time-entries`, …) and the query of every record list. */
  onList?: (endpoint: string, params: URLSearchParams) => void;
}

/** Read handlers of the Client 360 workspace, with the real envelope shapes. */
export function workspaceHandlers(data: WorkspaceData = {}): HttpHandler[] {
  const clients = data.clients ?? [techwaveDetail];
  const overview = data.overview ?? techwaveOverview;
  const wip = data.wip ?? techwaveWip;
  const list = (endpoint: string, rows: ReadonlyArray<object>) =>
    http.get(orgApiPath(`/${endpoint}`), ({ request }) => {
      data.onList?.(endpoint, new URL(request.url).searchParams);
      return ok([...rows], { meta: END });
    });
  return [
    http.get(orgApiPath('/clients/:clientId/overview'), ({ params }) =>
      params.clientId === overview.client_id
        ? ok(overview)
        : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.'),
    ),
    http.get(orgApiPath('/clients/:clientId/wip'), ({ params }) =>
      params.clientId === wip.client.id
        ? ok(wip)
        : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.'),
    ),
    http.get(orgApiPath('/clients/:clientId'), ({ params }) => {
      const client = clients.find((candidate) => candidate.id === params.clientId);
      return client ? ok(client) : fail(404, 'RESOURCE_NOT_FOUND', 'Client not found.');
    }),
    list('jobs', data.jobs ?? jobs),
    list('time-entries', data.time ?? timeEntries),
    list('disbursements', data.disbursements ?? disbursements),
    list('invoices', data.invoices ?? invoices),
    list('credit-notes', data.creditNotes ?? creditNotes),
    list('payments', data.payments ?? payments),
    http.get(orgApiPath('/vat-rates'), () => ok(data.vatRates ?? vatRates)),
    http.get(orgApiPath('/invoice-templates'), () => ok(data.invoiceTemplates ?? invoiceTemplates)),
    http.get(orgApiPath('/services'), () => ok(data.services ?? testServices)),
    http.get(orgApiPath('/members'), () => ok(data.members ?? testMembers, { meta: END })),
  ];
}

/** `GET /central-clients`: what the central service (or this practice's cache) answers. */
export function centralSearchHandler(
  result: Partial<CentralSearchResult> & { onQuery?: (q: string | null) => void } = {},
): HttpHandler {
  const items: CentralClient[] = result.items ?? centralClients;
  return http.get(orgApiPath('/central-clients'), ({ request }) => {
    const q = new URL(request.url).searchParams.get('q');
    result.onQuery?.(q);
    const needle = q?.toLowerCase();
    const found = needle
      ? items.filter((client) => client.name.toLowerCase().includes(needle))
      : items;
    return ok({ items: found, source: result.source ?? 'live', stale: result.stale ?? false });
  });
}
