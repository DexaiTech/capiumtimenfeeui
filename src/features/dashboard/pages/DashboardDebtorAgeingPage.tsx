import { MoneyTone } from '@/components/ui/MoneyTone';
import { Link } from 'react-router';

import { PageHeader } from '@/components/layout';
import { Table, buttonClasses, type TableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { useOrg } from '@/features/organizations';
import { useDocumentTitle } from '@/hooks';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { useDebtorAgeing } from '../api';
import { DebtorAgeingChart } from '../components/DebtorAgeingChart';
import { PeriodSwitch } from '../components/PeriodSwitch';
import { ChangeHint, Stat, StatGrid } from '../components/Stat';
import { Widget } from '../components/Widget';
import { BUCKET_META, DEFAULT_STOCK_PERIOD, DEFAULT_TOP_CLIENTS } from '../constants';
import { usePeriodParam } from '../hooks/useDashboardParams';
import type { DebtorRow } from '../types';
import { practicePath } from '../utils/format';

const money = (pence: number) => <span className="tabular-nums">{formatMoney(pence)}</span>;

/**
 * `/:orgSlug/dashboard/debtor-ageing`: what clients owe, by how late it is, the clients that
 * owe the most overdue, and how the overdue balance moved since the period began.
 */
export default function DashboardDebtorAgeingPage() {
  const { organization, can, canAny } = useOrg();
  useDocumentTitle('Debtor Ageing');
  const [period, setPeriod] = usePeriodParam(DEFAULT_STOCK_PERIOD);
  const query = useDebtorAgeing(DEFAULT_TOP_CLIENTS, period);
  const debtors = practicePath(organization.slug, '/billing/debtors');

  const columns: ReadonlyArray<TableColumn<DebtorRow>> = [
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
      id: 'invoices',
      header: 'Invoices',
      align: 'end',
      cell: (row) => <span className="tabular-nums">{String(row.invoice_count)}</span>,
    },
    {
      id: 'total',
      header: 'Owed',
      align: 'end',
      cell: (row) => (
        <MoneyTone kind="out" value={row.total}>
          {money(row.total)}
        </MoneyTone>
      ),
    },
    {
      id: 'overdue',
      header: 'Overdue',
      align: 'end',
      cell: (row) => (
        <MoneyTone kind="out" value={row.overdue}>
          {money(row.overdue)}
        </MoneyTone>
      ),
    },
    ...(['current', 'days_1_30', 'days_31_60', 'days_61_90', 'days_90_plus'] as const).map(
      (key): TableColumn<DebtorRow> => ({
        id: key,
        header: BUCKET_META[key].label,
        align: 'end',
        cell: (row) => (
          <MoneyTone kind="out" value={row[key]}>
            {money(row[key])}
          </MoneyTone>
        ),
      }),
    ),
    {
      id: 'oldest',
      header: 'Oldest overdue',
      cell: (row) => (row.oldest_due_date ? formatUkDate(row.oldest_due_date) : '-'),
    },
  ];

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <PageHeader
        title="Debtor Ageing"
        description="What clients owe, by how late it is, and who owes the most."
        className="mb-1"
        actions={
          <>
            <PeriodSwitch value={period} onChange={setPeriod} />
            {debtors && canAny([P.paymentRead, P.invoiceRead]) ? (
              <Link to={debtors} className={buttonClasses({ variant: 'outline' })}>
                Open Debtors
              </Link>
            ) : null}
          </>
        }
      />
      <Widget title="Money owed" query={query} showRefresh={false}>
        {(data) => (
          <StatGrid label="Money owed">
            <Stat label="Total owed" value={formatMoney(data.total)} />
            <Stat
              label="Overdue"
              value={formatMoney(data.overdue_total)}
              hint={
                <ChangeHint
                  period={data.period}
                  unit="money"
                  better="down"
                  comparison={{
                    basis: 'period_start',
                    previous: data.previous_overdue_total,
                    change: data.overdue_total - data.previous_overdue_total,
                    change_bp: null,
                  }}
                />
              }
            />
            <Stat label="Invoices with a balance" value={String(data.invoice_count)} />
            <Stat label="Clients that owe" value={String(data.debtor_count)} />
          </StatGrid>
        )}
      </Widget>
      <DebtorAgeingChart query={query} />
      <Widget
        title="Biggest overdue balances"
        query={query}
        showRefresh={false}
        isEmpty={(data) => data.top_debtors.length === 0}
        emptyTitle="No one owes anything"
        emptyDescription="Clients with an outstanding balance on an issued invoice appear here."
      >
        {(data) => (
          <Table
            caption="Clients that owe the most"
            columns={columns}
            rows={data.top_debtors}
            rowKey={(row) => row.client_id}
          />
        )}
      </Widget>
    </section>
  );
}
