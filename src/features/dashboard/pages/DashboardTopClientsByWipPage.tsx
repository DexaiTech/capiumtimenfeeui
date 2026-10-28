import { MoneyTone } from '@/components/ui/MoneyTone';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout';
import { SegmentedControl, Table, buttonClasses, type TableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle, useUrlParams } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import { useTopClientsByWip } from '../api';
import { PeriodSwitch } from '../components/PeriodSwitch';
import { ChangeHint, Stat, StatGrid } from '../components/Stat';
import { TopClientsChart } from '../components/TopClientsChart';
import { Widget } from '../components/Widget';
import { DEFAULT_STOCK_PERIOD, DEFAULT_TOP_CLIENTS, TOP_CLIENT_CHOICES } from '../constants';
import { usePeriodParam } from '../hooks/useDashboardParams';
import type { WipClient } from '../types';
import { formatBp, practicePath } from '../utils/format';

const signed = (pence: number) => `${pence > 0 ? '+' : ''}${formatMoney(pence)}`;

/**
 * `/:orgSlug/dashboard/top-clients-by-wip`: the clients with the most unbilled work in
 * progress as at today, ranked, with their share of the practice's WIP and how each moved since
 * the period began.
 */
export default function DashboardTopClientsByWipPage() {
  const { organization, can } = useOrg();
  useDocumentTitle('Top Clients by WIP');
  const [period, setPeriod] = usePeriodParam(DEFAULT_STOCK_PERIOD);
  const { params, setParam } = useUrlParams();
  const requested = Number(params.get('limit'));
  const limit = (TOP_CLIENT_CHOICES as ReadonlyArray<number>).includes(requested)
    ? requested
    : DEFAULT_TOP_CLIENTS;
  const query = useTopClientsByWip(limit, period);
  const wip = practicePath(organization.slug, '/wip');

  const columns: ReadonlyArray<TableColumn<WipClient>> = [
    {
      id: 'client',
      header: 'Client',
      card: 'title',
      cell: (row) =>
        can(P.clientRead) ? (
          <Link
            to={routes.org.client(organization.slug, row.client_id)}
            className="font-medium text-brand-text hover:underline"
          >
            {row.client_name}
          </Link>
        ) : (
          <span className="font-medium text-text">{row.client_name}</span>
        ),
    },
    {
      id: 'amount',
      header: 'Unbilled WIP',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMoney(row.amount)}</span>,
    },
    {
      id: 'time',
      header: 'Time',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMoney(row.time_value)}</span>,
    },
    {
      id: 'disbursements',
      header: 'Disbursements',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMoney(row.disbursement_value)}</span>,
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{formatMinutes(row.minutes)}</span>,
    },
    { id: 'oldest', header: 'Oldest item', cell: (row) => formatUkDate(row.oldest_date) },
    {
      id: 'over90',
      header: 'Over 90 days',
      align: 'end',
      cell: (row) => (
        <MoneyTone kind="out" value={row.over_90_days}>
          {<span className="tabular-nums">{formatMoney(row.over_90_days)}</span>}
        </MoneyTone>
      ),
    },
    {
      id: 'share',
      header: 'Share',
      align: 'end',
      cell: (row) => (row.share_bp === null ? '-' : formatBp(row.share_bp)),
    },
    {
      id: 'change',
      header: 'Change',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{signed(row.change)}</span>,
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Top Clients by WIP"
        description="The clients with the most unbilled work in progress, and how it has moved."
        className="mb-1"
        actions={
          <>
            <PeriodSwitch value={period} onChange={setPeriod} />
            <SegmentedControl
              label="Clients shown"
              options={TOP_CLIENT_CHOICES.map((choice) => ({
                value: String(choice),
                label: `Top ${String(choice)}`,
              }))}
              value={String(limit)}
              onChange={(next) => setParam({ limit: next })}
            />
            {wip && can(P.wipRead) ? (
              <Link to={wip} className={buttonClasses({ variant: 'outline' })}>
                Open WIP
              </Link>
            ) : null}
          </>
        }
      />
      <Widget title="Work in progress" query={query} showRefresh={false}>
        {(data) => (
          <StatGrid label="Work in progress" className="lg:grid-cols-3">
            <Stat
              label="Unbilled WIP"
              value={formatMoney(data.total)}
              hint={
                <ChangeHint
                  period={data.period}
                  unit="money"
                  comparison={{
                    basis: 'period_start',
                    previous: data.previous_total,
                    change: data.total - data.previous_total,
                    change_bp: null,
                  }}
                />
              }
            />
            <Stat label="Clients with WIP" value={String(data.client_count)} />
            <Stat
              label="Other clients"
              value={formatMoney(data.others_amount)}
              hint="Not in the list below"
            />
          </StatGrid>
        )}
      </Widget>
      <TopClientsChart query={query} />
      <Widget
        title="Clients"
        query={query}
        showRefresh={false}
        isEmpty={(data) => data.items.length === 0}
        emptyTitle="No unbilled work"
        emptyDescription="Billable time and disbursements that have not been invoiced appear here."
      >
        {(data) => (
          <Table
            caption="Clients with unbilled work"
            columns={columns}
            rows={data.items}
            rowKey={(row) => row.client_id}
          />
        )}
      </Widget>
    </section>
  );
}
