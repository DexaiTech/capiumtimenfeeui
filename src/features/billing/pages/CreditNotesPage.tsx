import { Ellipsis, FileMinus2, Plus, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  sortRows,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';

import { billingApi, flattenPages, useCreditNoteList } from '../api';
import { creditNoteColumns } from '../components/creditNotes/creditNoteColumns';
import { CreditNoteDetailDialog } from '../components/creditNotes/CreditNoteDetailDialog';
import {
  CreditNoteLauncher,
  StartCreditNoteDialog,
} from '../components/creditNotes/CreditNoteLauncher';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { useFileDownload } from '../hooks/useFileDownload';
import { isoDateParam, useUrlSearch } from '../hooks/useUrlSearch';
import type { CreditNote, CreditNoteListFilters } from '../types';

function CreditNoteList() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { busy, download } = useFileDownload();

  const clientId = params.get('client') ?? '';
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));
  const filters = useMemo<CreditNoteListFilters>(
    () => ({
      client_id: clientId || undefined,
      date_from: from || undefined,
      date_to: to || undefined,
      q: searched || undefined,
    }),
    [clientId, from, to, searched],
  );
  const notes = useCreditNoteList(filters);

  const [hidden, setHidden] = usePersistentColumns('credit-notes');
  const [openNote, setOpenNote] = useState<CreditNote | null>(null);
  const [starting, setStarting] = useState(false);
  const [raisingFor, setRaisingFor] = useState<string | null>(null);

  const columns = useMemo(
    () => creditNoteColumns(organization.slug, organization.currency),
    [organization.slug, organization.currency],
  );
  const sortParam = params.get('sort');
  const orderParam = params.get('order');
  const sort = useMemo<DataTableSort | null>(
    () =>
      columns.some((column) => column.id === sortParam && column.sortable)
        ? { columnId: sortParam ?? '', direction: orderParam === 'desc' ? 'desc' : 'asc' }
        : null,
    [columns, sortParam, orderParam],
  );
  const loaded = useMemo(() => flattenPages(notes.data), [notes.data]);
  const rows = useMemo(() => sortRows(loaded, columns, sort), [loaded, columns, sort]);

  const canCreate = can(P.creditNoteCreate);
  const filterCount = (clientId ? 1 : 0) + (from || to ? 1 : 0);
  const filtered = Boolean(searched) || filterCount > 0;

  if (notes.isError && !notes.data) {
    return (
      <LoadError
        title="Could not load the credit notes"
        error={notes.error}
        onRetry={() => void notes.refetch()}
        retrying={notes.isRefetching}
      />
    );
  }

  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, client: null, from: null, to: null });
  };
  const actionsFor = (note: CreditNote): DropdownItem[] => [
    { id: 'open', label: 'View credit note', onSelect: () => setOpenNote(note) },
    {
      id: 'pdf',
      label: 'Download PDF',
      onSelect: () =>
        void download(note.id, `${note.number}.pdf`, () =>
          billingApi.creditNotePdf(organization.id, note.id),
        ),
    },
  ];

  return (
    <>
      <DataTable
        caption="Credit notes"
        columns={columns}
        rows={rows}
        rowKey={(note) => note.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        onRowClick={setOpenNote}
        loading={notes.isPending}
        toolbar={
          <PageToolbar
            start={<h2 className="px-2 text-sm font-semibold text-text">Credit notes</h2>}
            search={
              <SearchField
                label="Search credit notes"
                placeholder="Search number or client"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <>
                <FilterPopover
                  title="Filter credit notes"
                  count={filterCount}
                  onClear={() => setParam({ client: null, from: null, to: null })}
                >
                  {can(P.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      value={clientId || null}
                      onChange={(client) => setParam({ client: client?.id ?? null })}
                      listPlacement="inline"
                    />
                  ) : null}
                  <DateRangeField
                    label="Credit note date"
                    value={{ from: from || null, to: to || null }}
                    onChange={(range) => setParam({ from: range.from, to: range.to })}
                  />
                </FilterPopover>
                <ColumnVisibilityMenu
                  columns={columns.map((column) => ({
                    id: column.id,
                    label: column.header,
                    locked: column.hideable === false,
                  }))}
                  hidden={hidden}
                  onChange={setHidden}
                />
              </>
            }
            primaryAction={
              canCreate ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setStarting(true)}
                >
                  Raise credit note
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(note) => (
          <Dropdown
            label={`Actions for ${note.number}`}
            items={actionsFor(note)}
            trigger={
              busy === note.id ? (
                <span className="text-xs text-text-muted">Downloading…</span>
              ) : (
                <Ellipsis aria-hidden="true" className="size-5 text-text-muted" />
              )
            }
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No credit notes match"
              description="Try a different search or date range."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<FileMinus2 className="size-6" />}
              title="No credit notes yet"
              description="Credit notes raised against issued invoices are listed here."
              action={
                canCreate ? (
                  <Button variant="primary" onClick={() => setStarting(true)}>
                    Raise credit note
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
                hasMore={notes.hasNextPage}
                onLoadMore={() => void notes.fetchNextPage()}
                loading={notes.isFetchingNextPage}
                count={rows.length}
                itemLabel={['credit note', 'credit notes']}
              />
            </div>
          ) : null
        }
      />
      <CreditNoteDetailDialog
        creditNoteId={openNote?.id ?? null}
        number={openNote?.number}
        onClose={() => setOpenNote(null)}
      />
      <StartCreditNoteDialog
        open={starting}
        onClose={() => setStarting(false)}
        onChoose={(invoiceId) => {
          setStarting(false);
          setRaisingFor(invoiceId);
        }}
      />
      {raisingFor ? (
        <CreditNoteLauncher invoiceId={raisingFor} onClose={() => setRaisingFor(null)} />
      ) : null}
    </>
  );
}

/** `/:orgSlug/billing/credit-notes`: credit notes raised against invoices (`invoice.read`). */
export default function CreditNotesPage() {
  const { can } = useOrg();
  useDocumentTitle('Credit notes');
  return (
    <PageShell
      title="Credit notes"
      description="Correct an issued invoice with a full or partial credit note. The credit reduces what the client owes."
    >
      {can(P.invoiceRead) ? <CreditNoteList /> : <NoAccess what="credit notes" />}
    </PageShell>
  );
}
