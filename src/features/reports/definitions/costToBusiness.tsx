import type { DataTableColumn } from '@/components/ui';
import { MoneyTone } from '@/components/ui/MoneyTone';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import type { Pence } from '@/types/api';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';

import type { Stat } from '../components/StatCards';
import type { ReportConfig } from '../config';
import type { CostToBusinessRow, CostToBusinessTotals } from '../types';
import { money, named } from './cells';
import { detailOf, titleOf } from './recoveryAnalysis';

function amountColumn(
  id: string,
  header: string,
  of: (row: CostToBusinessRow) => Pence | null,
  currency: string,
): DataTableColumn<CostToBusinessRow> {
  return {
    id,
    header,
    align: 'end',
    sortable: true,
    sortValue: of,
    className: '[td&]:whitespace-nowrap',
    cell: (row) => money(of(row), currency),
  };
}

/** "18:00 billable · 2:00 non-billable", leaving out a side with none. */
function hoursSplit(row: CostToBusinessRow): string {
  const parts: string[] = [];
  if (row.billable_minutes > 0) parts.push(`${formatMinutes(row.billable_minutes)} billable`);
  if (row.non_billable_minutes > 0) {
    parts.push(`${formatMinutes(row.non_billable_minutes)} non-billable`);
  }
  return parts.join(' · ');
}

/**
 * Cost to Business: what the work cost the practice at what it pays each person (their cost rate,
 * not their charge-out rate), billable or not, against what it was invoiced at. Cost is the
 * point of it, so it needs permission to see rates as well as the financial reports.
 */
export const costToBusinessReport: ReportConfig<CostToBusinessRow, CostToBusinessTotals> = {
  endpoint: 'cost-to-business',
  fileName: 'cost-to-business',
  title: 'Cost to Business',
  description:
    'What the work cost the practice at each person’s cost rate, against what it was invoiced at.',
  what: 'Cost to Business report',
  access: [P.reportFinancial],
  requires: [P.rateRead],
  period: 'range',
  defaultPreset: 'this-year',
  groups: [
    { value: 'job', label: 'Job' },
    { value: 'client', label: 'Client' },
    { value: 'person', label: 'Person' },
  ],
  filters: ['client', 'job', 'user', 'partner', 'manager', 'service'],
  rowKey: (row) => `${row.key ?? 'none'}-${row.client_id ?? ''}`,
  rowLabel: titleOf,
  columns: ({ currency, group }) => [
    {
      id: 'name',
      header: group === 'client' ? 'Client' : group === 'person' ? 'Person' : 'Job',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.name,
      className: 'min-w-48 max-w-80',
      cell: (row) => named(titleOf(row), detailOf(row, currency)),
    },
    {
      id: 'hours',
      header: 'Hours',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.minutes,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end">
          <span className="tabular-nums text-text">{formatMinutes(row.minutes)}</span>
          <span className="text-xs text-text-muted">{hoursSplit(row)}</span>
        </div>
      ),
    },
    {
      id: 'cost',
      header: 'Cost',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.cost_value,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <MoneyTone kind="out" value={row.cost_value}>
          {money(row.cost_value, currency)}
        </MoneyTone>
      ),
    },
    amountColumn('per-hour', 'Cost per hour', (row) => row.cost_per_hour, currency),
    amountColumn('invoiced-cost', 'Cost of invoiced work', (row) => row.invoiced_cost, currency),
    amountColumn('wip-cost', 'Cost of WIP', (row) => row.wip_cost, currency),
    amountColumn(
      'non-billable-cost',
      'Cost of non-billable time',
      (row) => row.non_billable_cost,
      currency,
    ),
    amountColumn('invoice', 'Invoice value', (row) => row.invoice_value, currency),
    {
      id: 'margin',
      header: 'Margin',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.margin_value,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end">
          <MoneyTone kind="in" value={row.margin_value}>
            {formatMoney(row.margin_value, currency)}
          </MoneyTone>
          {row.margin_bp !== null ? (
            <span className="text-xs text-text-muted">{formatBasisPoints(row.margin_bp)}</span>
          ) : null}
        </div>
      ),
    },
  ],
  stats: (totals, { currency }) => {
    const pounds = (pence: Pence) => formatMoney(pence, currency);
    const stats: Stat[] = [
      {
        label: 'Cost to the business',
        value: pounds(totals.cost_value),
        hint: [
          `${formatMinutes(totals.minutes)} of time`,
          totals.cost_per_hour !== null ? `${pounds(totals.cost_per_hour)} an hour` : null,
          totals.non_billable_cost > 0 ? `${pounds(totals.non_billable_cost)} non-billable` : null,
        ]
          .filter(Boolean)
          .join(' · '),
      },
      {
        label: 'Invoice value',
        value: pounds(totals.invoice_value),
        hint: `Against ${pounds(totals.invoiced_cost)} of cost of the invoiced work`,
      },
      {
        label: 'Margin',
        value: pounds(totals.margin_value),
        hint:
          totals.margin_bp !== null
            ? `${formatBasisPoints(totals.margin_bp)} of the invoice value`
            : 'Nothing invoiced',
        danger: totals.margin_value < 0,
      },
    ];
    return stats;
  },
  drill: (row, context) =>
    row.job_id
      ? { label: 'Open the job', to: routes.org.module(context.slug, 'jobs', row.job_id) }
      : null,
  note: 'Cost is what the practice pays each person for the time (their cost rate), whatever they are charged out at. Invoice value is what issued and draft invoices bill for the time, less credit notes allocated to them; the margin sets it against the cost of the invoiced work. The cost of work not invoiced yet and of non-billable time is shown apart.',
  emptyTitle: 'No time in these dates',
  emptyDescription: 'Choose other dates or filters to see what the work cost.',
};
