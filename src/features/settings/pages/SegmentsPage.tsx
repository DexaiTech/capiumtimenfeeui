import { Plus, SearchX, Tags } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  ConfirmDialog,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  RowActions,
  SearchField,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { useDeleteSegment, useSegments, useUpdateSegment } from '../api/segmentHooks';
import { LoadError } from '../components/LoadError';
import { SegmentFormPanel } from '../components/segments/SegmentFormPanel';
import { SettingsSection } from '../components/SettingsSection';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { Segment } from '../segmentTypes';
import { dialogError } from '../utils/billingErrors';
import { describeError } from '../utils/errors';

type SegmentTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: SegmentTab; label: string }> = [
  { value: 'all', label: 'All segments' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS = ['name', 'clients', 'staff', 'status'] as const;

type DialogState =
  { type: 'form'; segment: Segment | null } | { type: 'delete'; segmentId: string } | null;

function SegmentList() {
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: SegmentTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const canManage = can(PERMISSIONS.settingsManage);

  const segments = useSegments();
  const update = useUpdateSegment();
  const remove = useDeleteSegment();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const all = segments.data ?? [];
  const target =
    dialog?.type === 'delete' ? (all.find((entry) => entry.id === dialog.segmentId) ?? null) : null;

  const setActive = (segment: Segment, active: boolean) => {
    update.mutate(
      { segmentId: segment.id, body: { is_active: active } },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: `${segment.name} ${active ? 'activated' : 'deactivated'}`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeError(error, 'Could not change the segment') }),
      },
    );
  };

  const confirmDelete = () => {
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${target.name} deleted`
              : `${target.name} deactivated instead`,
          description:
            result.outcome === 'deleted'
              ? undefined
              : 'Clients still have this segment, so it was kept.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (segment: Segment): DropdownItem[] => [
    { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', segment }) },
    segment.is_active
      ? { id: 'deactivate', label: 'Deactivate', onSelect: () => setActive(segment, false) }
      : { id: 'activate', label: 'Activate', onSelect: () => setActive(segment, true) },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', segmentId: segment.id });
      },
    },
  ];

  const columns: DataTableColumn<Segment>[] = [
    {
      id: 'name',
      header: 'Segment',
      sortable: true,
      sortValue: (segment) => segment.name,
      hideable: false,
      cell: (segment) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-semibold text-text">{segment.name}</span>
          {segment.description ? (
            <span className="text-xs text-text-muted">{segment.description}</span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'clients',
      header: 'Clients',
      sortable: true,
      sortValue: (segment) => segment.client_count,
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (segment) =>
        segment.client_count > 0 ? (
          <Link
            to={`${routes.org.clients(organization.slug)}?segment=${encodeURIComponent(segment.name)}`}
            aria-label={`${segment.client_count} ${segment.client_count === 1 ? 'client' : 'clients'} in ${segment.name}`}
            className="font-medium tabular-nums text-brand-text hover:underline"
          >
            {segment.client_count}
          </Link>
        ) : (
          <span className="tabular-nums text-text-muted">0</span>
        ),
    },
    {
      id: 'staff',
      header: 'Staff',
      sortable: true,
      sortValue: (segment) => segment.staff_count,
      align: 'end',
      className: 'w-24 whitespace-nowrap',
      cell: (segment) => <span className="tabular-nums">{segment.staff_count}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (segment) => (segment.is_active ? 'Active' : 'Inactive'),
      className: 'w-28',
      cell: (segment) => (
        <Badge tone={segment.is_active ? 'success' : 'neutral'}>
          {segment.is_active ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ];

  const needle = searched.toLowerCase();
  const matches = all.filter(
    (segment) =>
      (tab === 'all' || segment.is_active === (tab === 'active')) &&
      (needle === '' ||
        segment.name.toLowerCase().includes(needle) ||
        (segment.description ?? '').toLowerCase().includes(needle)),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<SegmentTab, number> = {
    all: all.length,
    active: all.filter((segment) => segment.is_active).length,
    inactive: all.filter((segment) => !segment.is_active).length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (segments.isError && !segments.data) {
    return (
      <LoadError
        title="Could not load the client segments"
        error={segments.error}
        onRetry={() => void segments.refetch()}
        retrying={segments.isRefetching}
      />
    );
  }

  return (
    <>
      <SegmentFormPanel
        open={dialog?.type === 'form'}
        segment={dialog?.type === 'form' ? dialog.segment : null}
        onClose={close}
      />
      <DataTable
        caption="Client segments"
        columns={columns}
        rows={rows}
        rowKey={(segment) => segment.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        loading={segments.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Segment lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: segments.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search segments"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', segment: null })}
                >
                  Add segment
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (segment) => (
                <RowActions label={`Actions for ${segment.name}`} items={actionsFor(segment)} />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No segments match"
              description="Try a different search or another tab."
              action={
                <Button
                  onClick={() => {
                    setSearchText('');
                    setParam({ q: null, tab: null });
                  }}
                >
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<Tags className="size-6" />}
              title="No segments yet"
              description="Segments group your clients, for example Gold, Retail or Charities. Add the ones the practice uses, then choose one on each client."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', segment: null })}
                  >
                    Add segment
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length} {all.length === 1 ? 'segment' : 'segments'}
              {canManage ? null : '. Changing segments needs permission to manage settings.'}
            </p>
          ) : null
        }
      />
      <ConfirmDialog
        open={dialog?.type === 'delete' && target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete segment?"
        confirmLabel="Delete"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          <strong className="font-medium text-text">{target?.name}</strong> is removed completely
          when no client has it. If clients have it, it is deactivated instead, so what they show
          does not change.
        </p>
        {target && target.staff_count > 0 ? (
          <p>
            {target.staff_count} {target.staff_count === 1 ? 'staff member looks' : 'staff look'}{' '}
            after it; they stop when it is deleted.
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  );
}

/**
 * `/:orgSlug/settings/segments`: the segments clients are grouped by. Any member reads them;
 * `settings.manage` adds, renames, deactivates and deletes. Staff are linked to segments on the
 * staff member's edit screen.
 */
export default function SegmentsPage() {
  useDocumentTitle('Client segments');
  return (
    <SettingsSection
      title="Client Segments"
      description="The groups clients are sorted into, such as Gold or Retail. A client takes one of these segments, and staff members can be given the segments they look after."
    >
      <SegmentList />
    </SettingsSection>
  );
}
