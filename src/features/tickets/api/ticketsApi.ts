import { PAGE_SIZE } from '@/constants/limits';
import { api, type UploadOptions } from '@/services/api';

import type {
  BulkRequest,
  BulkResult,
  DashboardRange,
  TagCreate,
  TicketAttachment,
  TicketComment,
  TicketCreate,
  TicketDashboard,
  TicketDetail,
  TicketFilters,
  TicketListItem,
  TicketTag,
  TicketUpdate,
  TimelineEvent,
} from '../types';

const org = (organizationId: string) => `/organizations/${encodeURIComponent(organizationId)}`;
const seg = encodeURIComponent;

export interface PageRequest {
  cursor?: string;
  signal?: AbortSignal;
  limit?: number;
}

/**
 * Typed wrappers over the tickets endpoints (`docs/modules/tickets.md` of the API). Query
 * values that are empty (an empty list, a blank search) are left out by the client.
 */
export const ticketsApi = {
  /* ---------------------------------- Tickets --------------------------------- */
  list: (organizationId: string, filters: TicketFilters, page: PageRequest = {}) =>
    api.list<TicketListItem>(`${org(organizationId)}/tickets`, {
      query: {
        q: filters.q,
        status: filters.status,
        priority: filters.priority,
        tag_id: filters.tag_id,
        sort: filters.sort,
        order: filters.order,
        limit: page.limit ?? PAGE_SIZE,
        cursor: page.cursor,
      },
      signal: page.signal,
    }),
  get: (organizationId: string, ticketId: string, signal?: AbortSignal) =>
    api.get<TicketDetail>(`${org(organizationId)}/tickets/${seg(ticketId)}`, { signal }),
  create: (organizationId: string, body: TicketCreate) =>
    api.post<TicketDetail>(`${org(organizationId)}/tickets`, body),
  update: (organizationId: string, ticketId: string, body: TicketUpdate) =>
    api.patch<TicketDetail>(`${org(organizationId)}/tickets/${seg(ticketId)}`, body),
  bulk: (organizationId: string, body: BulkRequest) =>
    api.post<BulkResult>(`${org(organizationId)}/tickets/bulk`, body),
  dashboard: (organizationId: string, range: DashboardRange, signal?: AbortSignal) =>
    api.get<TicketDashboard>(`${org(organizationId)}/tickets/dashboard`, {
      query: { date_from: range.date_from, date_to: range.date_to },
      signal,
    }),

  timeline: (organizationId: string, ticketId: string, page: PageRequest = {}) =>
    api.list<TimelineEvent>(`${org(organizationId)}/tickets/${seg(ticketId)}/timeline`, {
      query: { limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),

  /* ---------------------------------- Comments -------------------------------- */
  listComments: (organizationId: string, ticketId: string, page: PageRequest = {}) =>
    api.list<TicketComment>(`${org(organizationId)}/tickets/${seg(ticketId)}/comments`, {
      query: { limit: page.limit ?? PAGE_SIZE, cursor: page.cursor },
      signal: page.signal,
    }),
  addComment: (
    organizationId: string,
    ticketId: string,
    body: { body: string; body_html?: string; attachment_ids?: string[] },
  ) => api.post<TicketComment>(`${org(organizationId)}/tickets/${seg(ticketId)}/comments`, body),
  updateComment: (
    organizationId: string,
    ticketId: string,
    commentId: string,
    body: { body: string; body_html?: string | null },
  ) =>
    api.patch<TicketComment>(
      `${org(organizationId)}/tickets/${seg(ticketId)}/comments/${seg(commentId)}`,
      body,
    ),
  removeComment: (organizationId: string, ticketId: string, commentId: string) =>
    api.delete<null>(`${org(organizationId)}/tickets/${seg(ticketId)}/comments/${seg(commentId)}`),

  /* --------------------------------- Attachments ------------------------------ */
  uploadAttachment: (
    organizationId: string,
    ticketId: string,
    file: File,
    options: UploadOptions = {},
  ) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<TicketAttachment>(
      `${org(organizationId)}/tickets/${seg(ticketId)}/attachments`,
      form,
      options,
    );
  },
  /** The bytes of a file: the request carries the Bearer token, which `<img src>` could not. */
  downloadAttachment: (
    organizationId: string,
    ticketId: string,
    attachmentId: string,
    signal?: AbortSignal,
  ) =>
    api.getBlob(
      `${org(organizationId)}/tickets/${seg(ticketId)}/attachments/${seg(attachmentId)}`,
      { signal },
    ),
  removeAttachment: (organizationId: string, ticketId: string, attachmentId: string) =>
    api.delete<null>(
      `${org(organizationId)}/tickets/${seg(ticketId)}/attachments/${seg(attachmentId)}`,
    ),

  /* ----------------------------------- Tags ----------------------------------- */
  listTags: (organizationId: string, signal?: AbortSignal) =>
    api.get<TicketTag[]>(`${org(organizationId)}/ticket-tags`, { signal }),
  createTag: (organizationId: string, body: TagCreate) =>
    api.post<TicketTag>(`${org(organizationId)}/ticket-tags`, body),
};
