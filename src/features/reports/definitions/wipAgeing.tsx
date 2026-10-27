import { DonutChart } from '@/components/charts';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { WipReportRow, WipReportTotals } from '../types';
import { linkTo } from '../utils/format';
import { date, money, named, clientNamed } from './cells';

const share = (part: number, whole: number) =>
  whole > 0 ? formatBasisPoints(Math.round((part / whole) * 10_000)) : '0%';

/** The unbilled work of every client and job, aged by the date of each item. */
export const wipAgeingReport: ReportConfig<WipReportRow, WipReportTotals> = {
  endpoint: 'wip',
  fileName: 'wip',
  title: 'WIP & Ageing',
  description: 'Work in progress with its age.',
  what: 'work in progress report',
  access: [P.reportFinancial],
  period: 'as_at',
  formats: ['csv'],
  filters: ['client', 'job', 'user', 'partner', 'manager', 'service'],
  rowKey: (row) => `${row.client_id}:${row.job_id ?? 'none'}`,
  rowLabel: (row) => `${row.client_name}${row.job_name ? `, ${row.job_name}` : ''}`,
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
      id: 'job',
      header: 'Job',
      sortable: true,
      sortValue: (row) => row.job_name,
      className: 'min-w-44 max-w-72',
      cell: (row) => named(row.job_name ?? 'No job', row.job_number),
    },
    {
      id: 'time',
      header: 'Time',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.time_value,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end">
          {money(row.time_value, currency)}
          <span className="text-xs text-text-muted">{formatMinutes(row.minutes)}</span>
        </div>
      ),
    },
    {
      id: 'disbursements',
      header: 'Disbursements',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.disbursement_value,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.disbursement_value, currency, false),
    },
    {
      id: 'total',
      header: 'Total',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.total,
      className: 'whitespace-nowrap',
      cell: (row) => <strong>{money(row.total, currency)}</strong>,
    },
    {
      id: 'age-0',
      header: '0–30 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.age_0_30,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.age_0_30, currency, false),
    },
    {
      id: 'age-31',
      header: '31–60 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.age_31_60,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.age_31_60, currency, false),
    },
    {
      id: 'age-61',
      header: '61–90 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.age_61_90,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.age_61_90, currency, false),
    },
    {
      id: 'age-91',
      header: 'Over 90 days',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.age_91_plus,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.age_91_plus, currency, false),
    },
    {
      id: 'oldest',
      header: 'Oldest item',
      sortable: true,
      sortValue: (row) => row.oldest_item_date,
      className: 'whitespace-nowrap',
      cell: (row) => date(row.oldest_item_date),
    },
  ],
  stats: (totals, { currency }) => [
    {
      label: 'Work in progress',
      value: formatMoney(totals.total, currency),
      hint: `${formatMinutes(totals.minutes)} of time recorded`,
    },
    { label: 'Time', value: formatMoney(totals.time_value, currency) },
    { label: 'Disbursements', value: formatMoney(totals.disbursement_value, currency) },
    {
      label: 'Over 90 days old',
      value: formatMoney(totals.age_91_plus, currency),
      hint: `${share(totals.age_91_plus, totals.total)} of the work in progress`,
      danger: totals.age_91_plus > 0,
    },
  ],
  chart: ({ totals }, { currency }) => (
    <DonutChart
      title="Work in progress by age"
      description="Unbilled work by how old each item is."
      data={[
        { key: 'a', label: '0–30 days', value: totals.age_0_30, color: 'success' },
        { key: 'b', label: '31–60 days', value: totals.age_31_60, color: 'info' },
        { key: 'c', label: '61–90 days', value: totals.age_61_90, color: 'warning' },
        { key: 'd', label: 'Over 90 days', value: totals.age_91_plus, color: 'danger' },
      ]}
      valueFormatter={(value) => formatMoney(value, currency)}
      centreLabel={{ value: formatMoney(totals.total, currency), label: 'In progress' }}
      legendPlacement="end"
      emptyTitle="No work in progress"
      aspect={16 / 7}
    />
  ),
  drill: (row, context) => ({
    label: 'See the items',
    to: linkTo(routes.org.module(context.slug, 'wip', 'details'), {
      client_id: row.client_id,
      job_id: row.job_id,
    }),
  }),
  note: 'A past date is frozen the first time it is read: the figures for that day no longer change.',
  emptyTitle: 'No work in progress',
  emptyDescription: 'Unbilled time and disbursements appear here as at the day chosen.',
};
