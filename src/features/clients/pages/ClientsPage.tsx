import '@/styles/capium-clients.css';

import { Archive, Eye, FileDown, Pencil, RefreshCw, Trash2, UserPlus } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';

import { ConfirmDialog, useBulkFlow, useToast } from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { isApiError } from '@/services/api';
import { downloadText, toCsv } from '@/utils/csv';

import {
  flattenPages,
  useArchiveClient,
  useBulkClients,
  useClientList,
  useClientSummary,
  useDeleteClient,
  useExportClients,
  useServiceOptions,
  useStaffDirectory,
  useSyncAllClients,
  useSyncClient,
} from '../api';
import { CentralClientsDialog } from '../central/CentralClientsDialog';
import { canSync, describeSync, describeSyncAll } from '../central/format';
import type { MenuAction } from '../components/ActionMenu';
import { ClientFormPanel } from '../components/ClientFormPanel';
import { ClientsBulkBar } from '../components/ClientsBulkBar';
import { ClientsGrid } from '../components/ClientsGrid';
import { ClientsTable } from '../components/ClientsTable';
import { ClientsToolbar } from '../components/ClientsToolbar';
import { ContactFormPanel, type ContactTarget } from '../components/ContactFormPanel';
import { ImportDialog } from '../components/ImportDialog';
import {
  countFilters,
  DEFAULT_SORT,
  DRAFT_FILTERS,
  EMPTY_FILTERS,
  isDraftsView,
} from '../constants';
import { downloadBlob, todayIn } from '../format';
import { useClientsPrefs, type FilterPreset } from '../store';
import type {
  ClientBulkRequest,
  ClientDetail,
  ClientFilters,
  ClientListItem,
  ClientRead,
  ClientSort,
  SortOrder,
} from '../types';

const NO_PRESETS: FilterPreset[] = [];

function describe(error: unknown): { message: string; requestId?: string } {
  if (isApiError(error)) return { message: error.message, requestId: error.requestId };
  return { message: 'An unexpected error occurred. Please try again.' };
}

/** A simple folder-and-people drawing for the empty state (decorative). */
function EmptyIllustration() {
  return (
    <svg width="120" height="88" viewBox="0 0 120 88" aria-hidden="true" focusable="false">
      <rect x="10" y="18" width="100" height="62" rx="10" fill="rgb(105 75 175 / 10%)" />
      <rect x="22" y="8" width="44" height="18" rx="6" fill="rgb(105 75 175 / 18%)" />
      <circle cx="48" cy="46" r="10" fill="#694BAF" />
      <path d="M30 72c2-10 10-15 18-15s16 5 18 15" fill="#694BAF" />
      <circle cx="76" cy="50" r="8" fill="#B4A5D7" />
      <path d="M62 72c2-8 8-12 14-12s12 4 14 12" fill="#B4A5D7" />
    </svg>
  );
}

