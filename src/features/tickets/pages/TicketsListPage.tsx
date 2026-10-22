import { SearchX, Ticket as TicketIcon } from 'lucide-react';
import { useState } from 'react';

import { Button, EmptyState, Pagination, useToast, type DataTableSort } from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';

import { flattenPages, useBulkTickets, useTickets, useTicketTags } from '../api';
import { LiveRegion } from '../components/LiveRegion';
import { BulkBar } from '../components/list/BulkBar';
import { CreateTicketDialog } from '../components/list/CreateTicketDialog';
import { TicketsTable } from '../components/list/TicketsTable';
import { TicketsToolbar } from '../components/list/TicketsToolbar';
import { LoadError, NoAccess } from '../components/Notices';
import { NEW_TICKET_BUTTON_NAME } from '../constants';
import { useTicketFieldChange } from '../hooks/useTicketFieldChange';
import { useTicketFilters } from '../hooks/useTicketFilters';
import type { BulkAction, TicketListItem } from '../types';
import { describeFailure } from '../utils/errors';
import { isFiltered } from '../utils/filters';
import { pluralize } from '../utils/format';

const NO_ROWS: ReadonlySet<string> = new Set();

function TicketList() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { filters, update, clear, search, creating, setCreating } = useTicketFilters();
  const canCreate = can(PERMISSIONS.ticketCreate);
  const canUpdate = can(PERMISSIONS.ticketUpdate);

  const tickets = useTickets(filters);
  const tags = useTicketTags();
  const bulk = useBulkTickets();
  const { change, announcement } = useTicketFieldChange();
  const [note, setNote] = useState('');

  // Ticking rows belongs to the filters they were ticked under: other filters start afresh.
  const filterKey = JSON.stringify([filters.q, filters.status, filters.priority, filters.tag_id]);
  const [selection, setSelection] = useState<{ key: string; ids: ReadonlySet<string> }>({
    key: filterKey,
    ids: NO_ROWS,
  });
  const selected = selection.key === filterKey ? selection.ids : NO_ROWS;
  const select = (ids: ReadonlySet<string>) => setSelection({ key: filterKey, ids });

  const rows = flattenPages(tickets.data);
  const filtered = isFiltered(filters);
  const sort: DataTableSort = { columnId: filters.sort, direction: filters.order };

  const runBulk = (action: BulkAction, value: string) => {
    bulk.mutate(
      { ticket_ids: [...selected], action, value },
      {
        onSuccess: (result) => {
          const text =
            result.changed === 0
              ? 'No ticket needed changing'
              : `${pluralize(result.changed, 'ticket')} updated`;
          setNote(text);
          toast({ tone: 'success', title: text });
        },
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not update the tickets') }),
      },
    );
  };

  const copyLink = (ticket: TicketListItem) => {
    const url = new URL(routes.org.ticket(organization.slug, ticket.id), window.location.origin);
    navigator.clipboard.writeText(url.href).then(
      () => toast({ tone: 'success', title: 'Link copied', description: ticket.code }),
      () => toast({ tone: 'error', title: 'Could not copy the link' }),
    );
  };

  const toolbar = (
    <TicketsToolbar
      filters={filters}
      search={search}
      tags={tags.data ?? []}
      tagsLoading={tags.isPending}
      onChange={update}
      onClear={clear}
      onCreate={canCreate ? () => setCreating(true) : undefined}
    />
  );

  return (
    <section className="flex min-w-0 flex-col gap-2.5">
      <h1 className="sr-only">All Tickets</h1>
      <LiveRegion message={announcement} />
      <LiveRegion message={note} />
      {toolbar}
      {selected.size > 0 && canUpdate ? (
        <BulkBar
          count={selected.size}
          tags={tags.data ?? []}
          canUpdate={canUpdate}
          busy={bulk.isPending}
          onAction={runBulk}
          onClear={() => select(NO_ROWS)}
        />
      ) : null}
      {tickets.isError && !tickets.data ? (
        <LoadError
          title="Could not load the tickets"
          error={tickets.error}
          onRetry={() => void tickets.refetch()}
          retrying={tickets.isRefetching}
        />
      ) : (
        <TicketsTable
          rows={rows}
          loading={tickets.isPending}
          sort={sort}
          onSortChange={(next) => update({ sort: next.columnId, order: next.direction })}
          selectable={canUpdate}
          selected={selected}
          onSelectedChange={select}
          slug={organization.slug}
          timeZone={organization.timezone}
          canEdit={canUpdate}
          onStatusChange={(ticket, status) => change(ticket, { status })}
          onPriorityChange={(ticket, priority) => change(ticket, { priority })}
          onTagResult={setNote}
          onCopyLink={copyLink}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No tickets match"
                description="Try a different search, or remove a filter."
                action={<Button onClick={clear}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<TicketIcon className="size-6" />}
                title="No tickets yet"
                description="Tickets track the bugs and enhancements found while using the application."
                action={
                  canCreate ? (
                    <Button
                      variant="primary"
                      aria-label={NEW_TICKET_BUTTON_NAME}
                      onClick={() => setCreating(true)}
                    >
                      Application Testing
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-2">
                <Pagination
                  hasMore={tickets.hasNextPage}
                  onLoadMore={() => void tickets.fetchNextPage()}
                  loading={tickets.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['ticket', 'tickets']}
                />
              </div>
            ) : null
          }
        />
      )}
      <CreateTicketDialog open={creating && canCreate} onClose={() => setCreating(false)} />
    </section>
  );
}

/** `/:orgSlug/application-testing/tickets`: every ticket, with filters, bulk actions and inline changes (`ticket.read`). */
export default function TicketsListPage() {
  const { can } = useOrg();
  useDocumentTitle('All Tickets');
  return can(PERMISSIONS.ticketRead) ? <TicketList /> : <NoAccess what="Application Testing" />;
}
