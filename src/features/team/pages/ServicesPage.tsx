import { Briefcase, Ellipsis, SearchX } from 'lucide-react';
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
import { formatMoney } from '@/utils/money';

import {
  useActivityTypes,
  useDeleteService,
  useServices,
  useSetServiceActive,
  useVatCodes,
} from '../api';
import { vatName } from '../components/catalogue/vat';
import { ServiceFormPanel } from '../components/catalogue/ServiceFormPanel';
import { ActiveBadge } from '../components/badges';
import { LoadError, PageShell } from '../components/PageShell';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { Service } from '../types';
import { describeFailure, dialogError } from '../utils/errors';

type ServiceTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: ServiceTab; label: string }> = [
  { value: 'all', label: 'All services' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS = ['name', 'code', 'basis', 'fee', 'tasks', 'status'] as const;

type DialogState =
  { type: 'form'; service: Service | null } | { type: 'delete'; service: Service } | null;

/** How many linked activity types are named in a cell before the rest are counted. */
const NAMED_TYPES = 3;

function ServiceList() {
  const { can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: ServiceTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sortId = SORTS.find((item) => item === params.get('sort'));
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';
  const canManage = can(PERMISSIONS.settingsManage);

  const services = useServices();
  const vatCodes = useVatCodes();
  const activityTypes = useActivityTypes();
  const setActive = useSetServiceActive();
  const remove = useDeleteService();

  const [hidden, setHidden] = usePersistentColumns('services');
  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const toggleActive = (service: Service) => {
    setActive.mutate(
      { serviceId: service.id, active: !service.is_active },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: service.is_active ? `${service.name} deactivated` : `${service.name} activated`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not change the service') }),
      },
    );
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    const service = dialog.service;
    remove.mutate(service.id, {
      onSuccess: (result) => {
        toast({
          tone: 'success',
          title:
            result.outcome === 'deleted'
              ? `${service.name} deleted`
              : `${service.name} deactivated instead`,
          description:
            result.outcome === 'deleted'
              ? undefined
              : 'It is used by jobs, engagements, invoices or rates, so it was kept.',
        });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (service: Service): DropdownItem[] => [
    { id: 'edit', label: 'Edit', onSelect: () => setDialog({ type: 'form', service }) },
    {
      id: 'toggle',
      label: service.is_active ? 'Deactivate' : 'Activate',
      onSelect: () => toggleActive(service),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: 'Delete',
      tone: 'danger',
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', service });
      },
    },
  ];

  const typeName = (id: string) =>
    activityTypes.data?.find((type) => type.id === id)?.name ?? 'Activity type';

  const columns: DataTableColumn<Service>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      sortValue: (service) => service.name,
      hideable: false,
      cell: (service) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{service.name}</span>
          {service.description ? (
            <span className="truncate text-xs text-text-muted" title={service.description}>
              {service.description}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      sortValue: (service) => service.code,
      className: 'w-28 whitespace-nowrap',
      cell: (service) => <span className="font-medium text-text-muted">{service.code}</span>,
    },
    {
      id: 'basis',
      header: 'Billing basis',
      sortable: true,
      sortValue: (service) => service.billing_basis,
      className: 'w-36 whitespace-nowrap',
      cell: (service) => (
        <span className="text-text">
          {service.billing_basis === 'fixed' ? 'Fixed fee' : 'Hourly'}
        </span>
      ),
    },
    {
      id: 'fee',
      header: 'Default fee',
      sortable: true,
      sortValue: (service) => service.default_fee,
      align: 'end',
      className: 'w-36 whitespace-nowrap',
      cell: (service) => (
        <span className="text-text tabular-nums">
          {service.default_fee === null ? '—' : formatMoney(service.default_fee)}
        </span>
      ),
    },
    {
      id: 'billable',
      header: 'Billable',
      className: 'w-32 whitespace-nowrap',
      cell: (service) => (
        <Badge tone={service.default_billable ? 'success' : 'neutral'} size="sm">
          {service.default_billable ? 'Billable' : 'Non-billable'}
        </Badge>
      ),
    },
    {
      id: 'vat',
      header: 'VAT code',
      className: 'w-40 whitespace-nowrap',
      cell: (service) => (
        <span className="text-text">{vatName(vatCodes.data, service.vat_rate_id)}</span>
      ),
    },
    {
      id: 'invoice',
      header: 'Invoice description',
      className: 'min-w-48 max-w-72',
      cell: (service) =>
        service.invoice_description ? (
          <span className="line-clamp-2 text-text" title={service.invoice_description}>
            {service.invoice_description}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      id: 'activity',
      header: 'Activity types',
      className: 'min-w-48',
      cell: (service) =>
        service.activity_code_ids.length === 0 ? (
          <span className="text-text-muted">All activity types</span>
        ) : (
          <span className="flex flex-wrap gap-1">
            {service.activity_code_ids.slice(0, NAMED_TYPES).map((id) => (
              <Badge key={id} tone="grey" size="sm">
                {typeName(id)}
              </Badge>
            ))}
            {service.activity_code_ids.length > NAMED_TYPES ? (
              <Badge tone="grey" size="sm">
                +{service.activity_code_ids.length - NAMED_TYPES} more
              </Badge>
            ) : null}
          </span>
        ),
    },
    {
      id: 'tasks',
      header: 'Default tasks',
      sortable: true,
      sortValue: (service) => service.task_template_count,
      align: 'end',
      className: 'w-36 whitespace-nowrap',
      cell: (service) =>
        service.task_template_count === 0 ? (
          <span className="text-text-muted">—</span>
        ) : (
          <span className="text-text tabular-nums">{service.task_template_count}</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (service) => (service.is_active ? 'Active' : 'Inactive'),
      className: 'w-28',
      cell: (service) => <ActiveBadge active={service.is_active} />,
    },
  ];

  const all = services.data ?? [];
  const needle = searched.toLowerCase();
  const matches = all.filter(
    (service) =>
      (tab === 'all' || service.is_active === (tab === 'active')) &&
      (needle === '' ||
        [service.name, service.code, service.description, service.invoice_description].some(
          (text) => text?.toLowerCase().includes(needle),
        )),
  );
  const sort: DataTableSort | null = sortId ? { columnId: sortId, direction: order } : null;
  const rows = sortRows(matches, columns, sort);
  const counts: Record<ServiceTab, number> = {
    all: all.length,
    active: all.filter((service) => service.is_active).length,
    inactive: all.filter((service) => !service.is_active).length,
  };
  const filtered = needle !== '' || tab !== 'all';

  if (services.isError && !services.data) {
    return (
      <LoadError
        title="Could not load the services"
        error={services.error}
        onRetry={() => void services.refetch()}
        retrying={services.isRefetching}
      />
    );
  }

  const target = dialog?.type === 'delete' ? dialog.service : null;

  return (
    <>
      <ServiceFormPanel
        open={dialog?.type === 'form'}
        service={dialog?.type === 'form' ? dialog.service : null}
        onClose={close}
      />
      <DataTable
        caption="Services"
        columns={columns}
        rows={rows}
        rowKey={(service) => service.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        loading={services.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Service lists"
                items={TABS.map((item) => ({
                  ...item,
                  count: services.data ? counts[item.value] : null,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search services"
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
                  leftIcon={<Briefcase aria-hidden="true" className="size-4" />}
                  onClick={() => setDialog({ type: 'form', service: null })}
                >
                  Add service
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canManage
            ? (service) => (
                <Dropdown
                  label={`Actions for ${service.name}`}
                  items={actionsFor(service)}
                  trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
                />
              )
            : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No services match"
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
              icon={<Briefcase className="size-6" />}
              title="No services yet"
              description="Services are the kinds of work the practice sells. Jobs and client engagements take their defaults from them."
              action={
                canManage ? (
                  <Button
                    variant="primary"
                    onClick={() => setDialog({ type: 'form', service: null })}
                  >
                    Add service
                  </Button>
                ) : undefined
              }
            />
          )
        }
        footer={
          rows.length > 0 ? (
            <p className="border-t border-row-border px-4 py-3 text-sm text-text-muted">
              Showing {rows.length} of {all.length} {all.length === 1 ? 'service' : 'services'}
            </p>
          ) : null
        }
      />
      <ConfirmDialog
        open={target !== null}
        onClose={close}
        onConfirm={confirmDelete}
        title={target?.can_delete === false ? 'Deactivate service?' : 'Delete service?'}
        confirmLabel={target?.can_delete === false ? 'Deactivate' : 'Delete'}
        loading={remove.isPending}
        error={refusal}
      >
        {target?.can_delete === false ? (
          <p>
            <strong className="font-medium text-text">{target.name}</strong> is used by jobs, client
            engagements, invoices or rates, so it cannot be deleted. It will be deactivated instead:
            existing jobs and engagements keep it, and it is hidden from the lists new ones are
            chosen from.
          </p>
        ) : (
          <p>
            <strong className="font-medium text-text">{target?.name}</strong> is not used by any
            job, engagement, invoice or rate, so it will be removed completely.
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

/** `/:orgSlug/team/services`: the services the practice sells (any member reads; `settings.manage` writes). */
export default function ServicesPage() {
  useDocumentTitle('Services');
  return (
    <PageShell
      title="Services"
      description="The kinds of work the practice sells, with their default billing, VAT and invoice wording, and the activity types time on them may use."
    >
      <ServiceList />
    </PageShell>
  );
}
