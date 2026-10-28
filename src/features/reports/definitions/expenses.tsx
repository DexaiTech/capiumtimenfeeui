import { MoneyTone } from '@/components/ui/MoneyTone';
import { HorizontalBarList } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { ExpenseReportRow, ExpenseReportTotals } from '../types';
import { linkTo, plural, words } from '../utils/format';
import { count, money, named } from './cells';

const GROUP_TITLES: Record<string, string> = {
  type: 'Expense type',
  person: 'Claimant',
  client: 'Client',
  job: 'Job',
  month: 'Month',
  status: 'Claim status',
};

/** Expense lines by type, claimant, client, job, month or claim status. */
export const expensesReport: ReportConfig<ExpenseReportRow, ExpenseReportTotals> = {
  endpoint: 'expenses',
  fileName: 'expenses',
  title: 'Expenses',
  description: 'Expenses and disbursements by type, client and person.',
  what: 'expenses report',
  access: [P.reportRead, P.reportFinancial],
  period: 'range',
  defaultPreset: 'this-year',
  groups: [
    { value: 'type', label: 'Expense type' },
    { value: 'person', label: 'Claimant' },
    { value: 'client', label: 'Client' },
    { value: 'job', label: 'Job' },
    { value: 'month', label: 'Month' },
    { value: 'status', label: 'Claim status' },
  ],
  filters: ['client', 'job', 'user'],
  personLabel: 'Claimant',
  rowKey: (row) => row.key ?? `none-${row.name}`,
  rowLabel: (row) => row.name,
  columns: ({ currency, group }) => [
    {
      id: 'name',
      header: GROUP_TITLES[group ?? 'type'] ?? 'Group',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name,
      className: 'min-w-44 max-w-80',
      cell: (row) =>
        named(
          group === 'status' ? words(row.claim_status ?? row.name) : row.name,
          [row.code, row.client_name].filter(Boolean).join(' · '),
        ),
    },
    {
      id: 'lines',
      header: 'Lines',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.line_count,
      cell: (row) => count(row.line_count),
    },
    {
      id: 'net',
      header: 'Net',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.net,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.net, currency),
    },
    {
      id: 'vat',
      header: 'VAT',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.vat,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.vat, currency),
    },
    {
      id: 'gross',
      header: 'Gross',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.gross,
      className: 'whitespace-nowrap',
      cell: (row) => <strong>{money(row.gross, currency)}</strong>,
    },
    {
      id: 'billable',
      header: 'Billable (net)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.billable_net,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.billable_net, currency, false),
    },
    {
      id: 'recharge',
      header: 'To recharge',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.recharge_amount,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.recharge_amount}>
          {money(row.recharge_amount, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'recharged',
      header: 'Recharged',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.recharged_amount,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="in" value={row.recharged_amount}>
          {money(row.recharged_amount, currency, false)}
        </MoneyTone>
      ),
    },
    {
      id: 'reimburse',
      header: 'To reimburse',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.reimbursable,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.reimbursable}>
          {money(row.reimbursable, currency, false)}
        </MoneyTone>
      ),
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Gross',
      value: formatMoney(totals.gross, currency),
      hint: plural(totals.line_count, 'expense line', 'expense lines'),
    },
    {
      label: 'Net',
      value: formatMoney(totals.net, currency),
      hint: `${formatMoney(totals.vat, currency)} VAT`,
    },
    {
      label: 'To recharge clients',
      value: formatMoney(totals.recharge_amount, currency),
      hint: `${formatMoney(totals.recharged_amount, currency)} already invoiced`,
    },
    {
      label: 'To reimburse',
      value: formatMoney(totals.reimbursable, currency),
      hint: 'Paid by staff out of their own pocket',
    },
  ],
  chart: ({ rows }, { currency, group }) => (
    <HorizontalBarList
      title={`Expenses by ${(GROUP_TITLES[group ?? 'type'] ?? 'group').toLowerCase()}`}
      items={[...rows]
        .sort((a, b) => b.gross - a.gross)
        .slice(0, 10)
        .map((row, index) => ({
          key: row.key ?? `none-${String(index)}`,
          label: group === 'status' ? words(row.claim_status ?? row.name) : row.name,
          value: row.gross,
          color: 'primary' as const,
        }))}
      valueFormatter={(value) => formatMoney(value, currency)}
      emptyTitle="No expenses in these dates"
    />
  ),
  drill: (row, context, period) => {
    const base = routes.org.module(context.slug, 'expenses');
    if (row.client_id) {
      return {
        label: 'See the claims',
        to: linkTo(base, { client_id: row.client_id, date_from: period.from, date_to: period.to }),
      };
    }
    if (row.user_id) {
      return {
        label: 'See the claims',
        to: linkTo(base, { user_id: row.user_id, date_from: period.from, date_to: period.to }),
      };
    }
    return null;
  },
  note: 'Figures count expense lines by the day they were incurred, whatever the state of their claim; the claim status grouping shows how far each claim has got.',
  emptyTitle: 'No expenses in these dates',
  emptyDescription: 'Choose other dates to see what was claimed.',
};
