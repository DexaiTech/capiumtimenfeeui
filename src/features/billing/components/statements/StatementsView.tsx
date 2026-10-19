import { Banknote, Download, Ellipsis, FileText, Mail, SearchX, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import {
  Button,
  Card,
  ColumnVisibilityMenu,
  DataTable,
  Dropdown,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
  Switch,
  type DropdownItem,
} from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { todayInZone } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { billingApi, statementsView, useStatementList, type StatementSortState } from '../../api';
import { useBalanceFilters } from '../../hooks/useBalanceFilters';
import { useFileDownload } from '../../hooks/useFileDownload';
import { oneOf, useUrlSearch } from '../../hooks/useUrlSearch';
import type { StatementListFilters, StatementRow, StatementSort } from '../../types';
import { plural } from '../../utils/format';
import { defaultStatementFrom } from '../../utils/statementPeriod';
import { BalanceFilterFields } from '../BalanceFilterFields';
import { FilterPopover } from '../FilterPopover';
import { LoadError } from '../PageShell';
import { StatCards, type Stat } from '../StatCards';
import { SendStatementDialog, type StatementSendTarget } from './SendStatementDialog';
import { StatementDialog } from './StatementDialog';
import { statementColumns } from './statementColumns';

const SORTS: ReadonlyArray<StatementSort> = ['client', 'balance', 'overdue', 'last_sent'];

// One URL update clears them all: two in a row would drop the first.
const CLEARED_FILTERS = {
  client: null,
  partner: null,
  manager: null,
  min: null,
  overdue: null,
  never: null,
} as const;

const sendClient = (row: StatementRow) => ({
  id: row.client.id,
  name: row.client.name,
  hasRecipient: row.has_recipient,
});

/** The clients with a balance, with their statements to read, download and email. */
export function StatementsView() {
  const { organization, can } = useOrg();
  const navigate = useNavigate();
  const { params, setParam } = useUrlParams();
  const filters = useBalanceFilters();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { busy, download } = useFileDownload();
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);

  const sort = oneOf(params.get('sort'), SORTS) ?? 'client';
  const orderParam = params.get('order');
  const order: StatementSortState['order'] =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'client' ? 'asc' : 'desc';
  const overdueOnly = params.get('overdue') === '1';
  const neverSent = params.get('never') === '1';
  const openClient = params.get('statement');

  const query: StatementListFilters = {
    client_id: filters.client ?? undefined,
    partner_user_id: filters.partner ?? undefined,
    manager_user_id: filters.manager ?? undefined,
    min_balance: filters.minPence ?? undefined,
    overdue_only: overdueOnly || undefined,
    never_sent: neverSent || undefined,
    q: searched || undefined,
  };
  const list = useStatementList(query, { sort, order });
  const { rows, first } = statementsView(list.data);
  const totals = first?.totals;

  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set());
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  const [sending, setSending] = useState<StatementSendTarget | null>(null);

  const canSend = can(P.paymentRecord);
  const columns = statementColumns({ currency });
  const chosen = rows.filter((row) => selected.has(row.client.id));
  const filterCount = filters.active + (overdueOnly ? 1 : 0) + (neverSent ? 1 : 0);
  const filtered = filterCount > 0 || Boolean(searched);

  const stats: Stat[] = totals
    ? [
        {
          label: 'Clients',
          value: String(totals.client_count),
          hint: 'With a balance or cash on account',
        },
        {
          label: 'Outstanding',
          value: formatMoney(totals.outstanding, currency),
          hint: 'On issued invoices',
        },
        {
          label: 'Overdue',
          value: formatMoney(totals.overdue, currency),
          hint: 'Past the due date',
          danger: totals.overdue > 0,
        },
        {
          label: 'Cash on account',
          value: formatMoney(totals.on_account, currency),
          hint: 'Received, not allocated',
        },
      ]
    : [];

  const pdfOf = (row: StatementRow) =>
    download(row.client.id, `statement-${row.client.code}-${today}.pdf`, () =>
      billingApi.statementPdf(organization.id, row.client.id, {
        from: defaultStatementFrom(today),
        to: today,
      }),
    );

  const clearFilters = () => {
    setSearchText('');
    setParam({ ...CLEARED_FILTERS, q: null });
  };

  const rowActions = (row: StatementRow) => {
    const items: DropdownItem[] = [
      {
        id: 'view',
        label: 'View the statement',
        icon: <FileText aria-hidden="true" className="size-4" />,
        onSelect: () => setParam({ statement: row.client.id }),
      },
      {
        id: 'pdf',
        label: busy === row.client.id ? 'Preparing the PDF…' : 'Download the PDF',
        icon: <Download aria-hidden="true" className="size-4" />,
        disabled: busy !== null,
        onSelect: () => void pdfOf(row),
      },
    ];
    if (canSend) {
      items.push({
        id: 'email',
        label: 'Email the statement',
        icon: <Mail aria-hidden="true" className="size-4" />,
        onSelect: () => setSending({ clients: [sendClient(row)] }),
      });
    }
    if (can(P.clientRead)) {
      items.push({
        id: 'client',
        label: 'Open the client',
        icon: <UserRound aria-hidden="true" className="size-4" />,
        onSelect: () => void navigate(routes.org.client(organization.slug, row.client.id)),
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
      {totals ? <StatCards label="Statement figures" stats={stats} /> : null}

      {chosen.length > 0 ? (
        <Card padding="sm" className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-text" aria-live="polite">
            {plural(chosen.length, 'client', 'clients')} selected
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => setSelected(new Set())}>
              Clear selection
            </Button>
            <Button
              size="sm"
              variant="primary"
              leftIcon={<Mail aria-hidden="true" className="size-4" />}
              onClick={() => setSending({ clients: chosen.map(sendClient) })}
            >
              Email statements
            </Button>
          </div>
        </Card>
      ) : null}

      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the statements"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption="Client statements"
          columns={columns}
          rows={rows}
          rowKey={(row) => row.client.id}
          sort={{ columnId: sort, direction: order }}
          onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
          hiddenColumns={hidden}
          loading={list.isPending}
          selectable={canSend}
          selected={selected}
          onSelectedChange={setSelected}
          selectLabel={(row) => `Select ${row.client.name}`}
          onRowClick={(row) => setParam({ statement: row.client.id })}
          rowActions={rowActions}
          toolbar={
            <PageToolbar
              search={
                <SearchField
                  label="Search clients"
                  placeholder="Search by client name or code"
                  value={searchText}
                  onChange={setSearchText}
                />
              }
              actions={
                <>
                  <FilterPopover
                    title="Filter the statements"
                    count={filterCount}
                    onClear={() => setParam(CLEARED_FILTERS)}
                  >
                    <Switch
                      label="Only clients with overdue invoices"
                      checked={overdueOnly}
                      onChange={(checked) => setParam({ overdue: checked ? '1' : null })}
                    />
                    <Switch
                      label="Only clients never sent a statement"
                      checked={neverSent}
                      onChange={(checked) => setParam({ never: checked ? '1' : null })}
                    />
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
            filtered ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title="No clients match"
                description="Try different filters or another search."
                action={<Button onClick={clearFilters}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Banknote className="size-6" />}
                title="No statements to send"
                description="Clients with an unpaid issued invoice, or cash received on account, are listed here."
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

      <StatementDialog
        clientId={openClient}
        onClose={() => setParam({ statement: null })}
        onSend={
          canSend
            ? (client, period) => {
                const row = rows.find((entry) => entry.client.id === client.id);
                setParam({ statement: null });
                setSending({
                  clients: [
                    { id: client.id, name: client.name, hasRecipient: row?.has_recipient ?? true },
                  ],
                  period,
                });
              }
            : undefined
        }
      />
      <SendStatementDialog
        target={sending}
        onClose={() => setSending(null)}
        onSent={(clientIds) =>
          setSelected((current) => new Set([...current].filter((id) => !clientIds.includes(id))))
        }
      />
    </>
  );
}
