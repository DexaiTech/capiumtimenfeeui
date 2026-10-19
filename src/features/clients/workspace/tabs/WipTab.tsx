import { Hourglass } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router';

import { HorizontalBarList, type HorizontalBarItem } from '@/components/charts';
import {
  Badge,
  DataTable,
  EmptyState,
  PageToolbar,
  Pagination,
  Select,
  Skeleton,
  sortRows,
  type DataTableColumn,
  type DataTableSort,
} from '@/components/ui';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { formatUkDate, todayInZone } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useClientWip } from '../../api';
import { AGEING_BUCKETS, WIP_ITEMS_PAGE } from '../constants';
import { LoadError } from '../records/RecordTable';
import { SummaryStrip } from '../records/SummaryStrip';
import type { WipItem } from '../types';
import { ageingOf, groupByJob, type JobWip } from '../wip';

export interface WipTabProps {
  clientId: string;
  clientName: string;
}

const NO_ITEMS: WipItem[] = [];

/**
 * The client's work in progress (`GET /clients/{id}/wip`, `wip.read`): the totals, the WIP per
 * job, the ageing and every item. The API returns the whole list in one go, so the job filter,
 * the sort and "Show more" work on the client.
 */
export function WipTab({ clientId, clientName }: WipTabProps) {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const wip = useClientWip(clientId);
  const [shown, setShown] = useState(WIP_ITEMS_PAGE);
  const [sort, setSort] = useState<DataTableSort | null>(null);
  const slug = organization.slug;
  const currency = organization.currency;
  const today = todayInZone(organization.timezone);
  const items = wip.data?.items ?? NO_ITEMS;

  const jobs = useMemo(() => groupByJob(items), [items]);
  const ageing = useMemo(() => ageingOf(items, today), [items, today]);
  const jobFilter = jobs.some((entry) => entry.key === params.get('job'))
    ? (params.get('job') ?? '')
    : '';

  if (wip.isPending) {
    return (
      <div role="status" aria-label="Loading work in progress" className="flex flex-col gap-3">
        <Skeleton shape="rect" className="h-20 w-full" />
        <Skeleton shape="rect" className="h-64 w-full" />
      </div>
    );
  }
  if (wip.isError) {
    return (
      <LoadError
        title="Could not load the work in progress"
        error={wip.error}
        onRetry={() => void wip.refetch()}
        retrying={wip.isRefetching}
      />
    );
  }

  const { totals } = wip.data;
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface shadow-card">
        <EmptyState
          icon={<Hourglass className="size-6" />}
          title="No work in progress"
          description={`Unbilled time and expenses for ${clientName} will be listed here.`}
        />
      </div>
    );
  }

  const money = (pence: number) => formatMoney(pence, currency);
  const byJobColumns: DataTableColumn<JobWip>[] = [
    {
      id: 'job',
      header: 'Job',
      cell: (entry) =>
        entry.job ? (
          <Link
            to={routes.org.job(slug, entry.job.id)}
            className="font-semibold text-brand-text hover:underline"
          >
            {entry.job.number}
            <span className="ml-1.5 font-normal text-text-muted">{entry.job.name}</span>
          </Link>
        ) : (
          <span className="text-text-muted">No job</span>
        ),
    },
    { id: 'items', header: 'Items', align: 'end', cell: (entry) => entry.items },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'tabular-nums',
      cell: (entry) => (entry.minutes > 0 ? formatMinutes(entry.minutes) : '—'),
    },
    {
      id: 'value',
      header: 'WIP',
      align: 'end',
      className: 'tabular-nums',
      cell: (entry) => money(entry.value),
    },
    {
      id: 'share',
      header: 'Share',
      align: 'end',
      className: 'tabular-nums',
      cell: (entry) =>
        totals.total > 0 ? `${Math.round((entry.value / totals.total) * 100)}%` : '—',
    },
  ];

  const itemColumns: DataTableColumn<WipItem>[] = [
    {
      id: 'date',
      header: 'Date',
      sortable: true,
      sortValue: (item) => item.date,
      className: 'whitespace-nowrap',
      cell: (item) => formatUkDate(item.date),
    },
    {
      id: 'kind',
      header: 'Type',
      cell: (item) => (
        <Badge tone={item.kind === 'time' ? 'violet' : 'orange'} size="sm">
          {item.kind === 'time' ? 'Time' : 'Expense'}
        </Badge>
      ),
    },
    {
      id: 'job',
      header: 'Job',
      cell: (item) =>
        item.job ? (
          `${item.job.number} ${item.job.name}`
        ) : (
          <span className="text-text-muted">No job</span>
        ),
    },
    {
      id: 'detail',
      header: 'Description',
      cell: (item) => {
        const text = item.description ?? item.supplier;
        return (
          <span className="block max-w-64 truncate" title={text ?? undefined}>
            {[item.person?.full_name, text].filter(Boolean).join(' · ') || '—'}
          </span>
        );
      },
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      className: 'tabular-nums',
      cell: (item) => (item.minutes === null ? '—' : formatMinutes(item.minutes)),
    },
    {
      id: 'rate',
      header: 'Rate',
      align: 'end',
      className: 'whitespace-nowrap tabular-nums',
      cell: (item) => (item.rate === null ? '—' : `${money(item.rate)} / h`),
    },
    {
      id: 'value',
      header: 'Value',
      align: 'end',
      sortable: true,
      sortValue: (item) => item.value,
      className: 'tabular-nums',
      cell: (item) => money(item.value),
    },
  ];

  const matching = jobFilter
    ? items.filter((item) => (item.job?.id ?? 'none') === jobFilter)
    : items;
  const rows = sortRows(matching, itemColumns, sort).slice(0, shown);
  const barItems: HorizontalBarItem[] = AGEING_BUCKETS.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    value: ageing[bucket.key],
    color: bucket.color,
  }));

  return (
    <div className="flex flex-col gap-4">
      <SummaryStrip
        label="WIP totals"
        items={[
          { label: 'Total WIP', value: money(totals.total), hint: `${items.length} items` },
          {
            label: 'Time',
            value: money(totals.time_value),
            hint: `${formatMinutes(totals.minutes)} logged`,
          },
          { label: 'Expenses', value: money(totals.disbursement_value) },
        ]}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <DataTable
          caption={`WIP by job for ${clientName}`}
          columns={byJobColumns}
          rows={jobs}
          rowKey={(entry) => entry.key}
        />
        <HorizontalBarList
          title="WIP ageing"
          items={barItems}
          valueFormatter={money}
          className="self-start"
        />
      </div>
      <DataTable
        caption={`WIP items of ${clientName}`}
        columns={itemColumns}
        rows={rows}
        rowKey={(item) => `${item.kind}-${item.id}`}
        sort={sort}
        onSortChange={setSort}
        toolbar={
          <PageToolbar
            start={<h2 className="px-2 text-sm font-semibold text-text">WIP items</h2>}
            actions={
              <Select
                label="Job"
                hideLabel
                options={[
                  { value: '', label: 'All jobs' },
                  ...jobs.map((entry) => ({
                    value: entry.key,
                    label: entry.job ? `${entry.job.number} ${entry.job.name}` : 'No job',
                  })),
                ]}
                value={jobFilter}
                onChange={(event) => {
                  setShown(WIP_ITEMS_PAGE);
                  setParam({ job: event.target.value });
                }}
                className="w-full sm:w-64"
              />
            }
          />
        }
        footer={
          <div className="border-t border-row-border px-4 py-2">
            <Pagination
              hasMore={matching.length > rows.length}
              onLoadMore={() => setShown((count) => count + WIP_ITEMS_PAGE)}
              count={rows.length}
              itemLabel={['item', 'items']}
              loadMoreLabel="Show more"
            />
          </div>
        }
      />
    </div>
  );
}
