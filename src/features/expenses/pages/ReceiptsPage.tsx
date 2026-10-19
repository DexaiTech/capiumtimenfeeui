import {
  CircleCheck,
  Download,
  Ellipsis,
  Eye,
  Paperclip,
  SearchX,
  TriangleAlert,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';

import {
  Badge,
  Button,
  buttonClasses,
  CountTabs,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  type DataTableColumn,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useAuth } from '@/features/auth';
import { useOrg } from '@/features/organizations';
import { ClientPicker, StaffPicker } from '@/features/team';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { flattenPages, useLineList, useReceiptList } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { ReceiptPreview } from '../components/receipts/ReceiptPreview';
import { ReceiptThumb } from '../components/receipts/ReceiptThumb';
import { ClaimStatusBadge } from '../components/StatusBadge';
import { CLAIM_STATUS_META } from '../constants';
import { useDownloadReceipt } from '../hooks/useReceiptFile';
import { useUrlSearch } from '../hooks/useUrlSearch';
import {
  CLAIM_STATUSES,
  type ClaimStatus,
  type ExpenseLineListItem,
  type ReceiptFilters,
  type ReceiptListItem,
  type ReceiptSort,
  type SortOrder,
} from '../types';
import { formatFileSize } from '../utils/format';

type View = 'receipts' | 'missing';

const SORT_COLUMNS: Record<string, ReceiptSort> = {
  uploaded: 'created_at',
  date: 'incurred_on',
  amount: 'gross',
};
const COLUMN_OF_SORT: Record<ReceiptSort, string> = {
  created_at: 'uploaded',
  incurred_on: 'date',
  gross: 'amount',
};
const SORTS: ReadonlyArray<ReceiptSort> = ['created_at', 'incurred_on', 'gross'];

const isoDate = (value: string | null) =>
  value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  ...CLAIM_STATUSES.map((status) => ({ value: status, label: CLAIM_STATUS_META[status].label })),
];

/**
 * `/:orgSlug/expenses/receipts`: the receipts the caller may see, each with the expense and claim
 * it proves, and the expenses that still need one. A receipt is opened or downloaded through an
 * authenticated request (the token cannot ride on an image or a link).
 */
