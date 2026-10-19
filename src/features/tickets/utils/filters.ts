import { defaultOrder, TICKET_PRIORITIES, TICKET_SORTS, TICKET_STATUSES } from '../constants';
import type { TicketFilters, TicketPriority, TicketStatus } from '../types';

const isStatus = (value: string): value is TicketStatus =>
  (TICKET_STATUSES as ReadonlyArray<string>).includes(value);
const isPriority = (value: string): value is TicketPriority =>
  (TICKET_PRIORITIES as ReadonlyArray<string>).includes(value);

/**
 * The list's filters from the URL search params (`q`, `tag`, `priority`, `status`, `sort`,
 * `order`; the last three kinds of filter may repeat). Unknown values are dropped.
 */
export function filtersFromParams(params: URLSearchParams): TicketFilters {
  const sort = TICKET_SORTS.find((entry) => entry === params.get('sort')) ?? 'created_at';
  const order = params.get('order');
  return {
    q: params.get('q')?.trim() || undefined,
    status: params.getAll('status').filter(isStatus),
    priority: params.getAll('priority').filter(isPriority),
    tag_id: params.getAll('tag').filter(Boolean),
    sort,
    order: order === 'asc' || order === 'desc' ? order : defaultOrder(sort),
  };
}

/** True when the list is narrowed by a search or by any filter (sorting does not count). */
export function isFiltered(filters: TicketFilters): boolean {
  return (
    Boolean(filters.q) ||
    filters.status.length > 0 ||
    filters.priority.length > 0 ||
    filters.tag_id.length > 0
  );
}
