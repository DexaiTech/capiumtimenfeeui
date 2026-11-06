import type { ReactNode } from 'react';

import { Badge, type BadgeTone, type DataTableColumn } from '@/components/ui';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import type { Pence } from '@/types/api';
import { formatUkDate } from '@/utils/dates';
import { formatMinutes } from '@/utils/minutes';
import { formatMoney } from '@/utils/money';

import type { ReportConfig } from '../config';
import type {
  OvertimeStatus,
  StaffCostAmounts,
  StaffCostJobRow,
  StaffCostRow,
  StaffCostTotals,
} from '../types';
import { linkTo } from '../utils/format';
import { minutes, money, named } from './cells';

const OVERTIME_ONLY_HERE =
  'Overtime cost is shown only here: it never changes WIP, invoices or job profitability.';

/** Pending overtime is reported as unapproved; rejected overtime keeps only its standard cost. */
const STATUS: Record<OvertimeStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: 'Unapproved', tone: 'amber' },
  approved: { label: 'Approved', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'red' },
};

/** The cost, with the hours it is for under it (a dash when there were none). */
function costOf(hours: number, cost: Pence, currency: string): ReactNode {
  if (hours === 0 && cost === 0) return money(null, currency);
  return (
    <div className="flex flex-col items-end">
      {money(cost, currency)}
      <span className="text-xs text-text-muted">{formatMinutes(hours)}</span>
    </div>
  );
}

function costColumn(
  id: string,
  header: string,
  hours: (row: StaffCostRow) => number,
  cost: (row: StaffCostRow) => Pence,
  currency: string,
): DataTableColumn<StaffCostRow> {
  return {
    id,
    header,
    align: 'end',
    sortable: true,
    sortValue: cost,
    className: 'whitespace-nowrap',
    cell: (row) => costOf(hours(row), cost(row), currency),
  };
}

const overtimeMinutes = (row: StaffCostAmounts) =>
  row.overtime_minutes_allocated + row.overtime_minutes_unallocated;

const periodOf = (row: StaffCostRow) =>
  `${formatUkDate(row.period_start)} – ${formatUkDate(row.period_end)}`;

/**
 * Staff Cost (APT81): what each person's time cost the practice in each of their periods, standard
 * hours at their cost rate and overtime at their overtime rate, on jobs (allocated) or on internal
 * work (unallocated). The only place overtime cost shows, so it has a permission of its own.
 */
