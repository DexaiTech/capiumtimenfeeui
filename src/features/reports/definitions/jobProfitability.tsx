import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type { JobProfitabilityRow, JobProfitabilityTotals } from '../types';
import { words } from '../utils/format';
import { minutes, money, named, percent } from './cells';

/** What the time on each job was worth, cost and billed, and the margin. */
export const jobProfitabilityReport: ReportConfig<JobProfitabilityRow, JobProfitabilityTotals> = {
  endpoint: 'job-profitability',
  fileName: 'job-profitability',
  title: 'Job Profitability',
  description: 'Billed value, cost and margin per job.',
  what: 'job profitability',
  access: [P.reportFinancial],
  period: 'range',
  filters: ['client', 'job', 'partner', 'manager', 'service'],
  rowKey: (row) => row.job_id,
  rowLabel: (row) => `${row.job_number} ${row.job_name}`,
  columns: ({ currency, totals }) => {
    const showCost = totals !== undefined && totals.cost_value !== null;
    return [
      {
        id: 'job',
        header: 'Job',
        hideable: false,
        sortable: true,
        sortValue: (row) => row.job_number,
        className: 'min-w-56 max-w-96',
        cell: (row) => named(`${row.job_number} ${row.job_name}`, row.client_name),
      },
      {
        id: 'status',
        header: 'Status',
        sortable: true,
        sortValue: (row) => row.status,
        className: 'whitespace-nowrap',
        cell: (row) => (
          <span className="text-text">
            {words(row.status)}
            <span className="block text-xs text-text-muted">{words(row.billing_basis)}</span>
          </span>
        ),
      },
      {
        id: 'logged',
        header: 'Logged',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.logged_minutes,
        cell: (row) => minutes(row.logged_minutes),
      },
      {
        id: 'value',
        header: 'Time value',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.time_value,
        className: 'whitespace-nowrap',
        cell: (row) => money(row.time_value, currency),
      },
      ...(showCost
        ? [
            {
              id: 'cost',
              header: 'Cost',
              align: 'end',
              sortable: true,
              sortValue: (row: JobProfitabilityRow) => row.cost_value,
              className: 'whitespace-nowrap',
              cell: (row: JobProfitabilityRow) => money(row.cost_value, currency),
            } as const,
          ]
        : []),
      {
        id: 'billed',
        header: 'Billed',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.billed_value,
        className: 'whitespace-nowrap',
        cell: (row) => money(row.billed_value, currency),
      },
      {
        id: 'written-off',
        header: 'Written off',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.written_off_value,
        className: 'whitespace-nowrap',
        cell: (row) => money(row.written_off_value, currency, false),
      },
      ...(showCost
        ? [
            {
              id: 'margin',
              header: 'Margin',
              align: 'end',
              sortable: true,
              sortValue: (row: JobProfitabilityRow) => row.margin,
              className: 'whitespace-nowrap',
              cell: (row: JobProfitabilityRow) => (
                <div className="flex flex-col items-end">
                  {money(row.margin, currency)}
                  <span className="text-xs text-text-muted">
                    {formatBasisPoints(row.margin_bp)}
                  </span>
                </div>
              ),
            } as const,
          ]
        : []),
      {
        id: 'budget',
        header: 'Budget used',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.budget_minutes_used_bp ?? row.budget_fee_used_bp,
        className: 'whitespace-nowrap',
        cell: (row) =>
          row.budget_minutes_used_bp === null && row.budget_fee_used_bp === null ? (
            percent(null)
          ) : (
            <div className="flex flex-col items-end">
              {row.budget_minutes_used_bp !== null ? (
                <span className="tabular-nums text-text">
                  {formatBasisPoints(row.budget_minutes_used_bp)} of hours
                </span>
              ) : null}
              {row.budget_fee_used_bp !== null ? (
                <span className="text-xs tabular-nums text-text-muted">
                  {formatBasisPoints(row.budget_fee_used_bp)} of fee
                </span>
              ) : null}
            </div>
          ),
      },
    ];
  },
  stats: (totals, { currency }) => [
    {
      label: 'Time value',
      value: formatMoney(totals.time_value, currency),
      hint: `${formatMinutes(totals.logged_minutes)} logged`,
    },
    {
      label: 'Billed',
      value: formatMoney(totals.billed_value, currency),
      hint: `${formatMoney(totals.billed_time_value, currency)} of it time`,
    },
    {
      label: 'Written off',
      value: formatMoney(totals.written_off_value, currency),
      danger: totals.written_off_value > 0,
    },
    ...(totals.margin === null
      ? []
      : [
          {
            label: 'Margin',
            value: formatMoney(totals.margin, currency),
            hint: `${formatBasisPoints(totals.margin_bp)} of the time billed`,
            danger: totals.margin < 0,
          },
        ]),
  ],
  drill: (row, context) => ({
    label: 'Open the job',
    to: routes.org.module(context.slug, 'jobs', row.job_id),
  }),
  note: 'Margin is the time billed less what the time cost; work not yet invoiced is not in it. Cost and margin need permission to see rates.',
  emptyTitle: 'No jobs to report on',
  emptyDescription: 'Jobs with time logged or invoices appear here.',
};
