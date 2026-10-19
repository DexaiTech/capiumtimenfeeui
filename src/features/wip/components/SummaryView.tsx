import { Hourglass, SearchX } from 'lucide-react';
import { useState } from 'react';

import {
  Button,
  ColumnVisibilityMenu,
  CountTabs,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  SearchField,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import { summaryRows, summaryTotals, useWipSummary } from '../api';
import { AGE_BUCKETS, GROUP_META } from '../constants';
import { useUrlSearch } from '../hooks/useUrlSearch';
import { CLEARED_FILTERS, useWipFilters } from '../hooks/useWipFilters';
import {
  SUMMARY_SORTS,
  WIP_GROUPS,
  type SortOrder,
  type SummaryFilters,
  type SummarySort,
  type WipGroupTotals,
} from '../types';
import { FilterPopover } from './FilterPopover';
import { LoadError } from './PageShell';
import { StatCards, type Stat } from './StatCards';
import { ageingColumns, summaryColumns } from './summaryColumns';
import { WipFilterFields } from './WipFilterFields';

export type SummaryVariant = 'summary' | 'ageing';

const share = (part: number, whole: number) =>
  whole > 0 ? formatBasisPoints(Math.round((part / whole) * 10_000)) : '0%';

function summaryStats(totals: WipGroupTotals, currency: string): Stat[] {
  return [
    { label: 'Time WIP', value: formatMoney(totals.time, currency), hint: `${totals.hours} hours` },
    {
      label: 'Fixed fee WIP',
      value: formatMoney(totals.fixed_fee, currency),
      hint: 'Recognised fixed fees not yet billed',
    },
    {
      label: 'Expense WIP',
      value: formatMoney(totals.expense, currency),
      hint: 'Disbursements and approved expenses',
    },
    {
      label: 'Total WIP',
      value: formatMoney(totals.total, currency),
      hint: totals.oldest_date
        ? `${String(totals.item_count)} items, the oldest from ${formatUkDate(totals.oldest_date)}`
        : 'Nothing to bill',
    },
  ];
}

function ageingStats(totals: WipGroupTotals, currency: string): Stat[] {
  return [
    ...AGE_BUCKETS.map((bucket): Stat => ({
      label: bucket.label,
      value: formatMoney(totals.ages[bucket.key], currency),
      hint: `${share(totals.ages[bucket.key], totals.total)} of the WIP`,
      danger: bucket.key === 'days_90_plus' && totals.ages.days_90_plus > 0,
    })),
    {
      label: 'Total WIP',
      value: formatMoney(totals.total, currency),
      hint: `${String(totals.item_count)} items`,
    },
  ];
}

/** The body of WIP Summary and WIP Ageing: the same grouped WIP, read for what each page asks. */
export function SummaryView({ variant }: { variant: SummaryVariant }) {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const { text: searchText, setText: setSearchText, searched } = useUrlSearch();
  const { filters: base, active, setFilters, clear } = useWipFilters();

  const group = WIP_GROUPS.find((item) => item === params.get('group')) ?? 'client';
  const sort: SummarySort =
    SUMMARY_SORTS.find((item) => item === params.get('sort')) ??
    (variant === 'ageing' ? 'over_90' : 'total');
  const orderParam = params.get('order');
  const order: SortOrder =
    orderParam === 'asc' || orderParam === 'desc' ? orderParam : sort === 'name' ? 'asc' : 'desc';

  const filters: SummaryFilters = {
    ...base,
    group_by: group,
    q: searched || undefined,
    sort,
    order,
  };
  const list = useWipSummary(filters);
  const rows = summaryRows(list.data);
  const totals = summaryTotals(list.data);

  const [hidden, setHidden] = useState<ReadonlySet<string>>(
    () => new Set(variant === 'summary' ? ['hours'] : []),
  );
  const filtered = searched !== '' || active > 0;
  const currency = organization.currency;

  const columnOptions = { slug: organization.slug, currency, group };
  const columns =
    variant === 'ageing' ? ageingColumns(columnOptions) : summaryColumns(columnOptions);
  const noun = GROUP_META[group].items;

  const clearAll = () => {
    setSearchText('');
    setParam({ q: null, ...CLEARED_FILTERS });
  };

  return (
    <>
      {totals ? (
        <StatCards
          label={variant === 'ageing' ? 'WIP by age' : 'Figures of the WIP'}
          stats={
            variant === 'ageing' ? ageingStats(totals, currency) : summaryStats(totals, currency)
          }
          className={variant === 'ageing' ? 'lg:grid-cols-5' : undefined}
        />
      ) : null}
      {list.isError && !list.data ? (
        <LoadError
          title="Could not load the work in progress"
          error={list.error}
          onRetry={() => void list.refetch()}
          retrying={list.isRefetching}
        />
      ) : (
        <DataTable
          caption={variant === 'ageing' ? 'WIP ageing' : 'WIP summary'}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.key ?? `none:${row.name}`}
          sort={{ columnId: sort, direction: order }}
          onSortChange={(next) => setParam({ sort: next.columnId, order: next.direction })}
          hiddenColumns={hidden}
          loading={list.isPending}
          toolbar={
            <PageToolbar
              start={
                <CountTabs
                  label="Group WIP by"
                  items={WIP_GROUPS.map((item) => ({ value: item, label: GROUP_META[item].tab }))}
                  value={group}
                  onChange={(value) => setParam({ group: value === 'client' ? null : value })}
                />
              }
              search={
                <SearchField
                  label="Search WIP"
                  placeholder="Name or code"
                  value={searchText}
                  onChange={setSearchText}
                />
              }
              actions={
                <>
                  <FilterPopover title="Filter WIP" count={active} onClear={clear}>
                    <WipFilterFields value={base} onChange={setFilters} />
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
                title="No WIP matches"
                description="Try a different search or filter."
                action={<Button onClick={clearAll}>Clear filters</Button>}
              />
            ) : (
              <EmptyState
                icon={<Hourglass className="size-6" />}
                title="No work in progress"
                description="Billable time, disbursements and approved expenses appear here until they are billed."
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
                  itemLabel={noun}
                />
              </div>
            ) : undefined
          }
        />
      )}
    </>
  );
}
