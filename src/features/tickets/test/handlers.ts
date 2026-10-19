import { http, HttpResponse, type HttpHandler } from 'msw';

import { orgApiPath } from '@/test/renderInOrg';
import { fail, ok } from '@/test/server';

import type {
  TicketComment,
  TicketDashboard,
  TicketDetail,
  TicketListItem,
  TicketTag,
} from '../types';
import { apt1Detail, testComments, testDashboard, testTags, testTickets } from './fixtures';

export { orgApiPath };

const END = { next_cursor: null, has_more: false };

/** A promise a test settles by hand, to look at the screen while a request is still on its way. */
export function gate() {
  let open: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

export interface TicketData {
  tickets?: TicketListItem[];
  tags?: TicketTag[];
  /** What the dashboard answers, or a function of the range that was asked for. */
  dashboard?: TicketDashboard | ((params: URLSearchParams) => TicketDashboard);
  /** The one ticket `GET /tickets/{id}` knows. */
  detail?: TicketDetail;
  comments?: TicketComment[];
  /** Tickets per page; everything at once when absent. */
  pageSize?: number;
  /** Comments per page; everything at once when absent. */
  commentPageSize?: number;
  /** Receive the query string of every request of that endpoint. */
  onTicketList?: (params: URLSearchParams) => void;
  onDashboard?: (params: URLSearchParams) => void;
  /** Receive the id of every file that is downloaded, with the request (for its headers). */
  onFile?: (attachmentId: string, request: Request) => void;
}

/** A page of `rows` after the `cursor` (an index), `size` rows at a time; everything when no size. */
function pageOf<T>(rows: T[], params: URLSearchParams, size?: number) {
  if (!size) return { rows, meta: END };
  const start = Number(params.get('cursor') ?? 0);
  const next = start + size;
  return {
    rows: rows.slice(start, next),
    meta: next < rows.length ? { next_cursor: String(next), has_more: true } : END,
  };
}

const PRIORITY_RANK = ['high', 'medium', 'low', 'not_set'];

/** The list as the API orders it: `priority` high to not set, `status` by its code, ties by id. */
function sorted(rows: TicketListItem[], sort: string, order: string | null): TicketListItem[] {
  const descending = order ? order === 'desc' : sort === 'created_at' || sort === 'number';
  const key = (ticket: TicketListItem): string | number => {
    switch (sort) {
      case 'number':
        return ticket.number;
      case 'subject':
        return ticket.subject.toLowerCase();
      case 'status':
        return ticket.status;
      case 'priority':
        return PRIORITY_RANK.indexOf(ticket.priority);
      default:
        return ticket.created_at;
    }
  };
  return [...rows].sort((a, b) => {
    const left = key(a);
    const right = key(b);
    const result =
      typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right));
    return (descending ? -result : result) || a.id.localeCompare(b.id);
  });
}

/**
 * Read handlers of the tickets endpoints with the real envelope shapes and the filters the list
 * uses. Tests add the mutations they exercise and override what they care about.
 */
export function ticketHandlers(data: TicketData = {}): HttpHandler[] {
  const tickets = data.tickets ?? testTickets;
  const tags = data.tags ?? testTags;
  const detail = data.detail ?? apt1Detail;
  const comments = data.comments ?? testComments;

  return [
    http.get(orgApiPath('/tickets/dashboard'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onDashboard?.(params);
      const answer = data.dashboard ?? testDashboard;
      return ok(typeof answer === 'function' ? answer(params) : answer);
    }),
    http.get(orgApiPath('/tickets'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      data.onTicketList?.(params);
      const q = params.get('q')?.toLowerCase();
      const statuses = params.getAll('status');
      const priorities = params.getAll('priority');
      const tagIds = params.getAll('tag_id');
      const rows = tickets.filter(
        (ticket) =>
          (statuses.length === 0 || statuses.includes(ticket.status)) &&
          (priorities.length === 0 || priorities.includes(ticket.priority)) &&
          (tagIds.length === 0 || ticket.tags.some((tag) => tagIds.includes(tag.id))) &&
          (!q ||
            ticket.code.toLowerCase().includes(q) ||
            ticket.subject.toLowerCase().includes(q) ||
            (ticket.description_excerpt ?? '').toLowerCase().includes(q)),
      );
      const ordered = sorted(rows, params.get('sort') ?? 'created_at', params.get('order'));
      const result = pageOf(ordered, params, data.pageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.get(orgApiPath('/tickets/:ticketId'), ({ params }) =>
      params.ticketId === detail.id
        ? ok(detail)
        : fail(404, 'RESOURCE_NOT_FOUND', 'Ticket not found.'),
    ),
    http.get(orgApiPath('/tickets/:ticketId/comments'), ({ request }) => {
      const result = pageOf(comments, new URL(request.url).searchParams, data.commentPageSize);
      return ok(result.rows, { meta: result.meta });
    }),
    http.get(orgApiPath('/tickets/:ticketId/attachments/:attachmentId'), ({ params, request }) => {
      data.onFile?.(String(params.attachmentId), request);
      return new HttpResponse('bytes', { headers: { 'Content-Type': 'image/png' } });
    }),
    http.get(orgApiPath('/ticket-tags'), () => ok(tags)),
  ];
}
