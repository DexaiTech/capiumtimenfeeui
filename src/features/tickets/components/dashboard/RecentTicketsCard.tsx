import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';

import { Skeleton } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { formatDayMonthYear } from '@/utils/dates';

import type { TicketDashboard, TicketListItem, TicketPriority, TicketStatus } from '../../types';
import { PrioritySelect, StatusSelect } from '../SelectPill';
import { TagChip } from '../TagChip';

export interface RecentTicketsCardProps {
  /** Absent while the first load runs. */
  data: TicketDashboard | undefined;
  onStatusChange: (ticket: TicketListItem, status: TicketStatus) => void;
  onPriorityChange: (ticket: TicketListItem, priority: TicketPriority) => void;
}

const HEADINGS = ['Ticket No.', 'Subject', 'Status', 'Priority', 'Tags', 'Created on'] as const;
const headerCell =
  'h-[37px] border-y border-row-border bg-surface px-3 text-left text-xs font-medium whitespace-nowrap text-text-muted first:pl-4 last:pr-4';
const bodyCell =
  'h-[57px] border-b border-row-border px-3 py-2 align-middle text-text first:pl-4 last:pr-4';

/**
 * "Recent Tickets": the newest tickets of the range, with a "View All" link to the list. Status
 * and priority are select pills for people who may update tickets.
 */
export function RecentTicketsCard({
  data,
  onStatusChange,
  onPriorityChange,
}: RecentTicketsCardProps) {
  const { organization, can } = useOrg();
  const canEdit = can(PERMISSIONS.ticketUpdate);
  const slug = organization.slug;
  const recent = data?.recent ?? [];

  return (
    <section
      aria-labelledby="recent-tickets-title"
      className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-card"
    >
      <header className="flex items-center justify-between gap-3 px-4 pt-4 pb-3">
        <h2 id="recent-tickets-title" className="text-base font-semibold text-text">
          Recent Tickets
        </h2>
        <Link
          to={routes.org.tickets(slug)}
          className="inline-flex items-center gap-1 rounded-sm text-xs font-semibold text-brand-text hover:underline"
        >
          View All
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-xs font-medium">
          <caption className="sr-only">Recent tickets</caption>
          <thead>
            <tr>
              {HEADINGS.map((heading) => (
                <th key={heading} scope="col" className={headerCell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data
              ? Array.from({ length: 5 }, (_, row) => (
                  <tr key={row} aria-hidden="true">
                    {HEADINGS.map((heading) => (
                      <td key={heading} className={bodyCell}>
                        <Skeleton className="w-4/5" />
                      </td>
                    ))}
                  </tr>
                ))
              : recent.length === 0
                ? null
                : recent.map((ticket) => (
                    <tr key={ticket.id}>
                      <td className={bodyCell}>
                        <Link
                          to={routes.org.ticket(slug, ticket.id)}
                          className="font-semibold whitespace-nowrap text-brand-text hover:underline"
                        >
                          {ticket.code}
                        </Link>
                      </td>
                      <td className={`${bodyCell} w-full max-w-0 min-w-36`}>
                        <span className="block truncate" title={ticket.subject}>
                          {ticket.subject}
                        </span>
                      </td>
                      <td className={bodyCell}>
                        <StatusSelect
                          ticket={ticket}
                          editable={canEdit}
                          onChange={(status) => onStatusChange(ticket, status)}
                        />
                      </td>
                      <td className={bodyCell}>
                        <PrioritySelect
                          ticket={ticket}
                          editable={canEdit}
                          onChange={(priority) => onPriorityChange(ticket, priority)}
                        />
                      </td>
                      <td className={bodyCell}>
                        <div className="flex max-w-56 min-w-36 flex-wrap gap-1">
                          {ticket.tags.map((tag) => (
                            <TagChip key={tag.id} tag={tag} />
                          ))}
                        </div>
                      </td>
                      <td className={`${bodyCell} whitespace-nowrap text-text-muted`}>
                        {formatDayMonthYear(ticket.created_at, organization.timezone)}
                      </td>
                    </tr>
                  ))}
          </tbody>
        </table>
        {data && recent.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted">
            No tickets in this period.
          </p>
        ) : null}
      </div>
    </section>
  );
}