/** `/:orgSlug/clients`: the client list (needs `client.read`). */
export default function ClientsPage() {
  useDocumentTitle('Clients');
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  const canCreate = can('client.create');
  const canUpdate = can('client.update');
  const canDelete = can('client.delete');
  const canReadMembers = can('member.read');

  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search, 300);
  // `?segment=` opens the list for those segments (the links of Settings and the staff screen).
  const [filters, setFilters] = useState<ClientFilters>(() => ({
    ...EMPTY_FILTERS,
    segment: searchParams.getAll('segment'),
  }));
  const [sort, setSort] = useState<ClientSort>(DEFAULT_SORT);
  const [order, setOrder] = useState<SortOrder>('asc');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());

  const [formClient, setFormClient] = useState<ClientRead | null | undefined>(undefined);
  const [contactTarget, setContactTarget] = useState<ContactTarget | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [centralOpen, setCentralOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<ClientListItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientListItem | null>(null);
  const [deleteError, setDeleteError] = useState<{ message: string; requestId?: string } | null>(
    null,
  );
  const [bulkArchiveOpen, setBulkArchiveOpen] = useState(false);

  const hiddenColumns = useClientsPrefs((state) => state.hiddenColumns);
  const hidden = useMemo(() => new Set(hiddenColumns), [hiddenColumns]);
  const view = useClientsPrefs((state) => state.view);
  const presets = useClientsPrefs((state) => state.presets[organization.id] ?? NO_PRESETS);
  const { setColumnHidden, showAllColumns, setView, savePreset, deletePreset } =
    useClientsPrefs.getState();

  const params = useMemo(() => ({ q, filters, sort, order }), [q, filters, sort, order]);
  const list = useClientList(params);
  const summary = useClientSummary();
  const services = useServiceOptions();
  const staff = useStaffDirectory();
  const archive = useArchiveClient();
  const bulk = useBulkClients();
  const remove = useDeleteClient();
  const exporter = useExportClients();
  const syncOne = useSyncClient();
  const syncAll = useSyncAllClients();

  const rows = useMemo(() => flattenPages(list.data), [list.data]);
  const today = todayIn(organization.timezone);

  // A bulk action only ever reaches the clients on screen: a ticked row that is no longer listed
  // (another filter or search, a refresh) is left out.
  const picked = useMemo(
    () => rows.filter((row) => selected.has(row.id)).map((row) => row.id),
    [rows, selected],
  );
  const bulkFlow = useBulkFlow<ClientBulkRequest>({
    run: (body) => bulk.mutateAsync(body),
    noun: ['client', 'clients'],
    onDone: () => {
      setSelected(new Set());
      setBulkArchiveOpen(false);
    },
  });

  // The top bar's "+" can open the Add Client dialog with `?new=1`.
  const addRequested = canCreate && searchParams.get('new') === '1';
  /** A new client opens on its own page, ready for its contacts and services; an edit stays here. */
  const openCreated = (saved: ClientDetail) => {
    if (formClient) return;
    // After the form has closed and dropped `?new=1`, so this is the last navigation.
    setTimeout(() => void navigate(routes.org.client(organization.slug, saved.id)), 0);
  };
  const closeForm = () => {
    setFormClient(undefined);
    if (searchParams.has('new')) {
      const next = new URLSearchParams(searchParams);
      next.delete('new');
      setSearchParams(next, { replace: true });
    }
  };

  const onSort = (key: ClientSort) => {
    if (key === sort) {
      setOrder((value) => (value === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(key);
      setOrder('asc');
    }
  };

  const onToggle = (clientId: string, checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(clientId);
      else next.delete(clientId);
      return next;
    });

  const onTogglePage = (checked: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      for (const row of rows) {
        if (checked) next.add(row.id);
        else next.delete(row.id);
      }
      return next;
    });

  const openClient = (client: ClientListItem) =>
    void navigate(routes.org.client(organization.slug, client.id));

  const onAddContact = canUpdate
    ? (client: ClientListItem) =>
        setContactTarget({
          clientId: client.id,
          clientName: client.name,
          contact: null,
          primary: true,
        })
    : null;

  const onSyncClient = async (client: ClientListItem) => {
    try {
      toast(describeSync(await syncOne.mutateAsync(client.id)));
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not synchronise the client',
        description: describe(error).message,
      });
    }
  };

  const onSyncAll = async () => {
    try {
      toast(describeSyncAll(await syncAll.mutateAsync()));
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not synchronise the linked clients',
        description: describe(error).message,
      });
    }
  };

  const actionsFor = (client: ClientListItem): MenuAction[] => [
    {
      id: 'view',
      label: 'View',
      icon: <Eye aria-hidden="true" />,
      onSelect: () => openClient(client),
    },
    ...(canUpdate
      ? [
          {
            id: 'edit',
            label: 'Edit',
            icon: <Pencil aria-hidden="true" />,
            onSelect: () => setFormClient(client),
          },
        ]
      : []),
    ...(canUpdate && canSync(client)
      ? [
          {
            id: 'sync',
            label: 'Sync with central',
            icon: <RefreshCw aria-hidden="true" />,
            onSelect: () => void onSyncClient(client),
          },
        ]
      : []),
    ...(canDelete && client.status !== 'archived'
      ? [
          {
            id: 'archive',
            label: 'Archive',
            icon: <Archive aria-hidden="true" />,
            onSelect: () => setArchiveTarget(client),
          },
        ]
      : []),
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: 'Delete',
            tone: 'danger' as const,
            icon: <Trash2 aria-hidden="true" />,
            onSelect: () => {
              setDeleteError(null);
              setDeleteTarget(client);
            },
          },
        ]
      : []),
  ];

  const onExport = async () => {
    try {
      const blob = await exporter.mutateAsync(params);
      downloadBlob('clients.csv', blob);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not export the clients',
        description: describe(error).message,
      });
    }
  };

  const onBulkExport = () => {
    const chosen = rows.filter((row) => selected.has(row.id));
    downloadText(
      'clients-selected.csv',
      toCsv([
        [
          'code',
          'name',
          'client_type',
          'status',
          'company_number',
          'segment',
          'health_score',
          'contact_name',
          'contact_email',
          'deadline_status',
          'accounting_software',
          'services',
          'last_activity_at',
        ],
        ...chosen.map((row) => [
          row.code,
          row.name,
          row.client_type,
          row.status,
          row.company_number,
          row.segment,
          row.health_score,
          row.contact_name,
          row.contact_email,
          row.deadlines.status,
          row.accounting_software,
          row.services.map((service) => service.code).join(';'),
          row.last_activity_at,
        ]),
      ]),
    );
  };

  const onBulkArchive = () =>
    void bulkFlow.submit(
      { client_ids: picked, action: 'set_status', value: 'archived' },
      'archived',
    );

  const onConfirmArchive = async () => {
    if (!archiveTarget) return;
    try {
      await archive.mutateAsync(archiveTarget.id);
      toast({ tone: 'success', title: 'Client archived', description: archiveTarget.name });
      setArchiveTarget(null);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not archive the client',
        description: describe(error).message,
      });
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await remove.mutateAsync(deleteTarget.id);
      toast({ tone: 'success', title: 'Client deleted', description: deleteTarget.name });
      setSelected((current) => {
        const next = new Set(current);
        next.delete(deleteTarget.id);
        return next;
      });
      setDeleteTarget(null);
    } catch (error) {
      // CLIENT_IN_USE (409) and every other refusal are explained in the dialog.
      setDeleteError(describe(error));
    }
  };

  const loadMore = useCallback(() => {
    if (list.hasNextPage && !list.isFetchingNextPage) void list.fetchNextPage();
  }, [list]);

  const filtered = q.trim() !== '' || countFilters(filters) > 0;

  const placeholder = (() => {
    if (list.isError && rows.length === 0) {
      const error = describe(list.error);
      return (
        <div className="cc-state" role="alert">
          <h2>Could not load the clients</h2>
          <p>{error.message}</p>
          {error.requestId ? <p className="cc-muted">Request ID: {error.requestId}</p> : null}
          <div className="cc-state-actions">
            <button
              type="button"
              className="cc-btn cc-btn--outline"
              onClick={() => void list.refetch()}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    if (!list.isPending && !list.isPlaceholderData && rows.length === 0) {
      if (filtered) {
        return (
          <div className="cc-state">
            <EmptyIllustration />
            <h2>No clients match</h2>
            <p>Try another search or clear the filters.</p>
            <div className="cc-state-actions">
              <button
                type="button"
                className="cc-btn cc-btn--outline"
                onClick={() => {
                  setSearch('');
                  setFilters(EMPTY_FILTERS);
                }}
              >
                Clear search and filters
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="cc-state">
          <EmptyIllustration />
          <h2>No clients yet</h2>
          <p>Add your first client, or import your client list from a CSV file.</p>
          {canCreate ? (
            <div className="cc-state-actions">
              <button
                type="button"
                className="cc-btn cc-btn--primary"
                onClick={() => setFormClient(null)}
              >
                <UserPlus aria-hidden="true" />
                Add Client
              </button>
              <button
                type="button"
                className="cc-btn cc-btn--outline"
                onClick={() => setImportOpen(true)}
              >
                <FileDown aria-hidden="true" />
                Import
              </button>
            </div>
          ) : null}
        </div>
      );
    }
    return undefined;
  })();

  const tableProps = {
    rows,
    selected,
    onToggle,
    onOpen: openClient,
    onAddContact,
    actionsFor,
    timeZone: organization.timezone,
    today,
    loading: list.isPending,
    hasMore: list.hasNextPage,
    loadingMore: list.isFetchingNextPage,
    onLoadMore: loadMore,
    placeholder,
  };

  return (
    <div className="capium-clients cc-page">
      <h1 className="cc-sr-only">Clients</h1>
      <ClientFormPanel
        open={formClient !== undefined || addRequested}
        client={formClient ?? null}
        onClose={closeForm}
        onSaved={openCreated}
      />
      <ContactFormPanel target={contactTarget} onClose={() => setContactTarget(null)} />
      <ClientsToolbar
        clientCount={summary.data?.total}
        search={search}
        onSearchChange={setSearch}
        hidden={hidden}
        onColumnChange={setColumnHidden}
        onShowAllColumns={showAllColumns}
        filters={filters}
        onFiltersChange={setFilters}
        presets={presets}
        onSavePreset={(name) => {
          savePreset(organization.id, name, filters);
          toast({ tone: 'success', title: 'Filter set saved', description: name });
        }}
        onDeletePreset={(presetId) => deletePreset(organization.id, presetId)}
        summary={summary.data}
        summaryLoading={summary.isPending}
        services={services.data ?? []}
        members={staff.data ?? []}
        canPickPeople={canReadMembers}
        selectedCount={picked.length}
        canArchive={canDelete}
        onBulkArchive={() => {
          bulkFlow.clearRefusal();
          setBulkArchiveOpen(true);
        }}
        onBulkExport={onBulkExport}
        draftsActive={isDraftsView(filters)}
        onToggleDrafts={() => setFilters(isDraftsView(filters) ? EMPTY_FILTERS : DRAFT_FILTERS)}
        view={view}
        onViewChange={setView}
        canCreate={canCreate}
        onImport={() => setImportOpen(true)}
        onExport={() => void onExport()}
        exporting={exporter.isPending}
        onAddClient={() => setFormClient(null)}
        canEnableCentral={canCreate}
        onCentralClients={() => setCentralOpen(true)}
        canSyncAll={canUpdate}
        onSyncAll={() => void onSyncAll()}
        syncingAll={syncAll.isPending}
        linkedCount={summary.data?.by_central.linked}
      />

      {picked.length > 0 ? (
        <ClientsBulkBar
          ids={picked}
          members={staff.data ?? []}
          canUpdate={canUpdate}
          canDelete={canDelete}
          flow={bulkFlow}
          onClear={() => setSelected(new Set())}
        />
      ) : null}

      {view === 'grid' ? (
        <ClientsGrid {...tableProps} />
      ) : (
        <ClientsTable
          {...tableProps}
          hidden={hidden}
          sort={sort}
          order={order}
          onSort={onSort}
          onTogglePage={onTogglePage}
        />
      )}

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
      <CentralClientsDialog open={centralOpen} onClose={() => setCentralOpen(false)} />
      <ConfirmDialog
        open={archiveTarget !== null}
        onClose={() => setArchiveTarget(null)}
        onConfirm={() => void onConfirmArchive()}
        title="Archive client"
        confirmLabel="Archive"
        tone="default"
        loading={archive.isPending}
      >
        <p>
          {archiveTarget?.name} will be hidden from the client list and pickers. No new jobs, time
          or disbursements can be recorded; existing WIP can still be billed.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void onConfirmDelete()}
        title="Delete client"
        confirmLabel="Delete"
        loading={remove.isPending}
        error={deleteError}
      >
        <p>
          Delete {deleteTarget?.name}? Only a client with no jobs, time, invoices or payments can be
          deleted; archive it otherwise.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={bulkArchiveOpen}
        onClose={() => setBulkArchiveOpen(false)}
        onConfirm={onBulkArchive}
        title="Archive selected clients"
        confirmLabel={`Archive ${picked.length}`}
        tone="default"
        loading={bulkFlow.busy}
        error={bulkFlow.refusal}
      >
        <p>
          {picked.length} client{picked.length === 1 ? '' : 's'} will be archived and hidden from
          the default list.
        </p>
      </ConfirmDialog>
    </div>
  );
}
