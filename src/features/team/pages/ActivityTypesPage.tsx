import { Ellipsis, ListChecks, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ColumnVisibilityMenu,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  SearchField,
  sortRows,
  useToast,
  type DataTableColumn,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, usePersistentColumns, useUrlParams } from '@/hooks';

import {
  useActivityTypes,
  useDeleteActivityType,
  useServices,
  useSetActivityTypeActive,
  useVatCodes,
} from '../api';
import { ActiveBadge } from '../components/badges';
import { ActivityTypeFormPanel } from '../components/catalogue/ActivityTypeFormPanel';
import { vatName } from '../components/catalogue/vat';
import { LoadError, PageShell } from '../components/PageShell';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { ActivityType } from '../types';
import { describeFailure, dialogError } from '../utils/errors';

type ActivityTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: ActivityTab; label: string }> = [
  { value: 'all', label: 'All activity types' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS = ['name', 'code', 'billable', 'status'] as const;

type DialogState =
  | { type: 'form'; activityType: ActivityType | null }
  | { type: 'delete'; activityType: ActivityType }
  | null;

/** How many linked services are named in a cell before the rest are counted. */
const NAMED_SERVICES = 3;

function ActivityTypeList() {
  const { can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: ActivityTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const canManage = can(PERMISSIONS.settingsManage);

  const activityTypes = useActivityTypes();
  const services = useServices();
  const vatCodes = useVatCodes();
  const setActive = useSetActivityTypeActive();
  const remove = useDeleteActivityType();

  const [hidden, setHidden] = usePersistentColumns('activity-types');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  /** The services whose jobs may only use this activity type (and others they list). */
  const servicesOf = (activityType: ActivityType) =>
    (services.data ?? [])
      .filter((service) => service.activity_code_ids.includes(activityType.id))
      .map((service) => service.name);

  const toggleActive = (activityType: ActivityType) => {
    setActive.mutate(
      { activityId: activityType.id, active: !activityType.is_active },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: activityType.is_active
              ? `${activityType.name} deactivated`
              : `${activityType.name} activated`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not change the activity type') }),
      },
    );
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    const activityType = dialog.activityType;
    remove.mutate(activityType.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${activityType.name} deleted`
              : `${activityType.name} deactivated instead`,
          description:
            result.outcome === 'deleted'
              ? undefined
              : 'It is used by time entries, timers or a service, so it was kept.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (activityType: ActivityType): DropdownItem[] => [
    { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', activityType }) },
    {
      id: 'toggle',
      label: activityType.is_active ? 'Deactivate' : 'Activate',
      onSelect: () => toggleActive(activityType),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', activityType });
      },
    },
  ];

  const columns: DataTableColumn<ActivityType>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (type) => type.name,
      hideable: false,
      cell: (type) => <span className="truncate font-semibold text-text">{type.name}</span>,
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (type) => type.code,
      className: 'w-28 whitespace-nowrap',
      cell: (type) => <span className="font-medium text-text-muted">{type.code}</span>,
    },
    {
      id: 'billable',
      header: 'Billable',
      sortable: true,
      sortValue: (type) => (type.is_chargeable ? 'Billable' : 'Non-billable'),
      className: 'w-36 whitespace-nowrap',
      cell: (type) => (
        <Badge tone={type.is_chargeable ? 'success' : 'neutral'} size="sm">
          {type.is_chargeable ? 'Billable' : 'Non-billable'}
        </Badge>
      ),
    },
    {
      id: 'vat',
      header: 'VAT code',
      className: 'w-40 whitespace-nowrap',
      cell: (type) => <span className="text-text">{vatName(vatCodes.data, type.vat_rate_id)}</span>,
    },
    {
      id: 'invoice',
      header: 'Invoice description',
      className: 'min-w-48 max-w-72',
      cell: (type) =>
        type.invoice_description ? (
          <span className="line-clamp-2 text-text" title={type.invoice_description}>
            {type.invoice_description}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'services',
      header: 'Linked services',
      className: 'min-w-48',
      cell: (type) => {
        const linked = servicesOf(type);
        return linked.length === 0 ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {linked.slice(0, NAMED_SERVICES).map((name) => (
              <Badge key={name} tone="grey" size="sm">
                {name}
              </Badge>
            ))}
            {linked.length > NAMED_SERVICES ? (
              <Badge tone="grey" size="sm">
                +{linked.length - NAMED_SERVICES} more
              </Badge>
            ) : null}
          </span>
        );
      },
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (type) => (type.is_active ? 'Active' : 'Inactive'),
      className: 'w-28',
      cell: (type) => <ActiveBadge active={type.is_active} />,
    },
  ];

  const all = activityTypes.data ?? [];
  const needle = searched.toLowerCase();
  const matches = all.filter(
    (type) =>
      (tab === 'all' || type.is_active === (tab === 'active')) &&
      (needle === '' ||
        [type.name, type.code, type.invoice_description].some((text) =>
          text?.toLowerCase().includes(needle),
        )),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<ActivityTab, number> = {
    all: all.length,
    active: all.filter((type) => type.is_active).length,
    inactive: all.filter((type) => !type.is_active).length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (activityTypes.isError && !activityTypes.data) {
    return (
      <LoadError
        title="Could not load the activity types"
        error={activityTypes.error}
        onRetry={() => void activityTypes.refetch()}
        retrying={activityTypes.isRefetching}
      />
    );
  }

  const target = dialog?.type === 'delete' ? dialog.activityType : null;
  const editing = dialog?.type === 'form' ? dialog.activityType : null;

  return (
    <>
      <ActivityTypeFormPanel
        open={dialog?.type === 'form'}
        activityType={editing}
        linkedServices={editing ? servicesOf(editing) : undefined}
        onClose={close}
      />
      <DataTable
        caption="Activity types"
        columns={columns}
        rows={rows}
        rowKey={(type) => type.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={activityTypes.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Activity type lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: activityTypes.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search activity types"
                placeholder="Quick search"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <ColumnVisibilityMenu
                columns={columns.map((column) => ({
                  id: column.id,
                  label: column.header,
                  locked: column.hideable === false,
                }))}
                hidden={hidden}
                onChange={setHidden}
              />
            }
            primaryAction={
              canManage ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<ListChecks aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', activityType: null })}
                >
                  Add activity type
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (type) => (
                <Dropdown
                  label={`Actions for ${type.name}`}
                  items={actionsFor(type)}
                  trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
                />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No activity types match"
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
              icon={<ListChecks className="size-6" />}
              title="No activity types yet"
              description="Activity types say what a piece of time was spent on, and whether it is billable by default."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', activityType: null })}
                  >
                    Add activity type
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length}{' '}
              {all.length === 1 ? 'activity type' : 'activity types'}
            </p>
          ) : null
        }
      />
      <ConfirmDialog
        open={target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title={target?.can_delete === false ? 'Deactivate activity type?' : 'Delete activity type?'}
        confirmLabel={target?.can_delete === false ? 'Deactivate' : 'Delete'}
        loading={remove.isPending}
        error={refusal}
      >
        {target?.can_delete === false ? (
          <p>
            <strong className="font-medium text-text">{target.name}</strong> is used by time entries
            or timers, or listed by a service, so it cannot be deleted. It will be deactivated
            instead: time already recorded keeps it, and it is no longer offered for new time.
          </p>
        ) : (
          <p>
            <strong className="font-medium text-text">{target?.name}</strong> is not used by any
            time entry, timer or service, so it will be removed completely.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/:orgSlug/team/activity-types`: what time is spent on (any member reads; `settings.manage` writes). */
export default function ActivityTypesPage() {
  useDocumentTitle('Activity Types');
  return (
    <PageShell
      title="Activity Types"
      description="What a piece of time is spent on, whether it is billable by default, and the VAT code and invoice wording that go with it."
    >
      <ActivityTypeList />
    </PageShell>
  );
}
