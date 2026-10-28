import { Banknote, Ellipsis, FileText, Mail, SearchX, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  Card,
  ColumnVisibilityMenu,
  DataTable,
  DateField,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { usePersistentColumns, useUrlParams } from '@/hooks';
import { todayInZone } from '@/utils/dates';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { debtorsView, useDebtors, type DebtorSortState } from '../../api';
import { useBalanceFilters } from '../../hooks/useBalanceFilters';
import { isoDateParam, oneOf } from '../../hooks/useUrlSearch';
import type { ClientRef, DebtorFilters, DebtorRow, DebtorSort } from '../../types';
import { plural } from '../../utils/format';
import { BalanceFilterFields } from '../BalanceFilterFields';
import { FilterPopover } from '../FilterPopover';
import { LoadError } from '../PageShell';
import { StatCards, type Stat } from '../StatCards';
import { AgeingSummary } from './AgeingSummary';
import { DebtorInvoicesDialog } from './DebtorInvoicesDialog';
import { debtorColumns } from './debtorColumns';
import { ReminderDialog, type ReminderTarget } from './ReminderDialog';

const SORTS: ReadonlyArray<DebtorSort> = [
  'client',
  'total',
  'current',
  'days_1_30',
  'days_31_60',
  'days_61_90',
  'days_90_plus',
  'oldest_due',
];

const share = (part: number, whole: number) =>
  whole > 0 ? formatBasisPoints(Math.round((part / whole) * 10_000)) : '0%';

/** Who owes the practice money as at a day, by how late it is, with the means to chase it. */
export function DebtorsView() {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { params, setParam } = useUrlParams();
  const filters = useBalanceFilters();
  const slug = organization.slug;
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);

  const asAtParam = isoDateParam(params.get('as_at'));
  const asAt = asAtParam || today;
  const sort = oneOf(params.get('sort'), SORTS) ?? 'total';
  const orderParam = params.get('order');
  const order: DebtorSortState['order'] =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'client' ? 'asc' : 'desc';

  const query: DebtorFilters = {
    as_at: asAtParam || undefined,
    client_id: filters.client ?? undefined,
    partner_user_id: filters.partner ?? undefined,
    manager_user_id: filters.manager ?? undefined,
    min_balance: filters.minPence ?? undefined,
  };
  const list = useDebtors(query, { sort, order });
  const { rows, first } = debtorsView(list.data);
  const totals = first?.totals;

  const [hidden, setHidden] = usePersistentColumns('debtors', ['ageing']);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [drilling, setDrilling] = useState<ClientRef | null>(null);
  const [reminding, setReminding] = useState<ReminderTarget | null>(null);

  const canRemind = can(P.paymentRecord);
  const canStatement = can(P.invoiceRead) && can(P.paymentRead);
  const columns = debtorColumns({ currency });
  const chosen = rows.filter((row) => selected.has(row.client.id));
  const chosenTotal = chosen.reduce((sum, row) => sum + row.total, 0);

  const stats: Stat[] = totals
    ? [
        {
          label: 'Total owed',
          value: formatMoney(totals.total, currency),
          tone: totals.total > 0 ? 'out' : undefined,
          hint: `${plural(totals.client_count, 'client', 'clients')}, ${plural(totals.invoice_count, 'invoice', 'invoices')}`,
        },
        {
          label: 'Overdue',
          value: formatMoney(totals.overdue, currency),
          hint: `${share(totals.overdue, totals.total)} of what is owed`,
          danger: totals.overdue > 0,
        },
        {
          label: 'Current',
          value: formatMoney(totals.current, currency),
          tone: totals.current > 0 ? 'out' : undefined,
          hint: 'Not yet due',
        },
        {
          label: 'Over 90 days overdue',
          value: formatMoney(totals.days_90_plus, currency),
          hint: `${share(totals.days_90_plus, totals.total)} of what is owed`,
          danger: totals.days_90_plus > 0,
        },
      ]
    : [];

  const rowActions = (row: DebtorRow) => {
    const items: DropdownItem[] = [
      {
        id: 'invoices',
        label: 'See the invoices',
        icon: <FileText aria-hidden="true" className="size-4" />,
        onSelect: () => setDrilling(row.client),
      },
    ];
    if (canRemind && row.overdue > 0) {
      items.push({
        id: 'remind',
        label: 'Send a reminder',
        icon: <Mail aria-hidden="true" className="size-4" />,
        onSelect: () => setReminding({ clientIds: [row.client.id], label: row.client.name }),
      });
    }
    if (canStatement) {
      items.push({
        id: 'statement',
        label: 'View the statement',
        icon: <Banknote aria-hidden="true" className="size-4" />,
        onSelect: () =>
          void navigate(
            `${routes.org.module(slug, 'billing', 'statements')}?statement=${encodeURIComponent(row.client.id)}`,
          ),
      });
    }
    if (can(P.clientRead)) {
      items.push({
        id: 'client',
        label: 'Open the client',
        icon: <UserRound aria-hidden="true" className="size-4" />,
        onSelect: () => void navigate(routes.org.client(slug, row.client.id)),
      });
    }
    return (
      <Dropdown
        label={`Actions for ${row.client.name}`}
        items={items}
        trigger={<Ellipsis aria-hidden="true" className="size-5 text-text-muted" />}
      />
    );
  };

  return (
    <>
      {totals ? <StatCards label="Debtor figures" stats={stats} /> : null}
      {totals ? <AgeingSummary amounts={totals} currency={currency} /> : null}

      {chosen.length > 0 ? (
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text" aria-live="polite">
            {plural(chosen.length, 'client', 'clients')} selected,{' '}
            {formatMoney(chosenTotal, currency)} owed
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Mail aria-hidden="true" className="size-4" />}
              onClick={() =>
                setReminding({
                  clientIds: chosen.map((row) => row.client.id),
                  label: plural(chosen.length, 'client', 'clients'),
                })
              }
            >
              Send reminders
            </Button>
          </div>
        </Card>
      ) : null}

      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the debtors"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Debtors"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.client.id}
          sort={{ columnId: sort, direction: order }}
          onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
          hiddenColumns={hidden}
          loading={list.isPending}
          selectable={canRemind}
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(row) => `Select ${row.client.name}`}
          onRowClick={(row) => setDrilling(row.client)}
          rowActions={rowActions}
          toolbar={
            <PageToolbar
              start={
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">As at</span>
                  <DateField
                    label="As at date"
                    hideLabel
                    max={today}
                    value={asAt}
                    onChange={(value) =>
                      setParam({ as_at: value && value !== today ? value : null })
                    }
                  />
                  {asAtParam ? (
                    <Button size="sm" variant="ghost" onClick={() => setParam({ as_at: null })}>
                      Today
                    </Button>
                  ) : null}
                </div>
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter the debtors"
                    count={filters.active}
                    onClear={filters.clear}
                  >
                    <BalanceFilterFields filters={filters} />
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
            />
          }
          empty={
            filters.active > 0 ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No debtors match"
                description="Try different filters."
                action={<Button onClick={filters.clear}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Banknote className="size-6" />}
                title="Nobody owes anything"
                description="Clients with unpaid issued invoices are listed here, aged by how late they are."
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
                  itemLabel={['client', 'clients']}
                />
              </div>
            ) : undefined
          }
        />
      )}

      <DebtorInvoicesDialog
        client={drilling}
        asAt={asAt}
        onClose={() => setDrilling(null)}
        onRemind={
          canRemind
            ? (invoiceIds, label) => {
                setDrilling(null);
                setReminding({ invoiceIds, label });
              }
            : undefined
        }
      />
      <ReminderDialog
        target={reminding}
        onClose={() => setReminding(null)}
        onSent={() => setSelected(new Set())}
      />
    </>
  );
}
