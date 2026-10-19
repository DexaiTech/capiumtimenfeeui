import { Ellipsis, Pencil, Plus, Power, SearchX, Tags, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  CountTabs,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  useToast,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { modulePath, ORG_SEGMENTS } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useVatCodes } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import {
  flattenPages,
  useDeleteExpenseType,
  useExpenseSettings,
  useExpenseTypeList,
  useSaveExpenseType,
} from '../api';
import { ExpenseTypeFormDialog } from '../components/ExpenseTypeFormDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ActiveBadge } from '../components/StatusBadge';
import { useUrlSearch } from '../hooks/useUrlSearch';
import type { ExpenseType, TypeFilters, TypeSort } from '../types';
import { describeFailure, dialogError } from '../utils/errors';
import { formatRatePerMile } from '../utils/format';

type TypeTab = 'all' | 'active' | 'inactive';
const TABS: ReadonlyArray<{ value: TypeTab; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const SORTS: ReadonlyArray<TypeSort> = ['name', 'code'];

type DialogState =
  | { type: 'form'; expenseType: ExpenseType | null }
  | { type: 'delete'; expenseType: ExpenseType }
  | null;

/**
 * `/:orgSlug/expenses/types`: what an expense can be for. Everyone who records or reads
 * expenses sees the list; `expense.manage` adds, changes, deactivates and deletes. A type that
 * expenses use is deactivated, never deleted. The practice-wide settings that price expenses
 * (mileage rate, markup, receipt limit) are shown here and changed in the practice settings.
 */
export default function ExpenseTypesPage() {
  useDocumentTitle('Expense Types');
  const { organization, can } = useOrg();
  const { toast } = useToast();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const settings = useExpenseSettings();

  const canRead =
    can(PERMISSIONS.expenseLog) ||
    can(PERMISSIONS.expenseReadAll) ||
    can(PERMISSIONS.expenseManage);
  const canManage = can(PERMISSIONS.expenseManage);
  const tabParam = params.get('tab');
  const tab: TypeTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const sort = SORTS.find((item) => item === params.get('sort')) ?? 'name';
  const order = params.get('order') === 'desc' ? 'desc' : 'asc';

  const filters: TypeFilters = {
    q: searched || undefined,
    is_active: tab === 'all' ? undefined : tab === 'active',
    sort,
    order,
  };
  const list = useExpenseTypeList(filters, { enabled: canRead });
  const vatCodes = useVatCodes({ enabled: canRead });
  const save = useSaveExpenseType();
  const remove = useDeleteExpenseType();

  const [dialog, setDialog] = useState<DialogState>(null);
  const [refusal, setRefusal] = useState<{ message: string; requestId?: string } | null>(null);
  const close = () => setDialog(null);

  const rows = flattenPages(list.data);
  const filtered = searched !== '' || tab !== 'all';

  const toggleActive = (type: ExpenseType) => {
    save.mutate(
      { mode: 'update', typeId: type.id, body: { is_active: !type.is_active } },
      {
        onSuccess: () =>
          toast({
            tone: 'success',
            title: type.is_active ? `${type.name} deactivated` : `${type.name} activated`,
          }),
        onError: (error) =>
          toast({ tone: 'error', ...describeFailure(error, 'Could not change the expense type') }),
      },
    );
  };

  const confirmDelete = () => {
    if (dialog?.type !== 'delete') return;
    const type = dialog.expenseType;
    remove.mutate(type.id, {
      onSuccess: () => {
        toast({ tone: 'success', title: `${type.name} deleted` });
        close();
      },
      onError: (error) => setRefusal(dialogError(error)),
    });
  };

  const actionsFor = (type: ExpenseType): DropdownItem[] => [
    {
      id: 'edit',
      label: 'Edit',
      icon: <Pencil aria-hidden="true" className="size-4" />,
      onSelect: () => setDialog({ type: 'form', expenseType: type }),
    },
    {
      id: 'toggle',
      label: type.is_active ? 'Deactivate' : 'Activate',
      icon: <Power aria-hidden="true" className="size-4" />,
      onSelect: () => toggleActive(type),
    },
    { id: 'separator', separator: true },
    {
      id: 'delete',
      label: type.can_delete ? 'Delete' : 'Delete (in use)',
      tone: 'danger',
      icon: <Trash2 aria-hidden="true" className="size-4" />,
      disabled: !type.can_delete,
      onSelect: () => {
        setRefusal(null);
        setDialog({ type: 'delete', expenseType: type });
      },
    },
  ];

  const vatName = (id: string | null) => {
    if (!id) return 'None';
    const code = vatCodes.data?.find((entry) => entry.id === id);
    return code ? `${code.name} (${formatBasisPoints(code.rate_bp)})` : 'VAT code';
  };

  const columns: DataTableColumn<ExpenseType>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      hideable: false,
      className: 'min-w-44',
      cell: (type) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text">{type.name}</span>
          {type.is_used ? <span className="text-xs text-text-muted">Used by expenses</span> : null}
        </div>
      ),
    },
    {
      id: 'code',
      header: 'Code',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (type) => <span className="font-medium text-text-muted">{type.code}</span>,
    },
    {
      id: 'vat',
      header: 'Default VAT code',
      className: 'min-w-44',
      cell: (type) => <span className="text-text">{vatName(type.default_vat_rate_id)}</span>,
    },
    {
      id: 'pricing',
      header: 'Priced from',
      className: 'w-36 whitespace-nowrap',
      cell: (type) => (
        <Badge tone={type.is_mileage ? 'blue' : 'grey'} size="sm">
          {type.is_mileage ? 'Miles' : 'Amount'}
        </Badge>
      ),
    },
    {
      id: 'billable',
      header: 'Billable',
      className: 'w-32 whitespace-nowrap',
      cell: (type) => (
        <Badge tone={type.default_billable ? 'green' : 'grey'} size="sm">
          {type.default_billable ? 'By default' : 'Not by default'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'w-28',
      cell: (type) => <ActiveBadge active={type.is_active} />,
    },
  ];

  if (!canRead) return <NoAccess what="viewing expense types" />;

  return (
    <PageShell
      title="Expense Types"
      description="What an expense can be for. The type sets the default VAT code and whether the amount is priced from miles."
    >
      <Card padding="sm">
        <dl aria-label="How expenses are priced" className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-muted">Mileage rate</dt>
            <dd className="text-sm font-semibold text-text">
              {settings.mileageRate === null ? '—' : formatRatePerMile(settings.mileageRate)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-muted">Markup on recharged expenses</dt>
            <dd className="text-sm font-semibold text-text">
              {settings.markupBp === null ? '—' : formatBasisPoints(settings.markupBp)}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-xs text-text-muted">Receipt needed above</dt>
            <dd className="text-sm font-semibold text-text">
              {settings.receiptThreshold === null
                ? '—'
                : formatMoney(settings.receiptThreshold, organization.currency)}
            </dd>
          </div>
        </dl>
        {can(PERMISSIONS.organizationUpdate) ? (
          <p className="mt-3 text-xs text-text-muted">
            These apply to the whole practice. Change them in the{' '}
            <Link
              to={modulePath(organization.slug, ORG_SEGMENTS.settings, 'practice')}
              className="font-semibold text-brand-text hover:underline"
            >
              practice settings
            </Link>
            .
          </p>
        ) : null}
      </Card>
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the expense types"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Expense types"
          columns={columns}
          rows={rows}
          rowKey={(type) => type.id}
          sort={{ columnId: sort, direction: order }}
          onSortChange={(next) => {
            if (SORTS.some((item) => item === next.columnId)) {
              setParam({ sort: next.columnId, order: next.direction });
            }
          }}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Expense type lists"
                  items={TABS.map((item) => ({ value: item.value, label: item.label }))}
                  value={tab}
                  onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
                />
              }
              search={
                <SearchField
                  label="Search expense types"
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
                    onClick={() => setDialog({ type: 'form', expenseType: null })}
                  >
                    Add expense type
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
                title="No expense types match"
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
                title="No expense types yet"
                description="Expense types say what an expense is for. Add the first one to let staff record expenses."
                action={
                  canManage ? (
                    <Button
                      variant="primary"
                      onClick={() => setDialog({ type: 'form', expenseType: null })}
                    >
                      Add expense type
                    </Button>
                  ) : undefined
                }
              />
            )
          }
          footer={
            rows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-3">
                <Pagination
                  hasMore={list.hasNextPage}
                  onLoadMore={() => void list.fetchNextPage()}
                  loading={list.isFetchingNextPage}
                  count={rows.length}
                  itemLabel={['expense type', 'expense types']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <ExpenseTypeFormDialog
        type={dialog?.type === 'form' ? dialog.expenseType : null}
        open={dialog?.type === 'form'}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.type === 'delete'}
        onClose={close}
        onConfirm={confirmDelete}
        title="Delete this expense type?"
        confirmLabel="Delete expense type"
        loading={remove.isPending}
        error={refusal}
      >
        <p>
          {dialog?.type === 'delete' ? dialog.expenseType.name : ''} will be removed. An expense
          type that expenses use cannot be deleted: deactivate it instead.
        </p>
      </ConfirmDialog>
    </PageShell>
  );
}
