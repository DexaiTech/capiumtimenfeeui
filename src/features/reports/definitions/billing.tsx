import { MoneyTone } from '@/components/ui/MoneyTone';
import { BarChart } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { BillingRow, BillingTotals } from '../types';
import { linkTo, plural } from '../utils/format';
import { count, money, named } from './cells';

/** What the practice invoiced, credited and received, by month or by partner. */
export const billingReport: ReportConfig<BillingRow, BillingTotals> = {
  endpoint: 'billing-summary',
  fileName: 'billing',
  title: 'Billing',
  description: 'Invoices, credit notes and receipts over time.',
  what: 'billing report',
  access: [P.reportFinancial],
  period: 'range',
  defaultPreset: 'this-year',
  groups: [
    { value: 'month', label: 'Month' },
    { value: 'partner', label: 'Partner' },
  ],
  filters: ['client', 'partner', 'manager'],
  rowKey: (row) => row.key ?? `none-${row.name}`,
  rowLabel: (row) => row.name,
  columns: ({ currency, group }) => [
    {
      id: 'name',
      header: group === 'partner' ? 'Partner' : 'Month',
      hideable: false,
      sortable: true,
      sortValue: (row) => (group === 'partner' ? row.name : row.key),
      className: 'min-w-36',
      cell: (row) => named(row.name),
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
      id: 'net',
      header: 'Invoiced (net)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoiced_net,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.invoiced_net, currency),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoiced_vat,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.invoiced_vat, currency),
    },
    {
      id: 'gross',
      header: 'Invoiced (gross)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.invoiced_gross,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.invoiced_gross, currency),
    },
    {
      id: 'credited',
      header: 'Credit notes (net)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.credited_net,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.credited_net}>
          {money(row.credited_net, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'billed',
      header: 'Net billed',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.net_billed,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="in" value={row.net_billed}>
          {<strong>{money(row.net_billed, currency)}</strong>}
        </MoneyTone>
      ),
    },
    {
      id: 'receipts',
      header: 'Receipts',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.receipts,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="in" value={row.receipts}>
          {money(row.receipts, currency, false)}
        </MoneyTone>
      ),
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Net billed',
      value: formatMoney(totals.net_billed, currency),
      hint: 'Invoiced less credit notes, before VAT',
    },
    {
      label: 'Invoiced',
      value: formatMoney(totals.invoiced_gross, currency),
      hint: `${plural(totals.invoice_count, 'invoice', 'invoices')}, including VAT`,
    },
    {
      label: 'Credited',
      value: formatMoney(totals.credited_gross, currency),
      hint: plural(totals.credit_note_count, 'credit note', 'credit notes'),
    },
    { label: 'Receipts', value: formatMoney(totals.receipts, currency), hint: 'Payments received' },
  ],
  chart: ({ rows }, { currency, group }) =>
    group === 'partner' ? null : (
      <BarChart
        title="Billed and received by month"
        description="Net of invoices less credit notes, and payments received."
        data={rows.map((row) => ({
          name: row.name,
          billed: row.net_billed,
          receipts: row.receipts,
        }))}
        xKey="name"
        series={[
          { key: 'billed', label: 'Net billed', color: 'primary' },
          { key: 'receipts', label: 'Receipts', color: 'success' },
        ]}
        legend
        yFormatter={(value) => formatMoney(value, currency)}
        tableColumns={[
          { key: 'name', label: 'Month', align: 'start' },
          { key: 'billed', label: 'Net billed', align: 'end' },
          { key: 'receipts', label: 'Receipts', align: 'end' },
        ]}
        emptyTitle="Nothing billed in these months"
        aspect={16 / 7}
      />
    ),
  drill: (row, context) =>
    row.date_from && row.date_to
      ? {
          label: 'See the invoices',
          to: linkTo(routes.org.module(context.slug, 'billing', 'invoices'), {
            from: row.date_from,
            to: row.date_to,
          }),
        }
      : null,
  emptyTitle: 'Nothing was billed',
  emptyDescription: 'Choose other dates to see invoices, credit notes and receipts.',
};
