import { BarChart } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { PaymentReportRow, PaymentReportTotals } from '../types';
import { linkTo, plural } from '../utils/format';
import { count, money, named } from './cells';

/** Money received, by month, client or method: what was allocated and what is on account. */
export const paymentsReport: ReportConfig<PaymentReportRow, PaymentReportTotals> = {
  endpoint: 'payments',
  fileName: 'payments',
  title: 'Payments',
  description: 'Receipts by method, client and period.',
  what: 'payments report',
  access: [P.reportFinancial],
  period: 'range',
  defaultPreset: 'this-year',
  groups: [
    { value: 'month', label: 'Month' },
    { value: 'client', label: 'Client' },
    { value: 'method', label: 'Method' },
  ],
  filters: ['client', 'method', 'partner', 'manager'],
  rowKey: (row) => row.key ?? `none-${row.name}`,
  rowLabel: (row) => row.name,
  columns: ({ currency, group }) => [
    {
      id: 'name',
      header: group === 'client' ? 'Client' : group === 'method' ? 'Method' : 'Month',
      hideable: false,
      sortable: true,
      sortValue: (row) => (group === 'month' ? row.key : row.name),
      className: 'min-w-40',
      cell: (row) => named(row.name, row.code),
    },
    {
      id: 'payments',
      header: 'Payments',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.payment_count,
      cell: (row) => count(row.payment_count),
    },
    {
      id: 'received',
      header: 'Received',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.received,
      className: 'whitespace-nowrap',
      cell: (row) => <strong>{money(row.received, currency)}</strong>,
    },
    {
      id: 'allocated',
      header: 'Allocated to invoices',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.allocated,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.allocated, currency, false),
    },
    {
      id: 'on-account',
      header: 'On account',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.on_account,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.on_account, currency, false),
    },
    {
      id: 'void',
      header: 'Voided or reversed',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.void_amount,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.void_count === 0 ? (
          money(0, currency, false)
        ) : (
          <div className="flex flex-col items-end">
            {money(row.void_amount, currency)}
            <span className="text-xs text-text-muted">
              {plural(row.void_count, 'payment', 'payments')}
            </span>
          </div>
        ),
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Received',
      value: formatMoney(totals.received, currency),
      hint: plural(totals.payment_count, 'payment', 'payments'),
    },
    { label: 'Allocated', value: formatMoney(totals.allocated, currency), hint: 'To invoices' },
    {
      label: 'On account',
      value: formatMoney(totals.on_account, currency),
      hint: 'Received, not allocated',
    },
    {
      label: 'Voided or reversed',
      value: formatMoney(totals.void_amount, currency),
      hint: plural(totals.void_count, 'payment', 'payments'),
      danger: totals.void_count > 0,
    },
  ],
  chart: ({ rows }, { currency, group }) =>
    group === 'month' ? (
      <BarChart
        title="Received by month"
        description="Payments allocated to invoices, and payments held on account."
        data={rows.map((row) => ({
          name: row.name,
          allocated: row.allocated,
          on_account: row.on_account,
        }))}
        xKey="name"
        series={[
          { key: 'allocated', label: 'Allocated', color: 'success' },
          { key: 'on_account', label: 'On account', color: 'warning' },
        ]}
        stacked
        legend
        yFormatter={(value) => formatMoney(value, currency)}
        tableColumns={[
          { key: 'name', label: 'Month', align: 'start' },
          { key: 'allocated', label: 'Allocated', align: 'end' },
          { key: 'on_account', label: 'On account', align: 'end' },
        ]}
        emptyTitle="No payments in these months"
        aspect={16 / 7}
      />
    ) : null,
  drill: (row, context, period) => {
    const base = routes.org.module(context.slug, 'billing', 'payments');
    return {
      label: 'See the payments',
      to: linkTo(base, {
        client: row.client_id,
        method: row.method,
        from: row.date_from ?? period.from,
        to: row.date_to ?? period.to,
      }),
    };
  },
  emptyTitle: 'No payments were received',
  emptyDescription: 'Choose other dates to see what was received.',
};