export const staffCostReport: ReportConfig<StaffCostRow, StaffCostTotals> = {
  endpoint: 'staff-cost',
  fileName: 'staff-cost',
  title: 'Staff Cost',
  description: `Standard and overtime hours and cost of each staff member. ${OVERTIME_ONLY_HERE}`,
  what: 'Staff Cost report',
  access: [P.reportStaffCost],
  period: 'range',
  filters: ['user', 'grade', 'job', 'client', 'approval', 'overtime'],
  personLabel: 'Staff member',
  rowKey: (row) => `${row.user.id}-${row.period_start}`,
  rowLabel: (row) => `${row.user.full_name}, ${periodOf(row)}`,
  columns: ({ currency }) => [
    {
      id: 'name',
      header: 'Staff member',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.user.full_name,
      className: 'min-w-48 max-w-80',
      cell: (row) => named(row.user.full_name, row.grade?.name),
    },
    {
      id: 'period',
      header: 'Period',
      sortable: true,
      sortValue: (row) => row.period_start,
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{periodOf(row)}</span>,
    },
    costColumn(
      'standard',
      'Standard',
      (row) => row.standard_minutes,
      (row) => row.standard_cost,
      currency,
    ),
    costColumn(
      'allocated',
      'Allocated overtime',
      (row) => row.overtime_minutes_allocated,
      (row) => row.overtime_cost_allocated,
      currency,
    ),
    costColumn(
      'unallocated',
      'Unallocated overtime',
      (row) => row.overtime_minutes_unallocated,
      (row) => row.overtime_cost_unallocated,
      currency,
    ),
    {
      id: 'total',
      header: 'Total cost',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.total_cost,
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-end gap-0.5">
          {money(row.total_cost, currency)}
          {row.pending_overtime_cost > 0 ? (
            <Badge tone="amber" size="sm">
              {`${formatMoney(row.pending_overtime_cost, currency)} unapproved`}
            </Badge>
          ) : null}
        </div>
      ),
    },
  ],
  stats: (totals, { currency }) => {
    const pounds = (pence: Pence) => formatMoney(pence, currency);
    const overtimeCost = totals.overtime_cost_allocated + totals.overtime_cost_unallocated;
    return [
      {
        label: 'Total cost',
        value: pounds(totals.total_cost),
        hint: `${formatMinutes(totals.standard_minutes + overtimeMinutes(totals))} of time`,
      },
      {
        label: 'Standard',
        value: pounds(totals.standard_cost),
        hint: `${formatMinutes(totals.standard_minutes)} at the cost rate`,
      },
      {
        label: 'Overtime',
        value: pounds(overtimeCost),
        hint: `${pounds(totals.overtime_cost_allocated)} allocated · ${pounds(totals.overtime_cost_unallocated)} unallocated`,
      },
      {
        label: 'Unapproved overtime',
        value: pounds(totals.pending_overtime_cost),
        hint: 'Overtime still pending approval',
      },
    ];
  },
  drill: (row, { slug, values }, period) =>
    overtimeMinutes(row) > 0
      ? {
          label: 'See the overtime jobs',
          to: linkTo(routes.org.module(slug, 'reports', 'staff-cost'), {
            group: 'job',
            user: row.user.id,
            // The row's period, within the dates on screen.
            from: period.from > row.period_start ? period.from : row.period_start,
            to: period.to && period.to < row.period_end ? period.to : row.period_end,
            grade: values.grade,
            job: values.job,
            client: values.client,
            approval: values.approval,
            overtime: values.overtime,
          }),
        }
      : null,
  note: 'Standard time is costed at each person’s cost rate, overtime at their overtime rate. Allocated overtime is on a client’s job, unallocated overtime on internal work. Overtime still pending approval is counted and marked unapproved; rejected overtime keeps only its standard cost.',
  emptyTitle: 'No time in these dates',
  emptyDescription: 'Choose other dates or filters to see what staff time cost.',
};

/**
 * The flagged jobs behind a Staff Cost row: the jobs one person worked overtime on, with the
 * hours, the overtime rate applied, the cost and where it is in its approval.
 */
export const staffCostJobsReport: ReportConfig<StaffCostJobRow, unknown> = {
  endpoint: 'staff-cost/jobs',
  fileName: 'staff-cost-jobs',
  title: 'Staff Cost by job',
  description: `The jobs a staff member worked overtime on. ${OVERTIME_ONLY_HERE}`,
  what: 'Staff Cost report',
  access: [P.reportStaffCost],
  period: 'range',
  filters: ['user', 'grade', 'job', 'client', 'approval', 'overtime'],
  personLabel: 'Staff member',
  rowKey: (row) => `${row.job.id}-${row.status}`,
  rowLabel: (row) => `${row.job.number} ${row.job.name}`,
  columns: ({ currency }) => [
    {
      id: 'job',
      header: 'Job',
      hideable: false,
      sortable: true,
      sortValue: (row) => row.job.number,
      className: 'min-w-48 max-w-80',
      cell: (row) => (
        <div className="flex min-w-0 items-start gap-2">
          {named(`${row.job.number} ${row.job.name}`, row.client.name)}
          <Badge tone="violet" size="sm">
            Overtime
          </Badge>
        </div>
      ),
    },
    {
      id: 'hours',
      header: 'Overtime hours',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.overtime_minutes,
      className: 'whitespace-nowrap',
      cell: (row) => minutes(row.overtime_minutes),
    },
    {
      id: 'rate',
      header: 'Rate an hour',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.overtime_rate,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.overtime_rate, currency),
    },
    {
      id: 'cost',
      header: 'Overtime cost',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.overtime_cost,
      className: 'whitespace-nowrap',
      cell: (row) => money(row.overtime_cost, currency),
    },
    {
      id: 'status',
      header: 'Approval',
      sortable: true,
      sortValue: (row) => STATUS[row.status].label,
      cell: (row) => (
        <Badge tone={STATUS[row.status].tone} size="sm">
          {STATUS[row.status].label}
        </Badge>
      ),
    },
  ],
  // The person's figures are on their Staff Cost row; this view lists the jobs behind them.
  stats: () => [],
  emptyTitle: 'No overtime on jobs',
  emptyDescription: 'This staff member worked no overtime in these dates.',
};
