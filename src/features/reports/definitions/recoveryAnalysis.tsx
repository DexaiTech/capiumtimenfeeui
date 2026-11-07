import type { ReactNode } from 'react';

import type { DataTableColumn } from '@/components/ui';
import { MoneyTone } from '@/components/ui/MoneyTone';
import { PERMISSIONS as P } from '@/constants/permissions';
import { routes } from '@/constants/routes';
import type { BasisPoints, Pence } from '@/types/api';
import { formatMinutes } from '@/utils/minutes';
import { formatBasisPoints, formatMoney } from '@/utils/money';
import {
  costPlusLabel,
  describeShortfall,
  invoiceParts,
  rateMix,
  rateOrderText,
} from '@/utils/recovery';

import type { Stat } from '../components/StatCards';
import type { ReportConfig } from '../config';
import type {
  RecoveryAnalysisFilters,
  RecoveryAnalysisRow,
  RecoveryAnalysisTotals,
} from '../types';
import { words } from '../utils/format';
import { minutes, money, named } from './cells';

/** A potential with what it leaves on the table (red) or over-recovers (green) under it. */
function potential(
  value: Pence | null,
  shortfall: Pence | null,
  recoveryBp: BasisPoints | null,
  currency: string,
  hint?: string,
): ReactNode {
  if (value === null || shortfall === null) return money(null, currency);
  return (
    <div className="flex flex-col items-end" title={hint || undefined}>
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
export function detailOf(
  row: Pick<RecoveryAnalysisRow, 'billing_basis' | 'fixed_fee' | 'job_id' | 'client_name' | 'code'>,
  currency: string,
): string {
  const terms =
    row.billing_basis === 'fixed' && typeof row.fixed_fee === 'number'
      ? `Fixed ${formatMoney(row.fixed_fee, currency)}`
      : row.billing_basis
        ? words(row.billing_basis)
        : null;
  return [row.job_id ? row.client_name : row.code, terms].filter(Boolean).join(' · ');
}

/** "J00001 Annual accounts" for a job, the name otherwise. */
export function titleOf(row: Pick<RecoveryAnalysisRow, 'job_id' | 'code' | 'name'>): string {
  return row.job_id && row.code ? `${row.code} ${row.name}` : row.name;
}

function basisColumn(
  id: string,
  header: string,
  of: (row: RecoveryAnalysisRow) => [Pence | null, Pence | null, BasisPoints | null],
  currency: string,
  hint?: (row: RecoveryAnalysisRow) => string,
): DataTableColumn<RecoveryAnalysisRow> {
  return {
    id,
    header,
    align: 'end',
    sortable: true,
    sortValue: (row) => of(row)[1],
    cell: (row) => potential(...of(row), currency, hint?.(row)),
  };
}

/** The rate order the report was worked out with, in words. */
function orderOf(filters: RecoveryAnalysisFilters | undefined): string | null {
  const order = filters?.rate_order;
  return order && order.length > 0 ? rateOrderText(order) : null;
}

/**
 * Invoices and recovery: what the invoiced work was billed at against the recovery rate (the
 * practice's order of the client job-specific, task and staff rates), each person's own
 * charge-out rate and cost plus the job's, client's or practice's mark-up, with the revenue left
 * on the table. Work not invoiced yet is WIP, shown apart.
 */
export const recoveryAnalysisReport: ReportConfig<RecoveryAnalysisRow, RecoveryAnalysisTotals> = {
  endpoint: 'recovery-analysis',
  fileName: 'recovery-analysis',
  title: 'Recovery Analysis',
  description:
    'Invoice value against the recovery rate (client job, task or staff rate), the staff charge-out rates and cost plus: where revenue is left on the table.',
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
        header: 'Hours invoiced',
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
            {row.credited_value > 0 || row.draft_value > 0 ? (
              <span className="text-xs text-text-muted">{invoiceParts(row, currency)}</span>
            ) : null}
          </div>
        ),
      },
      basisColumn(
        'recovery',
        'Potential recovery',
        (row) => [row.recovery_value, row.recovery_shortfall, row.recovery_bp],
        currency,
        rateMix,
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
          costPlusLabel(totals.markup_bp),
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
    columns.push({
      id: 'wip',
      header: 'Not invoiced (WIP)',
      align: 'end',
      sortable: true,
      sortValue: (row) => row.wip_value,
      className: 'whitespace-nowrap',
      cell: (row) =>
        row.wip_minutes > 0 ? (
          <div className="flex flex-col items-end">
            {money(row.wip_value, currency)}
            <span className="text-xs text-text-muted">{formatMinutes(row.wip_minutes)}</span>
          </div>
        ) : (
          money(null, currency)
        ),
    });
    return columns;
  },
  stats: (totals, { currency, filters }) => {
    const pounds = (pence: Pence) => formatMoney(pence, currency);
    const recovered = (bp: BasisPoints | null) => `${formatBasisPoints(bp)} recovered`;
    const order = orderOf(filters);
    const wip =
      totals.wip_minutes > 0
        ? `${formatMinutes(totals.wip_minutes)} not invoiced yet (${pounds(totals.wip_value)} WIP)`
        : 'Nothing waiting to be invoiced';
    const stats: Stat[] = [
      {
        label: 'Invoice value',
        value: pounds(totals.invoice_value),
        hint: `${formatMinutes(totals.minutes)} invoiced · ${wip}`,
      },
      {
        label: 'Left on the table at the recovery rate',
        value: pounds(totals.recovery_shortfall),
        hint: [
          `${pounds(totals.recovery_value)} potential recovery`,
          recovered(totals.recovery_bp),
          order ? `Rate order: ${order}` : null,
        ]
          .filter(Boolean)
          .join(' · '),
        danger: totals.recovery_shortfall > 0,
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
        hint: `${pounds(totals.cost_plus_value)} at ${costPlusLabel(totals.markup_bp).toLowerCase()} · ${recovered(totals.cost_plus_recovery_bp)}`,
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
  note: 'Only invoiced work is compared: what issued and draft invoices bill for it, less credit notes allocated to those invoices; written-off work bills nothing. Work not invoiced yet, a fixed fee included, is WIP until its invoice exists. The recovery rate is the first rate found, in the order set in Settings → General → Rates: the client job-specific rate, the task rate, the staff charge-out rate. Cost plus adds the job’s mark-up, else the client’s, else the practice’s. A positive figure is revenue left on the table. Cost needs permission to see rates.',
  emptyTitle: 'No billable work in these dates',
  emptyDescription: 'Choose other dates or filters to see how the work recovered.',
};
