import { MoneyTone } from '@/components/ui/MoneyTone';
import { DonutChart } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { AgedDebtorRow, AgedDebtorTotals } from '../types';
import { linkTo, plural } from '../utils/format';
import { clientNamed, count, date, money } from './cells';

const share = (part: number, whole: number) =>
  whole > 0 ? formatBasisPoints(Math.round((part / whole) * 10_000)) : '0%';

/** What each client owes, by how late it is. */
export const agedDebtorsReport: ReportConfig<AgedDebtorRow, AgedDebtorTotals> = {
  endpoint: 'aged-debtors',
  fileName: 'aged-debtors',
  title: 'Aged Debtors',
  description: 'Outstanding balances by how late they are.',
  what: 'aged debtors report',
  access: [P.reportFinancial],
  period: 'as_at',
  filters: ['client', 'partner', 'manager'],
  rowKey: (row) => row.client_id,
  rowLabel: (row) => row.client_name,
  columns: ({ currency }) => [
    {
      id: 'client',
      header: 'Client',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.client_name,
      className: 'min-w-44 max-w-72',
      cell: (row) => clientNamed(row.client_name, row.client_code),
    },
    {
      id: 'invoices',
      header: 'Invoices',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoice_count,
      cell: (row) => count(row.invoice_count),
    },
    {
      id: 'current',
      header: 'Not yet due',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.current,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.current}>
          {money(row.current, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'days-1',
      header: '1–30 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.days_1_30,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.days_1_30}>
          {money(row.days_1_30, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'days-31',
      header: '31–60 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.days_31_60,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.days_31_60}>
          {money(row.days_31_60, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'days-61',
      header: '61–90 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.days_61_90,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.days_61_90}>
          {money(row.days_61_90, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'days-91',
      header: 'Over 90 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.days_90_plus,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.days_90_plus}>
          {money(row.days_90_plus, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'total',
      header: 'Total owed',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.total,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.total}>
          {<strong>{money(row.total, currency)}</strong>}
        </MoneyTone>
      ),
    },
    {
      id: 'oldest',
      header: 'Oldest due',
      sortable: true,
      sortValue: (row) => row.oldest_due_date,
      className: 'whitespace-nowrap',
      cell: (row) => date(row.oldest_due_date),
    },
  ],
  stats: (totals, { currency }) => {
    const overdue = totals.total - totals.current;
    return [
      {
        label: 'Total owed',
        value: formatMoney(totals.total, currency),
        hint: plural(totals.invoice_count, 'invoice', 'invoices'),
      },
      {
        label: 'Overdue',
        value: formatMoney(overdue, currency),
        hint: `${share(overdue, totals.total)} of what is owed`,
        danger: overdue > 0,
      },
      { label: 'Not yet due', value: formatMoney(totals.current, currency) },
      {
        label: 'Over 90 days overdue',
        value: formatMoney(totals.days_90_plus, currency),
        hint: `${share(totals.days_90_plus, totals.total)} of what is owed`,
        danger: totals.days_90_plus > 0,
      },
    ];
  },
  chart: ({ totals }, { currency }) => (
    <DonutChart
      title="What is owed, by how late it is"
      description="The balance of issued invoices by days past the due date."
      data={[
        { key: 'current', label: 'Not yet due', value: totals.current, color: 'success' },
        { key: 'd30', label: '1–30 days', value: totals.days_1_30, color: 'info' },
        { key: 'd60', label: '31–60 days', value: totals.days_31_60, color: 'warning' },
        { key: 'd90', label: '61–90 days', value: totals.days_61_90, color: 'orange' },
        { key: 'd91', label: 'Over 90 days', value: totals.days_90_plus, color: 'danger' },
      ]}
      valueFormatter={(value) => formatMoney(value, currency)}
      centreLabel={{ value: formatMoney(totals.total, currency), label: 'Owed' }}
      legendPlacement="end"
      emptyTitle="Nobody owes anything"
      aspect={16 / 7}
    />
  ),
  drill: (row, context) => ({
    label: 'See the debtor',
    to: linkTo(routes.org.module(context.slug, 'billing', 'debtors'), { client: row.client_id }),
  }),
  emptyTitle: 'Nobody owes anything',
  emptyDescription:
    'Clients with unpaid issued invoices are listed here, aged by how late they are.',
};
