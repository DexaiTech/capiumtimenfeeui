import { Badge, type DataTableColumn, ClientName } from '@/components/ui';
import { cn } from '@/utils/cn';
import { formatUkDate } from '@/utils/dates';
import { formatMoney } from '@/utils/money';

import { ADJUSTMENT_KIND_META, ADJUSTMENT_STATUS_META, COMPONENT_LABEL } from '../constants';
import type { Adjustment } from '../types';
import { jobText, personName, signedMoney } from '../utils/format';

export interface AdjustmentColumnsOptions {
  currency: string;
}

const dash = <span className="text-text-muted">—</span>;

/** What a status adds to its word: why it is waiting, and whether it still counts. */
function statusNote(adjustment: Adjustment, currency: string): string | null {
  if (adjustment.status === 'pending') {
    return `Above the ${formatMoney(adjustment.threshold, currency)} limit`;
  }
  if (adjustment.status === 'approved') {
    return adjustment.in_force ? 'In force' : 'Settled by billing';
  }
  return null;
}

/** The columns of the list of adjustments. */
export function adjustmentColumns({
  currency,
}: AdjustmentColumnsOptions): DataTableColumn<Adjustment>[] {
  return [
    {
      id: 'date',
      header: 'Effective',
      className: 'whitespace-nowrap',
      cell: (row) => <span className="text-text">{formatUkDate(row.effective_date)}</span>,
    },
    {
      id: 'client',
      header: 'Client',
      className: 'min-w-40 max-w-64',
      cell: (row) =>
        row.client ? <ClientName name={row.client.name} code={row.client.code} /> : dash,
    },
    {
      id: 'job',
      header: 'Job',
      className: 'min-w-40 max-w-64',
      cell: (row) =>
        row.job ? (
          <span className="block truncate text-text" title={jobText(row.job)}>
            {jobText(row.job)}
          </span>
        ) : (
          <span className="text-text-muted">Whole client</span>
        ),
    },
    {
      id: 'kind',
      header: 'Adjustment',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col items-start gap-0.5">
          <Badge tone={ADJUSTMENT_KIND_META[row.kind].tone} size="sm">
            {ADJUSTMENT_KIND_META[row.kind].label}
          </Badge>
          <span className="text-xs text-text-muted">{COMPONENT_LABEL[row.component]} WIP</span>
        </div>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      align: 'end',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <span
          className={cn(
            'font-semibold tabular-nums',
            row.kind === 'write_on' ? 'text-success' : 'text-danger',
          )}
        >
          {signedMoney(row.signed_amount, currency)}
        </span>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      className: 'min-w-56 max-w-96',
      cell: (row) => (
        <span className="block truncate text-text" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      className: 'whitespace-nowrap',
      cell: (row) => {
        const note = statusNote(row, currency);
        return (
          <div className="flex flex-col items-start gap-0.5">
            <Badge tone={ADJUSTMENT_STATUS_META[row.status].tone} size="sm" dot>
              {ADJUSTMENT_STATUS_META[row.status].label}
            </Badge>
            {note ? <span className="text-xs text-text-muted">{note}</span> : null}
          </div>
        );
      },
    },
    {
      id: 'requested',
      header: 'Requested by',
      className: 'whitespace-nowrap',
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-text">{personName(row.requested_by)}</span>
          <span className="text-xs text-text-muted">{formatUkDate(row.requested_at)}</span>
        </div>
      ),
    },
    {
      id: 'decision',
      header: 'Decision',
      className: 'min-w-40 max-w-64',
      cell: (row) =>
        row.decided_by ? (
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-text">{personName(row.decided_by)}</span>
            <span
              className="truncate text-xs text-text-muted"
              title={row.decision_note ?? undefined}
            >
              {formatUkDate(row.decided_at)}
              {row.decision_note ? `: ${row.decision_note}` : ''}
            </span>
          </div>
        ) : (
          dash
        ),
    },
  ];
}
