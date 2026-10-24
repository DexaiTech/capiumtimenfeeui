import { CreditCard, Ellipsis, Plus, SearchX } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  DateRangeField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Select,
  sortRows,
  type DataTableSort,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { ClientPicker } from '@/features/clients';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';

import { flattenPages, usePaymentList } from '../api';
import { FilterPopover } from '../components/FilterPopover';
import { paymentColumns } from '../components/payments/paymentColumns';
import { PaymentDetailDialog } from '../components/payments/PaymentDetailDialog';
import { LoadError, NoAccess, PageShell } from '../components/PageShell';
import { RecordPaymentPanel } from '../components/RecordPaymentPanel';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATE_LABELS } from '../constants';
import { isoDateParam, oneOf, useUrlSearch } from '../hooks/useUrlSearch';
import {
  PAYMENT_METHODS,
  type Payment,
  type PaymentListFilters,
  type PaymentMethod,
  type PaymentState,
} from '../types';
import { dateCell } from '../utils/format';

type PaymentTab = 'all' | PaymentState | 'on_account';

const TABS: ReadonlyArray<{ value: PaymentTab; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'unallocated', label: PAYMENT_STATE_LABELS.unallocated.label },
  { value: 'part_allocated', label: PAYMENT_STATE_LABELS.part_allocated.label },
  { value: 'allocated', label: PAYMENT_STATE_LABELS.allocated.label },
  { value: 'on_account', label: 'On account' },
  { value: 'void', label: PAYMENT_STATE_LABELS.void.label },
];

const METHOD_OPTIONS = [
  { value: '', label: 'Any method' },
  ...PAYMENT_METHODS.map((method) => ({ value: method, label: PAYMENT_METHOD_LABELS[method] })),
];

function PaymentList() {
  const { organization, can } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();

  const tabParam = params.get('tab');
  const tab: PaymentTab = TABS.find((item) => item.value === tabParam)?.value ?? 'all';
  const clientId = params.get('client') ?? '';
  const method: PaymentMethod | undefined = oneOf(params.get('method'), PAYMENT_METHODS);
  const from = isoDateParam(params.get('from'));
  const to = isoDateParam(params.get('to'));

  const filters = useMemo<PaymentListFilters>(
    () => ({
      client_id: clientId || undefined,
      method: method ? [method] : undefined,
      state: tab === 'all' ? undefined : tab,
      date_from: from || undefined,
      date_to: to || undefined,
      q: searched || undefined,
    }),
    [clientId, method, tab, from, to, searched],
  );
  const payments = usePaymentList(filters);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [openId, setOpenId] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const columns = useMemo(() => paymentColumns(organization.currency), [organization.currency]);
  const sortParam = params.get('sort');
  const orderParam = params.get('order');
  const sort = useMemo<DataTableSort | null>(
    () =>
      columns.some((column) => column.id === sortParam && column.sortable)
        ? { columnId: sortParam ?? '', direction: orderParam === 'desc' ? 'desc' : 'asc' }
        : null,
    [columns, sortParam, orderParam],
  );
  const loaded = useMemo(() => flattenPages(payments.data), [payments.data]);
  const rows = useMemo(() => sortRows(loaded, columns, sort), [loaded, columns, sort]);

  const canRecord = can(P.paymentRecord);
  const filterCount = (clientId ? 1 : 0) + (method ? 1 : 0) + (from || to ? 1 : 0);
  const filtered = Boolean(searched) || tab !== 'all' || filterCount > 0;
  const count = payments.data && !payments.hasNextPage ? loaded.length : undefined;

  if (payments.isError && !payments.data) {
    return (
      <LoadError
        title="Could not load the payments"
        error={payments.error}
        onRetry={() => void payments.refetch()}
        retrying={payments.isRefetching}
      />
    );
  }

  const clearFilters = () => {
    setSearchText('');
    setParam({ q: null, tab: null, client: null, method: null, from: null, to: null });
  };
  const rowLabel = (payment: Payment) =>
    `${payment.client?.name ?? 'client'} payment of ${dateCell(payment.received_on)}`;
  const actionsFor = (payment: Payment): DropdownItem[] => [
    { id: 'open', label: 'View and allocate', onSelect: () => setOpenId(payment.id) },
  ];

  return (
    <>
      <RecordPaymentPanel open={recording} onClose={() => setRecording(false)} />
      <DataTable
        caption="Payments"
        columns={columns}
        rows={rows}
        rowKey={(payment) => payment.id}
        sort={sort}
        onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
        hiddenColumns={hidden}
        onRowClick={(payment) => setOpenId(payment.id)}
        loading={payments.isPending}
        toolbar={
          <PageToolbar
            start={
              <CountTabs
                label="Payment statuses"
                items={TABS.map((item) => ({
                  ...item,
                  count: item.value === tab ? count : undefined,
                }))}
                value={tab}
                onChange={(value) => setParam({ tab: value === 'all' ? null : value })}
              />
            }
            search={
              <SearchField
                label="Search payments"
                placeholder="Search reference or notes"
                value={searchText}
                onChange={setSearchText}
              />
            }
            actions={
              <>
                <FilterPopover
                  title="Filter payments"
                  count={filterCount}
                  onClear={() => setParam({ client: null, method: null, from: null, to: null })}
                >
                  {can(P.clientRead) ? (
                    <ClientPicker
                      label="Client"
                      value={clientId || null}
                      onChange={(client) => setParam({ client: client?.id ?? null })}
                      listPlacement="inline"
                    />
                  ) : null}
                  <Select
                    label="Method"
                    options={METHOD_OPTIONS}
                    value={method ?? ''}
                    onChange={(event) => setParam({ method: event.target.value })}
                  />
                  <DateRangeField
                    label="Date received"
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
              canRecord ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={() => setRecording(true)}
                >
                  Record payment
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={(payment) => (
          <Dropdown
            label={`Actions for ${rowLabel(payment)}`}
            items={actionsFor(payment)}
            trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
          />
        )}
        empty={
          filtered ? (
            <EmptyState
              icon={<SearchX className="size-6" />}
              title="No payments match"
              description="Try a different search, status or date range."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <EmptyState
              icon={<CreditCard className="size-6" />}
              title="No payments yet"
              description="Money received from clients, and the invoices it pays, is listed here."
              action={
                canRecord ? (
                  <Button variant="primary" onClick={() => setRecording(true)}>
                    Record payment
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
                hasMore={payments.hasNextPage}
                onLoadMore={() => void payments.fetchNextPage()}
                loading={payments.isFetchingNextPage}
                count={rows.length}
                itemLabel={['payment', 'payments']}
              />
            </div>
          ) : null
        }
      />
      <PaymentDetailDialog paymentId={openId} onClose={() => setOpenId(null)} />
    </>
  );
}

/** `/:orgSlug/billing/payments`: money received, how it was allocated, and what is on account. */
export default function PaymentsPage() {
  const { can } = useOrg();
  useDocumentTitle('Payments');
  return (
    <PageShell
      title="Payments"
      description="Record money received, allocate it to invoices (oldest first by default) and correct mistakes."
    >
      {can(P.paymentRead) ? <PaymentList /> : <NoAccess what="payments" />}
    </PageShell>
  );
}
