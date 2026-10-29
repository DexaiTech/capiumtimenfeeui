import { http, type HttpHandler } from 'msw';

import { segmentHandlers } from '@/test/segments';
import { orgApiPath } from '@/test/renderInOrg';
import { ok } from '@/test/server';

import type { ClientListItem, ClientSummary, MemberRead, ServiceRead } from '../types';
import { testClients, testMembers, testServices, testSummary } from './fixtures';

const END = { next_cursor: null, has_more: false };

export interface ClientsData {
  clients?: ClientListItem[];
  summary?: ClientSummary;
  services?: ServiceRead[];
  members?: MemberRead[];
  /** Receives the query string of every `GET /clients`. */
  onList?: (params: URLSearchParams, request: Request) => void;
}

/** Read handlers of the client list page with the real envelope shapes. */
export function clientsHandlers(data: ClientsData = {}): HttpHandler[] {
  const clients = data.clients ?? testClients;
  return [
    ...segmentHandlers(),
    http.get(orgApiPath('/clients/summary'), () => ok(data.summary ?? testSummary)),
    http.get(orgApiPath('/clients'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onList?.(params, request);
      const q = params.get('q')?.toLowerCase();
      const rows = q ? clients.filter((client) => client.name.toLowerCase().includes(q)) : clients;
      return ok(rows, { meta: END });
    }),
    http.get(orgApiPath('/services'), () => ok(data.services ?? testServices)),
    http.get(orgApiPath('/members'), () => ok(data.members ?? testMembers, { meta: END })),
  ];
}