export default function ReceiptsPage() {
  useDocumentTitle('Receipts');
  const { organization, can } = useOrg();
  const { user } = useAuth();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { download } = useDownloadReceipt();

  const canSeeAll = can(PERMISSIONS.expenseReadAll) || can(PERMISSIONS.expenseManage);
  const canSee = canSeeAll || can(PERMISSIONS.expenseLog) || can(PERMISSIONS.expenseApprove);
  const currency = organization.currency;

  const viewParam = params.get('view');
  const view: View = viewParam === 'missing' ? 'missing' : 'receipts';
  const sortParam = SORTS.find((item) => item === params.get('sort')) ?? 'created_at';
  const orderParam = params.get('order');
  const order: SortOrder = orderParam === 'asc' || orderParam === 'desc' ? orderParam : 'desc';
  const status = CLAIM_STATUSES.find((item) => item === params.get('status')) ?? null;
  const userId = params.get('user_id');
  const clientId = params.get('client_id');
  const dateFrom = isoDate(params.get('date_from'));
  const dateTo = isoDate(params.get('date_to'));

  const receiptFilters: ReceiptFilters = {
    status: status ? [status] : undefined,
    user_id: userId ?? undefined,
    client_id: clientId ?? undefined,
    date_from: dateFrom ?? undefined,
    date_to: dateTo ?? undefined,
    q: searched || undefined,
    sort: sortParam,
    order,
  };
  const receipts = useReceiptList(receiptFilters, { enabled: canSee && view === 'receipts' });
  const missing = useLineList(
    {
      needs_receipt: true,
      status: status ? [status] : undefined,
      user_id: userId ?? undefined,
      client_id: clientId ?? undefined,
      date_from: dateFrom ?? undefined,
      date_to: dateTo ?? undefined,
      q: searched || undefined,
      sort: 'incurred_on',
      order: 'asc',
    },
    { enabled: canSee && view === 'missing' },
  );

  const [previewing, setPreviewing] = useState<ReceiptListItem | null>(null);

  const receiptRows = flattenPages(receipts.data);
  const missingRows = flattenPages(missing.data);
  const activeFilters =
    Number(status !== null) +
    Number(userId !== null) +
    Number(clientId !== null) +
    Number(dateFrom !== null) +
    Number(dateTo !== null);
  const filtered = searched !== '' || activeFilters > 0;

  /** The list a claim opens from: one's own, else the one the role may use. */
  const claimLink = (claimId: string, claimantId: string) => {
    const list =
      claimantId === user?.id && can(PERMISSIONS.expenseLog)
        ? 'mine'
        : canSeeAll
          ? 'claims'
          : 'approvals';
    return routes.org.expenseClaim(organization.slug, claimId, list);
  };

  const claimCell = (item: {
    claim_id: string;
    user_id: string;
    claim_title: string | null;
    claim_status: ClaimStatus;
  }) => (
    <div className="flex min-w-0 flex-col items-start gap-1">
      <Link
        to={claimLink(item.claim_id, item.user_id)}
        className="max-w-full truncate font-medium text-text hover:text-brand-text hover:underline"
      >
        {item.claim_title ?? 'Open the claim'}
      </Link>
      <ClaimStatusBadge status={item.claim_status} />
    </div>
  );

  const receiptColumns: DataTableColumn<ReceiptListItem>[] = [
    {
      id: 'receipt',
      header: 'Receipt',
      hideable: false,
      className: 'min-w-56 max-w-72',
      cell: (item) => (
        <div className="flex min-w-0 items-center gap-3">
          <ReceiptThumb lineId={item.expense_id} receipt={item} />
          <div className="flex min-w-0 flex-col items-start">
            <button
              type="button"
              onClick={() => setPreviewing(item)}
              aria-label={`Preview ${item.file_name}`}
              className="max-w-full truncate rounded-sm text-left font-semibold text-text hover:text-brand-text hover:underline"
            >
              {item.file_name}
            </button>
            <span className="text-xs text-text-muted">{formatFileSize(item.size_bytes)}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'expense',
      header: 'Expense',
      className: 'min-w-48 max-w-64',
      cell: (item) => (
        <span className="block truncate text-text" title={item.description}>
          {item.description}
        </span>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      className: 'w-28 whitespace-nowrap',
      cell: (item) => formatUkDate(item.incurred_on),
    },
    { id: 'claim', header: 'Claim', className: 'min-w-44', cell: claimCell },
    {
      id: 'claimant',
      header: 'Claimant',
      className: 'min-w-36',
      cell: (item) => item.user_name ?? '—',
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-36',
      cell: (item) =>
        item.client ? item.client.name : <span className="text-text-muted">No client</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      sortable: true,
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (item) => (
        <span className="font-semibold tabular-nums">{formatMoney(item.gross, currency)}</span>
      ),
    },
    {
      id: 'uploaded',
      header: 'Uploaded',
      sortable: true,
      className: 'min-w-36 whitespace-nowrap',
      cell: (item) => (
        <div className="flex flex-col">
          <span>{formatUkDate(item.created_at)}</span>
          <span className="text-xs text-text-muted">{item.uploaded_by_name ?? ''}</span>
        </div>
      ),
    },
  ];

  const missingColumns: DataTableColumn<ExpenseLineListItem>[] = [
    {
      id: 'expense',
      header: 'Expense',
      hideable: false,
      className: 'min-w-56 max-w-80',
      cell: (line) => (
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-semibold text-text" title={line.description}>
            {line.description}
          </span>
          <span className="text-xs text-text-muted">{line.expense_type.name}</span>
        </div>
      ),
    },
    {
      id: 'date',
      header: 'Date',
      className: 'w-28 whitespace-nowrap',
      cell: (line) => formatUkDate(line.incurred_on),
    },
    { id: 'claim', header: 'Claim', className: 'min-w-44', cell: claimCell },
    {
      id: 'claimant',
      header: 'Claimant',
      className: 'min-w-36',
      cell: (line) => line.user_name ?? '—',
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-36',
      cell: (line) =>
        line.client ? line.client.name : <span className="text-text-muted">No client</span>,
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'w-28 whitespace-nowrap',
      cell: (line) => (
        <span className="font-semibold tabular-nums">{formatMoney(line.gross, currency)}</span>
      ),
    },
    {
      id: 'needed',
      header: 'Receipt',
      className: 'w-36',
      cell: () => (
        <Badge tone="red" size="sm" icon={<TriangleAlert aria-hidden="true" className="size-3" />}>
          Needed
        </Badge>
      ),
    },
  ];

  const receiptActions = (item: ReceiptListItem): DropdownItem[] => [
    {
      id: 'preview',
      label: 'Preview',
      icon: <Eye aria-hidden="true" className="size-4" />,
      onSelect: () => setPreviewing(item),
    },
    {
      id: 'download',
      label: 'Download',
      icon: <Download aria-hidden="true" className="size-4" />,
      onSelect: () => void download(item.expense_id, item),
    },
  ];

  const resetFilters = () => {
    setSearchText('');
    setParam({
      q: null,
      status: null,
      user_id: null,
      client_id: null,
      date_from: null,
      date_to: null,
    });
  };

  if (!canSee) return <NoAccess what="seeing expense receipts" />;

  const filterPanel = (
    <FilterPopover
      title="Filter receipts"
      count={activeFilters}
      onClear={() =>
        setParam({ status: null, user_id: null, client_id: null, date_from: null, date_to: null })
      }
    >
      <Select
        label="Claim status"
        options={STATUS_OPTIONS}
        value={status ?? ''}
        onChange={(event) => setParam({ status: event.target.value || null })}
      />
      {canSeeAll ? (
        <StaffPicker
          label="Claimant"
          clearable
          includeLeft
          value={userId}
          onChange={(id) => setParam({ user_id: id })}
        />
      ) : null}
      {can(PERMISSIONS.clientRead) ? (
        <ClientPicker
          label="Client"
          clearable
          value={clientId}
          onChange={(id) => setParam({ client_id: id })}
        />
      ) : null}
      <DateRangeField
        label="Dates of the expenses"
        value={{ from: dateFrom, to: dateTo }}
        onChange={(range) => setParam({ date_from: range.from, date_to: range.to })}
      />
    </FilterPopover>
  );

  const toolbar = (
    <PageToolbar
      start={
        <CountTabs
          label="Receipt views"
          items={[
            { value: 'receipts', label: 'Receipts' },
            { value: 'missing', label: 'Missing receipts' },
          ]}
          value={view}
          onChange={(value) => setParam({ view: value === 'receipts' ? null : value })}
        />
      }
      search={
        <SearchField
          label="Search receipts"
          placeholder="Quick search"
          value={searchText}
          onChange={setSearchText}
        />
      }
      actions={filterPanel}
    />
  );

  return (
    <PageShell
      title="Receipts"
      description="The receipts attached to expenses, and the expenses that are above the receipt limit and still have none."
    >
      {view === 'receipts' ? (
        receipts.isError && !receipts.data ? (
          <LoadError
            title="Could not load the receipts"
            error={receipts.error}
            onRetry={() => void receipts.refetch()}
            retrying={receipts.isRefetching}
          />
        ) : (
          <DataTable
            caption="Receipts"
            columns={receiptColumns}
            rows={receiptRows}
            rowKey={(item) => item.id}
            sort={{ columnId: COLUMN_OF_SORT[sortParam], direction: order }}
            onSortChange={(next) => {
              const key = SORT_COLUMNS[next.columnId];
              if (key) setParam({ sort: key, order: next.direction });
            }}
            loading={receipts.isPending}
            toolbar={toolbar}
            rowActions={(item) => (
              <Dropdown
                label={`Actions for ${item.file_name}`}
                items={receiptActions(item)}
                trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
              />
            )}
            empty={
              filtered ? (
                <EmptyState
                  icon={<SearchX className="size-6" />}
                  title="No receipts match"
                  description="Try a different search or filter."
                  action={<Button onClick={resetFilters}>Clear filters</Button>}
                />
              ) : (
                <EmptyState
                  icon={<Paperclip className="size-6" />}
                  title="No receipts yet"
                  description="Receipts attached to expense claims appear here."
                />
              )
            }
            footer={
              receiptRows.length > 0 ? (
                <div className="border-t border-row-border px-4 py-3">
                  <Pagination
                    hasMore={receipts.hasNextPage}
                    onLoadMore={() => void receipts.fetchNextPage()}
                    loading={receipts.isFetchingNextPage}
                    count={receiptRows.length}
                    itemLabel={['receipt', 'receipts']}
                  />
                </div>
              ) : undefined
            }
          />
        )
      ) : missing.isError && !missing.data ? (
        <LoadError
          title="Could not load the expenses without a receipt"
          error={missing.error}
          onRetry={() => void missing.refetch()}
          retrying={missing.isRefetching}
        />
      ) : (
        <DataTable
          caption="Expenses that need a receipt"
          columns={missingColumns}
          rows={missingRows}
          rowKey={(line) => line.id}
          loading={missing.isPending}
          toolbar={toolbar}
          rowActions={(line) => (
            <Link
              to={claimLink(line.claim_id, line.user_id)}
              aria-label={`Add a receipt for ${line.description}`}
              className={buttonClasses({ variant: 'outline', size: 'sm' })}
            >
              <Paperclip aria-hidden="true" className="size-4" />
              Add receipt
            </Link>
          )}
          empty={
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No expenses match"
                description="Try a different search or filter."
                action={<Button onClick={resetFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<CircleCheck className="size-6" />}
                title="Every expense has its receipt"
                description="No expense above the receipt limit is waiting for one."
              />
            )
          }
          footer={
            missingRows.length > 0 ? (
              <div className="border-t border-row-border px-4 py-3">
                <Pagination
                  hasMore={missing.hasNextPage}
                  onLoadMore={() => void missing.fetchNextPage()}
                  loading={missing.isFetchingNextPage}
                  count={missingRows.length}
                  itemLabel={['expense', 'expenses']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      {previewing ? (
        <ReceiptPreview
          lineId={previewing.expense_id}
          receipt={previewing}
          open
          onClose={() => setPreviewing(null)}
        />
      ) : null}
    </PageShell>
  );
}
