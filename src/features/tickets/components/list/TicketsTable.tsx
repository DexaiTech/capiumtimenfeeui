import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import {
  DataTable,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
  RowActions,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { formatDayMonthYear } from '@/utils/dates';

import type { TicketListItem, TicketPriority, TicketStatus } from '../../types';
import { PrioritySelect, StatusSelect } from '../SelectPill';
import { TagChip } from '../TagChip';
import { TagPopover } from '../TagPopover';

export interface TicketsTableProps {
  rows: ReadonlyArray<TicketListItem>;
  loading: boolean;
  sort: DataTableSort;
  onSortChange: (sort: DataTableSort) => void;
  selectable: boolean;
  selected: ReadonlySet<string>;
  onSelectedChange: (selected: ReadonlySet<string>) => void;
  slug: string;
  timeZone: string;
  /** `ticket.update`: the select pills and the tag picker are live. */
  canEdit: boolean;
  onStatusChange: (ticket: TicketListItem, status: TicketStatus) => void;
  onPriorityChange: (ticket: TicketListItem, priority: TicketPriority) => void;
  onTagResult: (message: string) => void;
  onCopyLink: (ticket: TicketListItem) => void;
  empty: ReactNode;
  footer: ReactNode;
}

/**
 * The ticket table: checkboxes, sortable headers (Ticket No., Subject, Created on, Status,
 * Priority; Tags is not sortable by the API), the tag chips that wrap onto several lines, the
 * select pills and the row menu. The header sticks under the top bar from lg up.
 */
export function TicketsTable({
  rows,
  loading,
  sort,
  onSortChange,
  selectable,
  selected,
  onSelectedChange,
  slug,
  timeZone,
  canEdit,
  onStatusChange,
  onPriorityChange,
  onTagResult,
  onCopyLink,
  empty,
  footer,
}: TicketsTableProps) {
  const navigate = useNavigate();

  const columns: DataTableColumn<TicketListItem>[] = [
    {
      id: 'number',
      header: 'Ticket No.',
      sortable: true,
      hideable: false,
      className: 'w-32 whitespace-nowrap',
      cell: (ticket) => (
        <Link
          to={routes.org.ticket(slug, ticket.id)}
          className="rounded-sm font-semibold text-brand-text hover:underline"
        >
          {ticket.code}
        </Link>
      ),
    },
    {
      id: 'subject',
      header: 'Subject',
      sortable: true,
      className: 'min-w-48',
      cell: (ticket) => (
        <Link
          to={routes.org.ticket(slug, ticket.id)}
          title={ticket.subject}
          className="line-clamp-2 rounded-sm break-words hover:text-brand-text"
        >
          {ticket.subject}
        </Link>
      ),
    },
    {
      id: 'tags',
      header: 'Tags',
      className: 'w-72',
      cell: (ticket) => (
        <div className="flex flex-wrap items-center gap-1">
          {ticket.tags.map((tag) => (
            <TagChip key={tag.id} tag={tag} />
          ))}
          {canEdit ? (
            <TagPopover
              ticket={ticket}
              label={
                ticket.tags.length === 0
                  ? `Add tags to ${ticket.code}`
                  : `Edit tags of ${ticket.code}`
              }
              triggerClassName={
                ticket.tags.length === 0
                  ? 'rounded-sm text-xs font-medium text-text-subtle hover:text-brand-text hover:underline'
                  : 'inline-flex size-5 items-center justify-center rounded-full border border-dashed border-border-strong text-text-subtle hover:border-brand hover:text-brand-text'
              }
              trigger={
                ticket.tags.length === 0 ? (
                  'Add tags'
                ) : (
                  <Plus aria-hidden="true" className="size-3" />
                )
              }
              onResult={onTagResult}
            />
          ) : ticket.tags.length === 0 ? (
            <span className="text-text-subtle">—</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'created_at',
      header: 'Created on',
      sortable: true,
      className: 'w-36 whitespace-nowrap',
      cell: (ticket) => (
        <span className="text-text-muted">{formatDayMonthYear(ticket.created_at, timeZone)}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-40',
      cell: (ticket) => (
        <StatusSelect
          ticket={ticket}
          editable={canEdit}
          onChange={(status) => onStatusChange(ticket, status)}
        />
      ),
    },
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      className: 'w-40',
      cell: (ticket) => (
        <PrioritySelect
          ticket={ticket}
          editable={canEdit}
          onChange={(priority) => onPriorityChange(ticket, priority)}
        />
      ),
    },
  ];

  const actionsFor = (ticket: TicketListItem): DropdownItem[] => [
    {
      id: 'open',
      label: 'Open',
      onSelect: () => void navigate(routes.org.ticket(slug, ticket.id)),
    },
    { id: 'copy', label: 'Copy link', onSelect: () => onCopyLink(ticket) },
  ];

  return (
    <DataTable
      caption="Tickets"
      columns={columns}
      rows={rows}
      rowKey={(ticket) => ticket.id}
      selectable={selectable}
      selected={selected}
      onSelectedChange={onSelectedChange}
      selectLabel={(ticket) => `Select ${ticket.code}`}
      sort={sort}
      onSortChange={onSortChange}
      loading={loading}
      skeletonRows={8}
      stickyHeader
      className="[--table-sticky-top:3.75rem]"
      rowActions={(ticket) => (
        <RowActions label={`Actions for ${ticket.code}`} items={actionsFor(ticket)} />
      )}
      empty={empty}
      footer={footer}
    />
  );
}
