import type { ReactNode } from 'react';

import type { DataTableColumn } from '@/components/ui';
import { MoneyTone } from '@/components/ui/MoneyTone';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import type { BasisPoints, Pence } from '@/types/api';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';
import { describeShortfall } from '@/utils/recovery';

import type { Stat } from '../components/StatCards';
import type { ReportConfig } from '../config';
import type { RecoveryAnalysisRow, RecoveryAnalysisTotals } from '../types';
import { words } from '../utils/format';
import { minutes, money, named } from './cells';

/** A potential with what it leaves on the table (red) or over-recovers (green) under it. */
function potential(
  value: Pence | null,
  shortfall: Pence | null,
  recoveryBp: BasisPoints | null,
  currency: string,
): ReactNode {
  if (value === null || shortfall === null) return money(null, currency);
  return (
    <div className="flex flex-col items-end">
      {money(value, currency)}
      <MoneyTone kind="out" value={shortfall} className="text-xs">
        {describeShortfall(shortfall, currency)}
      </MoneyTone>
      {recoveryBp !== null ? (
        <span className="text-xs text-text-muted">{formatBasisPoints(recoveryBp)} recovered</span>
      ) : null}
    </div>
  );
}

/** Under a row's name: a job's client and terms, a client's code, a person's initials. */
function detailOf(row: RecoveryAnalysisRow, currency: string): string {
  const terms =
    row.billing_basis === 'fixed' && typeof row.fixed_fee === 'number'
      ? `Fixed ${formatMoney(row.fixed_fee, currency)}`
      : row.billing_basis
        ? words(row.billing_basis)
        : null;
  return [row.job_id ? row.client_name : row.code, terms].filter(Boolean).join(' · ');
}

/** "J00001 Annual accounts" for a job, the name otherwise. */
function titleOf(row: RecoveryAnalysisRow): string {
  return row.job_id && row.code ? `${row.code} ${row.name}` : row.name;
}

function basisColumn(
  id: string,
  header: string,
  of: (row: RecoveryAnalysisRow) => [Pence | null, Pence | null, BasisPoints | null],
  currency: string,
): DataTableColumn<RecoveryAnalysisRow> {
  return {
    id,
    header,
    align: 'end',
    sortable: true,
    sortValue: (row) => of(row)[1],
    className: 'whitespace-nowrap',
    cell: (row) => potential(...of(row), currency),
  };
}

/**
 * Invoices and recovery: what the work was invoiced at against the task rate, each person's own
 * charge-out rate and cost plus the practice's mark-up, with the revenue left on the table.
 */
export const recoveryAnalysisReport: ReportConfig<RecoveryAnalysisRow, RecoveryAnalysisTotals> = {
  endpoint: 'recovery-analysis',
  fileName: 'recovery-analysis',
  title: 'Recovery Analysis',
  description:
    'Invoice value against the task rate, the staff charge-out rates and cost plus: where revenue is left on the table.',
  what: 'recovery analysis',
  access: [P.reportFinancial],
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
  columns: ({ currency, group, totals }) => {
    const showCost = totals !== undefined && totals.cost_plus_value !== null;
    const columns: DataTableColumn<RecoveryAnalysisRow>[] = [
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
        cell: (row) => minutes(row.minutes),
      },
      {
        id: 'invoice',
        header: 'Invoice value',
        align: 'end',
        sortable: true,
        sortValue: (row) => row.invoice_value,
        className: 'whitespace-nowrap',
        cell: (row) => (
          <div className="flex flex-col items-end">
            <MoneyTone kind="in" value={row.invoice_value}>
              {formatMoney(row.invoice_value, currency)}
            </MoneyTone>
            {row.to_bill_value > 0 ? (
              <span className="text-xs text-text-muted">
                {formatMoney(row.to_bill_value, currency)} still to bill
              </span>
            ) : null}
          </div>
        ),
      },
      basisColumn(
        'task',
        'At task rate',
        (row) => [row.task_value, row.task_shortfall, row.task_recovery_bp],
        currency,
      ),
      basisColumn(
        'staff',
        'At staff rates',
        (row) => [row.staff_value, row.staff_shortfall, row.staff_recovery_bp],
        currency,
      ),
    ];
    if (showCost) {
      columns.push(
        basisColumn(
          'cost-plus',
          'Cost plus',
          (row) => [row.cost_plus_value, row.cost_plus_shortfall, row.cost_plus_recovery_bp],
          currency,
        ),
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
      );
    }
    return columns;
  },
  stats: (totals, { currency }) => {
    const pounds = (pence: Pence) => formatMoney(pence, currency);
    const recovered = (bp: BasisPoints | null) => `${formatBasisPoints(bp)} recovered`;
    const stats: Stat[] = [
      {
        label: 'Invoice value',
        value: pounds(totals.invoice_value),
        hint: `${formatMinutes(totals.minutes)} of work · ${pounds(totals.to_bill_value)} still to bill`,
      },
      {
        label: 'Left on the table at the task rate',
        value: pounds(totals.task_shortfall),
        hint: `${pounds(totals.task_value)} at the task rate · ${recovered(totals.task_recovery_bp)}`,
        danger: totals.task_shortfall > 0,
      },
      {
        label: 'Left on the table at staff rates',
        value: pounds(totals.staff_shortfall),
        hint: `${pounds(totals.staff_value)} at staff rates · ${recovered(totals.staff_recovery_bp)}`,
        danger: totals.staff_shortfall > 0,
      },
    ];
    if (totals.cost_plus_value !== null && totals.cost_plus_shortfall !== null) {
      stats.push({
        label: 'Left on the table at cost plus',
        value: pounds(totals.cost_plus_shortfall),
        hint: `${pounds(totals.cost_plus_value)} at cost plus · ${recovered(totals.cost_plus_recovery_bp)}`,
        danger: totals.cost_plus_shortfall > 0,
      });
    }
    return stats;
  },
  drill: (row, context) => {
    if (row.job_id) {
      return { label: 'Open the job', to: routes.org.module(context.slug, 'jobs', row.job_id) };
    }
    if (row.client_id && context.group === 'client') {
      return {
        label: 'Open the client’s recovery',
        to: routes.org.client(context.slug, row.client_id, 'recovery'),
      };
    }
    return null;
  },
  note: 'Invoice value is what invoices billed for the time, plus what the rest will bill on the job’s terms (the fixed fee still to bill, else the time’s value); written-off time bills nothing. The task rate is the rate the time was priced at (the job’s or service’s rate); staff rates are each person’s own charge-out rate. A positive figure is revenue left on the table. Cost needs permission to see rates.',
  emptyTitle: 'No billable work in these dates',
  emptyDescription: 'Choose other dates or filters to see how the work recovered.',
};
