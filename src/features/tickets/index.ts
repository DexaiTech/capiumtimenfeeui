/**
 * Public surface of the Application Testing feature (`/:orgSlug/application-testing/*`): the
 * practice's tracker for bugs and enhancements. The router loads the pages from `pages/`; other
 * modules take the vocabulary and the types below instead of reaching into this folder.
 */
export { PRIORITY_META, STATUS_META, TICKET_PRIORITIES, TICKET_STATUSES } from './constants';
export type {
  TagColor,
  TagRef,
  TicketDashboard,
  TicketDetail,
  TicketListItem,
  TicketPriority,
  TicketStatus,
  TicketTag,
} from './types';
